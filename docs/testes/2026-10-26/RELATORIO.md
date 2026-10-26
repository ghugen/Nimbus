# Testes de volume da Nimbus — 26/10/2026

Foram concluídos **450.000 cenários automatizados**, com **30.000 por grupo**, sem falhas de asserção na execução final. A verificação cobre os subconjuntos descritos abaixo: **não significa que os 15 fluxos completos foram testados 30.000 vezes em produção, em dispositivos reais ou com os provedores ativos**.

- Asserções: **2.910.000**.
- Chamadas à API importada: **1.500.000**; sem HTTP de produção.
- Chamadas a adaptadores de provedores simulados: **270.000**.
- Chamadas externas reais, cobranças e e-mails externos: **zero**.
- Tempo decorrido entre início e fim das duas rotinas: **9.7 minutos**.
- Código funcional testado: `5000d79385dbd76ca81469c7f848da2a225481c9`.
- SHA-256 do arquivo de cenários: `d2669d7406cfc33e07e2599789c6d00de614ff0e2bc3a32f12c783d57daff610`.
- Ambiente: Node v24.22.1; SQLite 3.53.4; bancos em memória e armazenamento fictício.
- A suíte habitual também passou: **8 testes unitários e 483 verificações de integração**.

| Item | Cenários concluídos | Falhas | Cobertura e limite |
|---|---:|---:|---|
| 1. Compra e entrega | 30.000 | 0 | Stripe, R2 e e-mail simulados; compra real no sandbox depende de webhook configurado. |
| 2. Pagamento interrompido | 30.000 | 0 | Retomada e repetição sequenciais na API isolada; corrida distribuída real não medida. |
| 3. Webhook repetido e adulterado | 30.000 | 0 | Assinatura HMAC real e eventos simulados; entrega pela rede Stripe não exercitada. |
| 4. Proteção de arquivos | 30.000 | 0 | Autorização da API e bytes no armazenamento simulado; fronteira de identidade da hospedagem não substituída. |
| 5. Reembolso | 30.000 | 0 | Solicitação, aprovação, revogação e conciliação com resposta Stripe simulada; sem dinheiro real. |
| 6. Identidade e acesso à conta | 30.000 | 0 | Identidade de teste injetada no adaptador isolado e rejeição de anônimos/tokens inválidos; cadastro/recuperação no provedor pendentes. |
| 7. Revisão e publicação por autores | 30.000 | 0 | Edição, permissão e aprovação via API; conferência editorial humana não simulada. |
| 8. Arquivos problemáticos | 30.000 | 0 | Formato, assinatura e conteúdo básico; não constitui varredura antivírus. |
| 9. Simulados e revisões | 30.000 | 0 | Regras de tentativas e cartões pela API; interação e percepção do estudante exigem navegador. |
| 10. PDF e atlas | 30.000 | 0 | Estrutura de PDFs reais gerados e limites de marcadores do atlas; 30000 OCRs/leituras por voz não executados. |
| 11. Navegação e acessibilidade — cobertura parcial | 30.000 | 0 | Somente roteamento e destinos seguros; 30000 testes visuais em iOS/Android, contraste e leitor de tela não executados. |
| 12. Atendimento e notificações | 30.000 | 0 | Chamado vinculado e envio idempotente ao provedor simulado; recebimento real na caixa postal não testado. |
| 13. Privacidade e isolamento dos dados | 30.000 | 0 | Exportação e isolamento entre titulares; exclusão, retenção e conformidade jurídica dependem de processo operacional. |
| 14. Desempenho local com concorrência | 30.000 | 0 | Concorrência local sobre API importada, sem HTTP/Cloudflare/D1 remoto; não é capacidade de produção. |
| 15. Backup e restauração isolada | 30.000 | 0 | Restaurações em SQLite vazio com todas as migrações e cópia em memória dos arquivos fictícios; backup real da hospedagem não exercitado. |

## Como os testes foram executados

Os testes usam os handlers e as regras da aplicação, SQLite com todas as migrações e arquivos fictícios. Cada cenário começa no mesmo estado-base e suas alterações são revertidas, preservando a independência e evitando que limites de uso ou resíduos de uma rodada invalidem a próxima. Os lotes não são 30.000 usuários simultâneos. O grupo de desempenho executa oito consultas concorrentes por rodada dentro do processo; isso não representa tráfego HTTP para a hospedagem.

Entradas variam por índice reproduzível: preços, identificadores, titulares fictícios, respostas, dificuldade de cartões, coordenadas do atlas, tipos de arquivo, conteúdo privado e campos restaurados. A suíte combina repetições de ramos limitados com dados variados; 450.000 cenários não significam 450.000 funcionalidades distintas.

Cada restauração cria um SQLite vazio, aplica todas as migrações, restaura o snapshot e verifica registros, titular e conteúdo do arquivo fictício copiado em memória. O backup real da hospedagem e os objetos reais do armazenamento não foram acessados.

Falhas na montagem inicial do teste (citação de string, comparação do protótipo SQLite e leitura do envelope da resposta) foram corrigidas antes da execução final. A rodada piloto de 100 cenários por grupo também passou. Esses ensaios não foram somados aos 450.000 cenários finais.

## Conferência no navegador

- Catálogo com um título principal e idioma pt-BR: **aprovado**.
- Botões sem nome acessível no catálogo: **aprovado**.
- Imagens sem atributo alt no catálogo: **aprovado**.
- Rolagem horizontal no viewport observado de 1348px: **aprovado** — documentWidth = viewportWidth = 1348
- Busca acadêmica submetida por Enter: **aprovado** — Dois guias originais de Métodos de estudo retornados
- OCR da primeira página do guia de revisão ativa: **aprovado** — Texto em português reconhecido no navegador
- Questões da demonstração: **aprovado** — Três respostas corretas em três questões; comentários e referências visíveis
- Navegação por página citada: **aprovado** — Botão Consultar página 2 abriu página 2 e limpou OCR da página anterior
- Leitura por voz local: **indisponível** — Chrome não disponibilizou voz local; alternativa em texto exibida
- iOS e Android reais; leitor de tela; auditoria completa de contraste: **não executado**.

Essas conferências no Chrome foram pontuais e não são contadas como 30.000 testes visuais. Não houve teste em aparelhos iPhone/Android físicos, execução de leitor de tela ou certificação de acessibilidade.

## Pendências para testes completos

- Configurar e validar o webhook da Stripe num endpoint externamente acessível e concluir a compra no sandbox real.
- Configurar autenticação por e-mail e testar cadastro, verificação e recuperação no provedor.
- Configurar remetente e provedor de e-mail; verificar entrega, spam e falhas reais.
- Testar visualmente em iOS/Android, com teclado e leitor de tela, e auditar contraste.
- Executar backup/restauração dos dados e arquivos reais em ambiente separado autorizado.
- Medir carga HTTP e limites da hospedagem em ambiente de homologação, com tráfego e custo definidos.
- Validar retenção, exclusão de dados e políticas de operação; testes técnicos não certificam conformidade jurídica.

## Reprodução

```bash
# Toda a suíte de volume (30.000 rodadas por grupo)
npm run test:stress

# Ensaio menor, sem entrar na contagem oficial
NIMBUS_STRESS_ROUNDS=100 NIMBUS_STRESS_OUTPUT=work/pilot.json npm run test:stress

# Relatório desta execução em duas rotinas independentes
node tests/merge-stress-results.mjs work/stress-main.json work/stress-backup.json
```

`NIMBUS_STRESS_GROUPS=1,2,3` seleciona grupos. `NIMBUS_STRESS_OUTPUT` escolhe a saída. Não configure chaves reais: o harness utiliza credenciais fictícias e intercepta as chamadas a provedores. O resumo consolidado só é gerado se houver exatamente 15 grupos concluídos com 30.000 cenários cada.

[Evidência detalhada em JSON](stress-results.json)
