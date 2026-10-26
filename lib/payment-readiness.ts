export type PaymentConfiguration = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_WEBHOOK_READY?: string;
};
export function paymentsReady(e: PaymentConfiguration) {
  return (
    !!e.STRIPE_SECRET_KEY &&
    !!e.STRIPE_WEBHOOK_SECRET &&
    e.STRIPE_WEBHOOK_READY === "1"
  );
}
export function requirePayments(e: PaymentConfiguration) {
  if (!paymentsReady(e))
    throw Object.assign(
      new Error(
        "Pagamentos aguardam a configuração e a validação da confirmação automática. Os materiais gratuitos continuam disponíveis.",
      ),
      { status: 503 },
    );
}
