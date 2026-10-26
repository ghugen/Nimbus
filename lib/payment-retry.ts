import { assertSalesOpen } from "./editorial-evolution";
import { STRIPE_API_VERSION, CHECKOUT_INTEGRATION } from "./stripe-config";
import { requirePayments } from "./payment-readiness";
import {
  rows,
  run,
  fail,
  audit,
  type FeatureRuntime,
  type FeatureUser,
} from "./feature-db";
export async function retryOrder(
  e: FeatureRuntime,
  u: FeatureUser,
  order: Record<string, unknown>,
  origin: string,
) {
  if (order.user_id !== u.id)
    fail("Somente o comprador pode retomar o pagamento.", 403);
  if (
    !["pending", "failed"].includes(String(order.status)) ||
    !order.session_id ||
    Number(order.total) <= 0
  )
    fail(
      "Este pedido não pode ser retomado. Consulte o suporte antes de tentar outra compra.",
      409,
    );
  await assertSalesOpen(e);
  requirePayments(e);
  const authorization = { Authorization: "Bearer " + e.STRIPE_SECRET_KEY },
    res = await fetch(
      "https://api.stripe.com/v1/checkout/sessions/" +
        encodeURIComponent(String(order.session_id)),
      { headers: authorization },
    );
  const old = (await res.json()) as {
    id?: string;
    status?: string;
    url?: string;
    amount_total?: number;
    metadata?: { order_id?: string };
  };
  if (
    !res.ok ||
    old.id !== order.session_id ||
    old.metadata?.order_id !== order.id ||
    old.amount_total !== order.total
  )
    fail("Não foi possível conferir a sessão original no provedor.", 502);
  if (old.status === "open" && old.url) {
    if (order.status !== "pending")
      fail(
        "A sessão ainda está aberta, mas a reserva foi encerrada. Consulte o suporte antes de pagar.",
        409,
      );
    return { url: old.url };
  }
  if (old.status !== "expired")
    fail(
      "O provedor ainda precisa confirmar o resultado desta sessão. Consulte os pedidos ou o suporte.",
      409,
    );
  const items = await rows(
    e,
    "SELECT title,price FROM order_items WHERE order_id=? ORDER BY id",
    order.id,
  );
  if (
    !items.length ||
    items.reduce((s, i) => s + Number(i.price), 0) !== order.total
  )
    fail("Os valores do pedido precisam de conferência.", 409);
  const booking = (
      await rows(
        e,
        "SELECT id,status FROM service_bookings WHERE id=?",
        order.id,
      )
    )[0],
    quote = (
      await rows(
        e,
        "SELECT id,payment_status FROM service_quotes WHERE id=?",
        order.id,
      )
    )[0];
  try {
    await e.DB.batch([
      ...(booking
        ? [
            e.DB.prepare(
              "UPDATE service_bookings SET status='pending' WHERE id=? AND status IN ('failed','requested','pending')",
            ).bind(order.id),
          ]
        : []),
      e.DB.prepare(
        "UPDATE orders SET status='pending' WHERE id=? AND status IN ('pending','failed')",
      ).bind(order.id),
    ]);
  } catch {
    fail(
      "O horário ou a reserva de desconto não está mais disponível. Consulte o suporte.",
      409,
    );
  }
  const form = new URLSearchParams({
    mode: "payment",
    integration_identifier: CHECKOUT_INTEGRATION,
    "metadata[order_id]": String(order.id),
    customer_email: u.email,
    success_url: origin + (booking || quote ? "/#servicos" : "/#pedidos"),
    cancel_url: origin + "/#pedidos",
  });
  if (booking || quote)
    form.set("metadata[nimbus_service_kind]", booking ? "booking" : "quote");
  items.forEach((i, n) => {
    form.set(`line_items[${n}][price_data][currency]`, "brl");
    form.set(`line_items[${n}][price_data][unit_amount]`, String(i.price));
    form.set(
      `line_items[${n}][price_data][product_data][name]`,
      String(i.title),
    );
    form.set(`line_items[${n}][quantity]`, "1");
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        ...authorization,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": STRIPE_API_VERSION,
        "Idempotency-Key": "retry:" + order.id + ":" + order.session_id,
      },
      body: form,
    }),
    d = (await response.json()) as { id?: string; url?: string };
  if (!response.ok || !d.id || !d.url)
    fail(
      "Não foi possível renovar a sessão. Uma nova tentativa reutiliza o mesmo identificador.",
      502,
    );
  await e.DB.batch([
    e.DB.prepare(
      "UPDATE orders SET session_id=?,checkout_url=? WHERE id=? AND session_id=? AND status='pending'",
    ).bind(d.id, d.url, order.id, order.session_id),
    ...(booking
      ? [
          e.DB.prepare(
            "UPDATE service_bookings SET session_id=?,checkout_url=? WHERE id=? AND status='pending'",
          ).bind(d.id, d.url, order.id),
        ]
      : []),
    ...(quote
      ? [
          e.DB.prepare(
            "UPDATE service_quotes SET session_id=?,checkout_url=? WHERE id=? AND payment_status!='paid'",
          ).bind(d.id, d.url, order.id),
        ]
      : []),
  ]);
  const current = (
    await rows(e, "SELECT session_id,status FROM orders WHERE id=?", order.id)
  )[0];
  if (current?.session_id !== d.id)
    fail("O pedido foi atualizado durante a tentativa. Atualize a tela.", 409);
  await audit(e, u.id, "checkout.renewed", String(order.id));
  return { url: d.url };
}
