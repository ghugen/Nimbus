export type NotificationRuntime = {
  DB: D1Database;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  PUBLIC_ORIGIN?: string;
};
const now = () => new Date().toISOString();
export async function notify(
  env: NotificationRuntime,
  id: string,
  userId: string,
  title: string,
  message: string,
  href = "/#biblioteca",
) {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO notifications(id,user_id,title,message,href,created) VALUES(?,?,?,?,?,?)",
    ).bind(id, userId, title, message, href, now()),
    env.DB.prepare(
      "INSERT OR IGNORE INTO email_outbox(id,user_id,subject,message,created) VALUES(?,?,?,?,?)",
    ).bind(id, userId, title, message, now()),
  ]);
}
export async function deliver(env: NotificationRuntime, id: string) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM)
    return { status: "pending", reason: "Configure provedor e remetente." };
  const row = await env.DB.prepare(
    "SELECT e.*,u.email FROM email_outbox e JOIN users u ON u.id=e.user_id WHERE e.id=?",
  )
    .bind(id)
    .first<{
      id: string;
      email: string;
      subject: string;
      message: string;
      status: string;
    }>();
  if (!row || row.status === "sent")
    return { status: row?.status || "not_found" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": id,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [row.email],
        subject: row.subject,
        text:
          row.message +
          "\n\nAcesse sua conta Nimbus para acompanhar os detalhes.",
      }),
    });
    const d = (await res.json()) as { id?: string };
    if (!res.ok || !d.id) throw new Error("Provedor não aceitou o envio.");
    await env.DB.prepare(
      "UPDATE email_outbox SET status='sent',provider_id=?,sent=?,last_error='' WHERE id=?",
    )
      .bind(d.id, now(), id)
      .run();
    return { status: "sent" };
  } catch {
    await env.DB.prepare(
      "UPDATE email_outbox SET status='failed',last_error=? WHERE id=?",
    )
      .bind(
        "Falha no envio. Verifique domínio, remetente e configuração do provedor.",
        id,
      )
      .run();
    return { status: "failed" };
  }
}
export async function purchaseNotice(
  env: NotificationRuntime,
  orderId: string,
  userId: string,
) {
  const license = await env.DB.prepare(
    "SELECT gift,seats FROM order_licenses WHERE order_id=?",
  )
    .bind(orderId)
    .first<{ gift: number; seats: number }>();
  const special = !!license && (license.gift === 1 || license.seats > 1);
  const id = "purchase:" + orderId;
  await notify(
    env,
    id,
    userId,
    "Sua aquisição está disponível",
    special
      ? "O pedido foi confirmado. Consulte seus presentes e licenças para acompanhar o acesso dos destinatários."
      : "O pedido foi confirmado. Seus materiais já estão na biblioteca.",
    special ? "/#licencas" : "/#biblioteca",
  );
  await deliver(env, id);
}
