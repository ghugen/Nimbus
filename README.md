# Nimbus

Plataforma web responsiva para descoberta e comercialização de materiais acadêmicos. Inclui vitrine, catálogo, biblioteca do estudante, área de autores e administração. Pode ser instalada como aplicativo web em navegadores compatíveis.

## Estado da implementação

A aplicação possui frontend e backend conectados a banco D1 e arquivos privados R2. O catálogo inicial contém **exemplos identificados como demonstrativos**, que não podem ser vendidos, e quatro guias gratuitos originais em PDF, além da experiência `/experimentar` com leitura, cartões, questionário e busca de trechos. Não há números de vendas, avaliações ou credenciais inventadas.

**Não está pronta para receber pagamentos reais sem configuração.** É necessário cadastrar a conta Stripe, validar o webhook em ambiente de testes, configurar administradores, publicar PDFs comerciais autorizados, completar as informações do responsável pela operação e definir atendimento, cancelamentos e condições com autores. O compartilhamento atual da hospedagem é preservado; chamadas externas de webhook exigem um endpoint acessível ao provedor e uma abertura de acesso planejada.

## As 100 melhorias

O acompanhamento detalhado está em **Administração → Gestão → 100 melhorias** (`/#admin/melhorias`) e em [docs/ROADMAP_100.md](docs/ROADMAP_100.md). Cada item tem evidência técnica separada do planejamento editável. Os estados não representam certificação ou homologação externa.

Nesta entrega: **67 implementados, 23 parciais, 9 dependentes de ativação externa e 1 pendente**. O item pendente é o aplicativo nativo, etapa anteriormente adiada. A marcação "parcial" registra limitações concretas, incluindo cobrança ainda não homologada, backup dos objetos, revisão assistiva e agendamento sem visitas.

## Entrega consolidada

A lista de 66 recursos solicitados está em [docs/ESCOPO_CONSOLIDADO.md](docs/ESCOPO_CONSOLIDADO.md) e no início de Administração → 100 melhorias. Inclui estado técnico e limitações de cada recurso. O plano de pagamentos e os bloqueios de homologação estão em [docs/STRIPE_INTEGRATION_PLAN.md](docs/STRIPE_INTEGRATION_PLAN.md).

Novas áreas: mural moderado, indicações e afiliados, propostas institucionais com arquivos/preços congelados, fila de contratos/documentos fiscais externos, revisão editorial periódica, conferência de permissões, histórico de atendimento e códigos opacos em cópias de PDF compatíveis. Nenhuma assinatura eletrônica, emissão fiscal, repasse automático ou integração externa é apresentada como ativa sem a configuração correspondente.

## Experiência e preparação para lançamento

A orientação de estudantes está em `/comecar`; amostras em texto em `/amostras/:id`; o roteiro de usabilidade em `/avaliar`. A administração reúne prontidão, procura por temas, feedback privado e relatos de usabilidade. Autores têm primeiros passos, checklist por produto e condições de atualização registradas por aquisição. Veja [docs/EXPERIENCIA_E_LANCAMENTO.md](docs/EXPERIENCIA_E_LANCAMENTO.md) para entregas e limites.

## Curadoria e continuidade

Trilhas por semestre, glossário e atlas sujeitos à aprovação editorial, comparação de texto entre PDFs, correções importantes com avisos, calendário editorial, triagem de dúvidas, página `/situacao` e pausa administrativa de novos checkouts. Consulte [docs/CURADORIA_E_CONTINUIDADE.md](docs/CURADORIA_E_CONTINUIDADE.md) para os limites de cada recurso.

## Recursos implementados

- Identidade Nimbus, página inicial, navegação por áreas e layout responsivo.
- Busca por título, assunto, autor e curso, sem sensibilidade a acentos.
- Filtros por formato, área e gratuidade, ordenação e prévia pública.
- Favoritos vinculados à conta e carrinho persistente neste dispositivo.
- Autenticação da hospedagem via Sign in with ChatGPT, sem senhas locais.
- Perfil com nome e campos opcionais de curso e instituição.
- Pedidos calculados no servidor, com preços em centavos; valores do cliente não são aceitos.
- Stripe Checkout preparado com confirmação por webhook HMAC SHA-256 e tolerância de cinco minutos.
- Eventos de pagamento assíncrono, repetição idempotente do webhook e revogação em reembolso integral informado pelo provedor.
- Identificador de tentativa no checkout para evitar múltiplas sessões em tentativas repetidas do mesmo carrinho.
- Biblioteca, download protegido por titularidade e pagamento, notas e progresso privados.
- Avaliações permitidas somente a compradores com acesso ativo.
- Autores: cadastro e edição de rascunhos, envio de PDF de até 20 MB e encaminhamento para aprovação.
- PDFs versionados por chave; pedidos preservam o arquivo e o conteúdo adquiridos.
- Administração: aprovação/rejeição/retirada de produtos, pessoas, pedidos, suporte e histórico de ações.
- Atendimento com solicitações e respostas internas.
- Páginas de informações da plataforma, condições e privacidade, explicitamente marcadas como em implantação.
- PWA com tela de ausência de conexão. APIs e arquivos privados **não** são armazenados no cache do service worker.
- Validação de origem para alterações, autorização no servidor e consultas parametrizadas.

## O que não está automatizado

- Transferências bancárias automáticas, saques, Stripe Connect e emissão fiscal. O financeiro agora calcula comissões e registra repasses externos.
- Reembolsos têm solicitação e aprovação no painel, mas só funcionam com o provedor configurado e precisam de homologação real.
- E-mail transacional por Resend e acesso por Clerk estão preparados; dependem de chaves, remetente verificado e testes externos.
- Proteção DRM: nenhum sistema impede totalmente a redistribuição após um download autorizado.
- Assinaturas e cupons estão implementados. Recorrência exige homologação; indicações/afiliados estão implementados e começam desativados. O assistente busca trechos do material; explicações por IA exigem configuração, autorização do autor e consentimento do estudante.
- Revisão científica, jurídica ou editorial automática dos arquivos.
- Teste de cobrança com conta Stripe real: os testes automatizados simulam o provedor.

## Tecnologia e estrutura

React 19, TypeScript, Vinext/Vite, Cloudflare Workers, D1/SQLite, Drizzle, R2 e Stripe via API REST. Não depende de Supabase.

```text
app/page.tsx                  Interface e áreas da aplicação
app/globals.css               Identidade visual e responsividade
app/api/[...path]/route.ts    API e autorização
lib/catalog.ts                Catálogo demonstrativo e tipos
lib/commerce.ts               Validação comercial e assinatura de webhook
db/schema.ts                  Esquema do banco
drizzle/                      Migrações versionadas
public/                       Ícones, manifesto e service worker
tests/                        Testes de regras e integração
.openai/hosting.json           Configuração de hospedagem, D1 e R2
```

## Executar localmente

Requer Node.js 24 ou superior (os testes de integração usam SQLite nativo), Git e pnpm. Os scripts de execução escolhem automaticamente o perfil portátil fora do ambiente gerenciado.

```bash
git clone https://github.com/ghugen/Nimbus.git
cd Nimbus
corepack enable
pnpm install
pnpm build
```

Após o primeiro build, aplique **somente as migrações ainda não aplicadas**, na ordem:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_watery_black_cat.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_aspiring_vindicator.sql
pnpm dev
```

Abra o endereço informado no terminal. No perfil portátil, a rota de entrada simula a conta local `seedy@sites.test`. Essa simulação não existe no ambiente de produção. Defina `ADMIN_EMAILS=seedy@sites.test` em um arquivo local `.dev.vars` para testar a administração. Nunca publique esse arquivo.

Na hospedagem Sites, preserve as migrações e o manifesto. A publicação provisiona os recursos e aplica as migrações separadamente do banco local. Os dados locais de teste não são enviados à produção.

## Configuração da operação

Variáveis de runtime (valores secretos não devem entrar no Git):

| Variável                | Uso                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_EMAILS`          | E-mails de administradores, separados por vírgula, correspondentes às contas autenticadas. Sem configuração, ninguém recebe acesso administrativo. |
| `STRIPE_SECRET_KEY`     | Chave secreta da conta Stripe; usar primeiro a chave de testes.                                                                                    |
| `STRIPE_WEBHOOK_SECRET` | Segredo do endpoint de webhook.                                                                                                                    |

Na Stripe, configure `/api/webhook` na origem definitiva e selecione:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`

O endpoint precisa estar acessível à Stripe; a hospedagem inicial privada não é adequada para receber o webhook externo. Não exponha o Worker diretamente de uma forma que permita forjar os cabeçalhos de identidade: a autenticação depende da fronteira confiável da hospedagem Sites.

Os meios de pagamento são os habilitados e suportados na conta Stripe e exibidos pelo checkout; Pix não deve ser anunciado antes da habilitação e validação na conta.

A página de retorno não libera acesso sozinha. A confirmação exige assinatura válida, pedido e sessão correspondentes, moeda BRL, valor total correto e status `paid`. Reembolso integral recebido pelo webhook revoga o acesso naquele pedido. Reembolsos parciais e disputas precisam de tratamento operacional.

## Publicar um material

1. Configurar o administrador na hospedagem.
2. Entrar em **Para autores** e salvar o rascunho com autoria ou autorização declarada.
3. Enviar o PDF no cartão do material; ele passa a **Em análise**.
4. Na administração, baixar/revisar o PDF e a prévia, depois publicar ou rejeitar.
5. Testar a aquisição e o download com outra conta antes de iniciar a divulgação.

Materiais gratuitos também passam por aprovação quando enviados por autores. O guia demonstrativo gratuito já vem no catálogo e é entregue como arquivo `.txt`.

## Validação

```bash
pnpm typecheck
pnpm test
pnpm build
```

Os testes usam SQLite real em memória com todas as migrações, armazenamento R2 simulado e resposta Stripe simulada. Cobrem isolamento entre contas, aquisição gratuita, bloqueio de material demonstrativo, consentimento e origem, entrega protegida, notas, favoritos, avaliações de compradores, tickets, autorização de autores e administradores, envio/aprovação de PDF, preços do servidor e assinatura/valor/status do webhook.

Referências: [Stripe Checkout](https://docs.stripe.com/checkout/fulfillment) e [assinatura de webhook](https://docs.stripe.com/webhooks/signature).

## Próximas etapas comerciais

Conectar a conta de pagamentos, definir os termos finais e os dados do operador, cadastrar o catálogo autorizado e validar o ciclo de compra/reembolso no ambiente Stripe de testes. Abrir a plataforma ao público somente depois dessas etapas.

## Organização do catálogo — atualização

O catálogo agora separa **9 áreas**, cursos, disciplina, assunto específico e **10 tipos de material**. Classificações anteriores são convertidas na leitura sem alterar pedidos e arquivos já adquiridos. O cadastro de autores persiste curso, nível, idioma e data de atualização. A página inicial dá prioridade aos exemplos de Medicina Veterinária.

Filtros combináveis: área, curso, disciplina, assunto, tipo de material, nível, idioma, formato do arquivo, faixa de preço e atualização. As vitrines incluem gratuitos, novidades (por atualização) e mais bem avaliados. Esta última exige material não demonstrativo, pelo menos três avaliações e média mínima de quatro estrelas; não há avaliações fictícias.

Tipos: resumos e apostilas; mapas mentais e esquemas; questões e simulados; flashcards; atlas e materiais ilustrados; guias práticos; casos para estudo; modelos e ferramentas; revisões para provas; kits e coleções. Kits são arquivos completos enviados pelo autor (por exemplo, ZIP), sem geração automática de pacotes com produtos individuais.

Envio e entrega protegida aceitam PDF, TXT, DOCX, XLSX, PPTX, PNG, JPG, ZIP, MP4 e MP3, até **20 MB por material**. O arquivo é baixado no dispositivo; não há reprodutor de vídeo ou editor de planilhas integrado. O tipo é inferido da extensão, com verificação de assinatura para PDFs; aprovação editorial continua necessária.

Em instalações locais existentes, após reconstruir a aplicação, aplique também, em ordem, as novas migrações não aplicadas:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_useful_rafael_vega.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_true_gideon.sql
```

## Marketplace híbrido e financeiro

- Materiais do proprietário da Nimbus pertencem ao acervo próprio; o líquido integral pertence à operação. Parceiros usam comissão padrão de **25% sobre o líquido após processamento**, com regra individual editável pela administração.
- Autores visualizam um simulador e precisam confirmar a regra vigente ao salvar. Uma mudança de regra retira materiais incompatíveis de publicação até nova confirmação. Publicações antigas também precisam da confirmação antes de novas compras.
- Pedidos registram autor, percentual, origem e versão da regra por item. Não há recálculo retroativo quando a comissão muda. Pedidos legados sem snapshot comercial ficam pendentes, sem atribuição inventada.
- A conciliação consulta `PaymentIntent.latest_charge.balance_transaction` na Stripe. Só aceita taxa real e valores/moeda compatíveis. Rateio proporcional com distribuição do resto em centavos evita perdas por arredondamento em pedidos com vários autores.
- Taxa não disponível, divergência ou disputa impedem a liberação. Administração pode tentar novamente em **Financeiro**. Não há taxas simuladas utilizadas em saldos reais.
- Repasses são mensais: entram meses anteriores no fuso de São Paulo, depois da disponibilidade informada pelo provedor e de uma reserva operacional de 14 dias. Essa reserva não é prazo de garantia nem limita direitos do consumidor.
- O painel **registra transferências já realizadas fora da Nimbus**. Não executa PIX ou outra movimentação bancária. Verificação atômica de saldo e referência única previnem registros duplicados ou acima do disponível.
- Estornos são cumulativos, sem duplicação por reenvio do webhook. Reduzem a parcela do autor proporcionalmente; taxas não devolvidas ficam com a operação Nimbus. Se o repasse já foi feito, eventual saldo negativo é carregado para os próximos períodos.
- Ative também o webhook `charge.dispute.created`. Disputas e alterações posteriores de tarifas exigem revisão operacional. Impostos, custos extraordinários de estorno/disputa e revisão editorial não são apurados automaticamente.
- Comissões não implicam cessão de direitos autorais. Não há mensalidade de cadastro/envio; serviços editoriais e descontos dependem de acordo específico com o autor.

## Identidade visual

Neobrutalismo moderado com inspiração editorial: marfim `#FAF7F0`, preto tinta `#24212B`, lilás `#B9A3F5`, roxo `#5941A9`, amarelo `#F4D76E`, sálvia `#BFD5BC` e coral `#EFA394`. Vitrine com bordas e sombras definidas; leitura e tabelas com menos decoração. A página de privacidade continua identificada como em implantação e não representa declaração de adequação integral à LGPD.

## Central de privacidade

A página de privacidade permite exportação JSON autenticada e solicitações de acesso, correção, exclusão, oposição e informações, com protocolo e acompanhamento. A administração possui aba **Privacidade** para configurar responsável, e-mail público e retenção, além de responder solicitações. Os aceites de compra e condições do autor ficam registrados separadamente; não são tratados como consentimento genérico de LGPD.

A central não executa exclusão automática nem agenda backups completos. E-mails operacionais dependem de Resend configurado; a nova exportação de recuperação não inclui os objetos R2. Os campos da operação precisam ser preenchidos, os prazos de atendimento acompanhados e as bases legais, os fornecedores e a retenção revisados antes das vendas. Consulte `docs/PRIVACIDADE_OPERACAO.md`. A presença desses controles não certifica adequação integral à LGPD.

## Marca Nimbus

Símbolo vetorial próprio de nuvem geométrica com dobra de página, aplicado na interface, capas e ícones. Assinaturas horizontal, monocromática, invertida e símbolo isolado estão em `public/brand/`. O guia visual navegável é `/brand/index.html`. As assinaturas em SVG usam texto com fallback; para produção gráfica final, instalar Manrope ou converter texto em curvas. Esses arquivos não substituem pesquisa de disponibilidade e registro de marca.

## Evolução do marketplace

Páginas individuais em `/materiais/:id` e `/autores/:slug`, perfil público opcional, capas e até seis imagens de amostra. O autor publica em quatro etapas, confirma direitos e condições comerciais e recebe devolutivas da administração. Revisão de conteúdo exige registro explícito do revisor, objetivos e referências.

Kits reúnem ao menos dois materiais publicados do mesmo autor, sem outros kits. A compra registra cópias das referências dos arquivos; mudanças posteriores no kit não alteram a entrega original. Compradores acessam novas versões aprovadas dos materiais na biblioteca. Reembolso remove o direito de acesso.

Notificações internas cobrem aquisição, publicação/revisão, atualização e suporte. E-mail depende de `RESEND_API_KEY` e `EMAIL_FROM` (domínio verificado); sem configuração, a fila permanece pendente. O painel de operação permite novas tentativas. Não há disparo de marketing nem agendamento automático de tentativas.

Login independente por e-mail está integrado ao Clerk e depende de `CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY`. Configure a aplicação, domínio e verificação de e-mail no provedor. A autenticação Sites continua disponível. Contas dos dois provedores têm identificadores separados e não são mescladas por e-mail.

Indicadores de visualização, prévia e carrinho exigem permissão opcional no navegador; são uma amostra deduplicada por sessão/material/evento/dia, não visitantes únicos nem todo o tráfego. Compras vêm de pedidos confirmados. A escolha pode ser alterada na página de privacidade. O painel administrativo mostra pendências de pagamentos, webhook, identidade, e-mail e responsável por privacidade. Credenciais e teste real dos serviços externos ainda são necessários antes da operação comercial.

## Campanhas, comunidade e coleção aberta

Cupons administrativos percentuais ou fixos, em centavos, com período, mínimo do acervo próprio, limite global e um uso por conta. Os descontos são rateados sem perder centavos e persistidos nos itens da compra; a comissão usa os valores efetivamente vendidos. Autores parceiros não recebem descontos por esses cupons. Validação transacional de capacidade no banco. Pedidos pendentes reservam uso até falha/expiração confirmada. Campanhas existentes podem ser desativadas; condições novas exigem outro código.

Coleções em `/colecoes/:slug`, com administração por seleção de produtos ou curso/disciplina. Três páginas iniciais de Medicina Veterinária: Patologia, Toxicologia e Doenças dos Suínos. Páginas vazias indicam preparação, sem anunciar conteúdos comerciais inexistentes.

Sugestões de materiais ficam privadas ao solicitante e à administração. Correções exigem aquisição e podem ser respondidas pelo autor ou administrador. Respostas geram notificações. A biblioteca pesquisa título, disciplina, tema e anotações. O financeiro oferece filtros por período e resumo de vendas conciliadas, processamento, estornos e divisão líquida.

Quatro PDFs originais gratuitos (três páginas cada), em `public/materiais-gratuitos/`, disponíveis sem cadastro na seção Baixar PDFs gratuitos. Fontes editoriais e gerador reproduzível em `scripts/content/demo-guides.json` e `scripts/generate-demo-pdfs.py`. Materiais de organização de estudos, leitura científica, fichamento e revisão ativa. Não são apostilas clínicas nem cópias de publicações de terceiros.

Ainda dependem da operação: credenciais Stripe, Clerk e Resend; domínio/remetente verificado; dados confirmados do responsável por privacidade e critérios de retenção; arquivos comerciais do proprietário. Não foram criadas contas externas nem realizadas cobranças reais. Ofertas de serviços, agenda, orçamento, aulas e assinatura recorrente agora têm implementação descrita abaixo. A Nimbus não transmite vídeos: incorpora conteúdo hospedado em serviços externos após ação do estudante. Certificados não foram implementados.

## Planejamento comercial administrativo

Administração → ideias reúne 37 possibilidades de produtos e serviços: arquivos de estudo, visuais, prática, modelos, audiovisual, pacotes, recorrência, encontros, mentorias, serviços editoriais e licenciamento. Filtros por categoria e andamento, busca, prioridade e observações persistidas no banco. Acesso exclusivo de administrador, validado no servidor. Alterar um estado não publica ofertas nem implementa serviços futuros.

## Áreas e navegação

A navegação separa Loja, Minha biblioteca, Espaço do autor e Administração. Na entrada sem destino explícito, administradores abrem o resumo administrativo e demais contas abrem a biblioteca. A loja continua acessível a qualquer momento. Entradas com destino válido (por exemplo, carrinho) preservam a intenção após autenticação; destinos externos são rejeitados.

A biblioteca destaca um material em andamento com “Continuar estudando”. O espaço do autor tem resumo de publicações e recebimentos. A administração abre um resumo de vendas confirmadas, líquido conciliado, repasses liberados e pendências; atalhos levam à publicação, coleções, cupons e loja. As seções administrativas são agrupadas em Catálogo, Vendas, Relacionamento e Gestão, com menu recolhível no celular.

Links diretos preservados: `/#admin/ideias`, `/#admin/financeiro`, `/#admin/aprovações` e `/#autores/publicar`. A permissão é verificada no servidor, inclusive no endpoint do resumo; ocultar menus não concede nem revoga acesso. Todos os usuários podem acessar o fluxo de submissão de autoria, sujeito à revisão editorial e às condições comerciais.

Validação: testes de navegação, destinos seguros, agregações do resumo e bloqueio de acesso; conferência visual dos componentes em 390 e 414 px usando dados fictícios, sem conceder acesso a dados reais. A captura em `docs/nimbus-workspaces-mobile.jpg` registra essa conferência. Teste autenticado completo em dispositivo físico permanece uma validação operacional complementar.

## Estudo, publicação e operação ampliados

- Leitor PDF.js carregado sob demanda: navegação, zoom, retomada, busca no texto extraível, marcadores, notas e destaques em trechos extraídos. Pastas, estado de estudo e data de revisão ficam na conta do estudante. PDF digitalizado sem camada de texto precisa de OCR; destaques ainda não são desenhados nas coordenadas do PDF.
- Busca aproximada, filtros salvos, preferências de disciplinas, comparação, seguir autores e páginas por disciplina. Conhecimentos prévios, público, exclusões, requisitos, perguntas frequentes, amostras, componentes de kits e perguntas moderadas ajudam a decidir antes da compra.
- Presentes e licenças para grupos com destinatário por e-mail verificado e quota no banco. O comprador de presente não recebe acesso ao material; estorno revoga os direitos do pedido.
- Solicitações de reembolso, decisão administrativa e chamada idempotente ao provedor. Um bloqueio financeiro preserva os repasses durante o processamento; a confirmação e a conciliação usam os valores do provedor. Comprovante de aquisição não substitui documento fiscal.
- Rascunhos automáticos, recuperação sem reaproveitar aceites, prévia, checklist, duplicação, capas, comparação do cadastro e programação editorial. Programações são liberadas na primeira leitura do catálogo após a data, sem um cron externo configurado.
- Critérios editoriais, registro dos aspectos revisados, credenciais verificadas com evidência privada, denúncias, duplicatas por hash, correção vinculada a versão e moderação de avaliações.
- Papéis de revisão e atendimento com endpoints próprios, sem acesso administrativo global. Relatórios por período/material/acervo/cupom, evolução mensal em tabela, CSV, tarefas e alertas de pendências.
- Flashcards, questões com correção no servidor, aulas e progresso. Conteúdo aprovado é separado dos rascunhos de atividades. Gabaritos não são entregues antes da tentativa.
- Planos de biblioteca com catálogo e arquivos contratados preservados, confirmação recorrente via webhook e consulta ao provedor, portal de assinatura e posts de clube. Assinaturas inativas ou expiradas não liberam conteúdo. Planos aceitam apenas acervo próprio.
- Serviços operados pelo proprietário: mentorias, oficinas, aulas ao vivo e editorial. Ofertas, termos, horários, lotação transacional, pagamento, link privado e orçamento com aceite/entrega. Dependem de cadastrar ofertas e homologar os provedores. Não incluem marketplace de prestadores ou videoconferência hospedada pela Nimbus.

## Recuperação e validação

Administração → Relatórios e recuperação exporta dados e manifesto dos arquivos. O arquivo contém dados pessoais: guarde-o em local protegido. A exportação do navegador limita-se a 50 mil registros; volumes maiores exigem exportação D1 pela hospedagem. Preserve separadamente os objetos R2, inclusive versões adquiridas.

Ensaio de restauração exclusivamente em um banco SQLite **novo e isolado**:

```bash
node scripts/restore-backup.mjs nimbus-dados-backup.json ensaio-novo.sqlite
```

O script não conecta a banco remoto nem sobrescreve um arquivo existente. Aplica as migrações e restaura dados em transação, preservando os gatilhos. Não restaura arquivos R2, segredos, DNS ou configuração da hospedagem. Ainda falta ensaiar a recuperação operacional completa e configurar cópias periódicas.

Validação desta entrega: TypeScript, build de produção, 8 testes unitários e 269 verificações de integração com SQLite real e Stripe/R2 simulados. Cobertura inclui isolamento de notas e rascunhos, limites de licenças, presentes, papéis de equipe, conteúdo aprovado, pontuação no servidor, capacidade de horários, reembolso, assinatura e restauração SQL. Os testes não substituem homologação com contas reais, dispositivos físicos, tecnologia assistiva ou teste de carga.

O worker do PDF.js é copiado da dependência travada por `scripts/prepare-pdf-worker.mjs` antes de desenvolvimento/build e servido como arquivo estático versionado. Isso evita injetar o runtime de desenvolvimento dentro do Web Worker. A captura `docs/nimbus-reader-mobile.jpg` registra navegação e busca no leitor a 390 px com PDF original público, sem simular acesso privado.

Consulte [Estudo avançado e assistência editorial](docs/ESTUDO_AVANCADO.md) para simulados, revisões, atlas, OCR e configuração pendente da IA.

### Testes de volume

`npm run test:stress` executa 30.000 cenários em cada um dos 15 grupos, em SQLite isolado e com provedores simulados. Pode levar vários minutos. Não envia tráfego para a Nimbus publicada, não cobra pagamentos e não envia e-mails externos. Para ensaio rápido use `NIMBUS_STRESS_ROUNDS=100 npm run test:stress`. As limitações de cada grupo e os resultados estão em [relatório de testes de volume](docs/testes/2026-10-26/RELATORIO.md). Testes de navegação não substituem verificação visual em dispositivos reais; as simulações não validam integrações externas reais.
