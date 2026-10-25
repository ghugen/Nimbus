# Nimbus

Plataforma web responsiva para descoberta e comercialização de materiais acadêmicos. Inclui vitrine, catálogo, biblioteca do estudante, área de autores e administração. Pode ser instalada como aplicativo web em navegadores compatíveis.

## Estado da implementação

A aplicação possui frontend e backend conectados a banco D1 e arquivos privados R2. O catálogo inicial contém **exemplos identificados como demonstrativos**, que não podem ser vendidos, e um guia gratuito original em texto para experimentar o fluxo completo. Não há números de vendas, avaliações ou credenciais inventadas.

**Não está pronta para receber pagamentos reais sem configuração.** É necessário cadastrar a conta Stripe, validar o webhook em ambiente de testes, configurar administradores, publicar PDFs comerciais autorizados, completar as informações do responsável pela operação e definir atendimento, cancelamentos e condições com autores. A hospedagem inicial é privada para o proprietário; isso também impede chamadas externas de webhook até uma abertura de acesso planejada.

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

- Repasse a autores, comissão, saques, Stripe Connect e emissão fiscal.
- Reembolsos pelo painel Nimbus (devem ser tratados pela operação no provedor).
- E-mail transacional, recuperação por e-mail, login social fora da autenticação da hospedagem.
- Proteção DRM: nenhum sistema impede totalmente a redistribuição após um download autorizado.
- Assinaturas, cupons, afiliados e recomendação por IA.
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
