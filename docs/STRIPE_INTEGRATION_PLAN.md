# Plano Stripe para a Nimbus

Atualizado em 26/10/2026. Plano obtido pelo plugin Stripe, com `stripe_implementation_planner`, guia `iguide_61Ve1zXOICTdK85YG41JiNAU3KLfn`, aceito para a opção `out_of_box_hosted`.

## Decisão

Checkout hospedado, iniciado pelo servidor, para compras avulsas em BRL de materiais digitais. A API recebe IDs e quantidades; preços, descontos, direitos, arquivos e condições comerciais são conferidos e congelados no servidor. A página de retorno não concede acesso.

Não é necessário colocar a chave publicável no navegador para este fluxo de redirecionamento. A chave secreta fica exclusivamente nas variáveis protegidas da hospedagem. Nenhuma chave é armazenada neste documento ou no Git.

## Estado confirmado

- Plugin disponível e conta de sandbox Nimbus autenticada.
- Chave de teste configurada como segredo de runtime; isso não constitui autorização para transações reais.
- Testes automatizados exercitam assinatura, eventos repetidos, divergência de valores, acesso, reembolso e conciliação com Stripe simulada.
- Não foi concluída uma transação real de sandbox com entrega de webhook no site publicado.
- O compartilhamento atual do site foi preservado. O endpoint protegido pela audiência não fica acessível automaticamente à Stripe.
- `STRIPE_WEBHOOK_SECRET` e a validação de entrega permanecem pendentes. Compras pagas ficam bloqueadas até `STRIPE_WEBHOOK_READY=1`, além das duas credenciais necessárias.

As novas sessões de Checkout usam a versão explícita `2026-09-30.endive` e um identificador de integração estável. Configure a mesma versão no endpoint de eventos durante a homologação.

## Fluxo necessário

1. Criar Checkout Session com uma chave idempotente por tentativa, itens calculados no servidor e `metadata.order_id`.
2. Redirecionar para a URL retornada pela Stripe. Meios de pagamento são apresentados conforme a elegibilidade da conta, moeda e operação, sem lista fixa no código.
3. Receber `checkout.session.completed` e `checkout.session.async_payment_succeeded`; exigir `payment_status=paid`, ID da sessão, moeda e valor correspondentes.
4. Conferir assinatura sobre o corpo original, com tolerância temporal; processar repetição de eventos sem duplicar direitos.
5. Liberar biblioteca/licenças e gerar avisos; conciliar taxas reais antes de liberar saldos.
6. Tratar falha/expiração, reembolso e disputas. Retomada consulta a sessão original; renovação somente após expiração, preservando preços e revalidando reservas.

Documentação: https://docs.stripe.com/checkout/quickstart · https://docs.stripe.com/checkout/fulfillment · https://docs.stripe.com/webhooks · https://docs.stripe.com/api/idempotent_requests

## Homologação obrigatória antes da abertura

- Definir um endpoint HTTPS que a Stripe possa acessar sem alterar silenciosamente a audiência do site. Uma implantação pública do site ou um relay dedicado precisam de decisão explícita do proprietário.
- Configurar o endpoint no mesmo ambiente de sandbox e instalar seu segredo de assinatura na hospedagem.
- Validar pagamento aprovado/recusado, método assíncrono se elegível, sessão expirada, webhook repetido, corpo adulterado, divergência de valor, aquisição em grupo/presente, acesso por outra conta, reembolso integral e conciliação.
- Só então definir `STRIPE_WEBHOOK_READY=1`. A flag é um registro operacional da conferência; não é uma verificação automática de conectividade.
- Não usar pagamentos reais nem chaves de produção nesta etapa. Antes da produção, trocar a chave de teste compartilhada no chat e preferir credencial restrita aos recursos necessários.

## Funções separadas

- Assinaturas ficam bloqueadas até homologação específica e `STRIPE_SUBSCRIPTIONS_READY=1`. É preciso conferir o ciclo de faturas, cancelamento, inadimplência e revogação por eventos de risco antes de ativar.
- Stripe Connect não foi ativado. Autores e afiliados possuem razão de saldos e registro de transferências externas; não há saques nem transferências automáticas.
- Taxação automática não foi habilitada. Emissão fiscal, enquadramento e obrigações contábeis dependem de definição com o contador e serviço de emissão apropriado.
- Taxas não são codificadas por estimativa: o financeiro usa os valores efetivos retornados pela Stripe.
