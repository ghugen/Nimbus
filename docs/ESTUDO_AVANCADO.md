# Estudo avançado e assistência editorial — versão 12

## O que está implementado

- Leitor da biblioteca: simulados por tema, dificuldade, quantidade e duração; respostas salvas por ação explícita, retomada e histórico de temas com erros. O tempo continua fora do leitor e o servidor recusa respostas após o prazo. Cada tentativa preserva uma cópia das questões. Gabaritos e comentários são entregues após conclusão; exportações também ocultam gabaritos de tentativas abertas.
- Questões do autor: tema, dificuldade, página e comentário por alternativa, submetidos à mesma moderação do material. Campos ainda não preenchidos aparecem como indisponíveis, sem explicações inventadas.
- Fila pessoal de cartões: respostas difícil/consegui/fácil alteram o intervalo, com limite pela data da prova. Não é um modelo psicométrico nem garantia de aprendizado. Cartões privados podem ser criados com anotações e página de referência. Há proteção contra repetição da mesma requisição.
- Atlas: ampliação, legendas opcionais, exercícios por marcador e comparação de duas imagens. Imagens continuam sendo amostras públicas autorizadas; exercícios ficam sujeitos ao acesso ao material. Em telas estreitas a comparação se organiza verticalmente.
- Catálogo: busca adicional por instituição, código de disciplina, ISBN e edição. Os dados são rascunhos até aprovação ou liberação agendada. Instituição não significa afiliação oficial. O ISBN serve apenas de identificação da referência.
- PDF: OCR local em português de uma página renderizada, com modelos e bibliotecas hospedados junto ao site e carregados por ação do usuário. Texto temporário não altera o arquivo e não é indexado para busca ou para o assistente. Exige conferência, sobretudo de números, fórmulas e termos técnicos. Leitura em voz usa somente vozes locais disponíveis no dispositivo; não é garantida em todos os navegadores.
- Autores: preparação de rascunhos de cartões, questões, glossário e relações conceituais a partir de até três páginas com texto extraível. Prévia, fontes, consentimento explícito, conferência e incorporação em rascunho; nunca publica automaticamente. Relações conceituais são apresentadas para o autor desenhar/editar o mapa. A incorporação repetida do mesmo rascunho é idempotente e transacional.

## Ativação e limites

IA editorial exige `AI_GATEWAY_API_KEY` e `AI_GATEWAY_MODEL` em segredo de runtime. Sem ambos, retorna indisponível antes de extrair/enviar páginas. Nenhum provedor ou plano foi contratado nesta entrega. Com a configuração concluída, validar o modelo compatível com saída estruturada, custos, retenção do provedor e qualidade das respostas. Limite de cinco gerações editoriais por autor/dia, cinco itens, até 18 mil caracteres de fonte, 30 segundos e sem retries automáticos. Arquivos escaneados não entram na geração; o OCR local não é enviado ao provedor.

Continuam pendentes da operação: ativação e validação do webhook Stripe num endpoint externamente acessível, compra completa no sandbox real, catálogo comercial original e configuração final de e-mail e identidade. A implantação preserva o público atual do site. Aplicativos nativos continuam adiados.

## Dados e operação

Migrações 0024 e 0025 criam tentativas, cartões privados, agendamentos, eventos idempotentes de revisão, metadados, rascunhos e registro de incorporação. Exportação pessoal inclui dados da própria conta. Pedidos de exclusão continuam sujeitos ao fluxo operacional documentado em PRIVACIDADE_OPERACAO.md; não há expurgo automático. Definir prazos para tentativas, cartões e rascunhos de IA. Backups devem tratar essas tabelas como dados privados.

As dependências OCR e o modelo português são gerados em `public/ocr` a partir do lockfile por `scripts/prepare-ocr.mjs` no início do dev/build. Não precisam de CDN. As licenças acompanham os arquivos distribuídos. Texto de documento não sai do navegador no OCR; o navegador precisa baixar o motor e o modelo na primeira utilização.

## Validação

TypeScript; testes unitários de comércio; 483 verificações de integração com SQLite real e adaptadores R2/Stripe simulados; OCR efetivo do guia original no navegador. Os testes de pagamento simulados não equivalem a uma compra real no sandbox Stripe. Voz local indisponível no navegador de teste: interface mostrou a alternativa de leitura por texto/leitor de tela.
