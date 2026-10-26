import {
  body,
  clean,
  fail,
  json,
  now,
  rows,
  rate,
  audit,
  type FeatureRuntime,
  type FeatureUser,
} from "./feature-db";
import { notify, deliver } from "./notifications";
export async function supportThread(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url);
  if (url.pathname !== "/api/support-thread") return null;
  const u = await auth(req),
    b = req.method === "GET" ? null : await body(req),
    id = clean(b?.id || url.searchParams.get("id"), 100),
    ticket = (await rows(e, "SELECT * FROM tickets WHERE id=?", id))[0],
    role = (
      await rows(e, "SELECT support FROM staff_roles WHERE user_id=?", u.id)
    )[0],
    staff = u.admin || role?.support === 1;
  if (!ticket || (!staff && ticket.user_id !== u.id))
    fail("Chamado não encontrado.", 404);
  if (req.method === "GET")
    return json({
      ticket: {
        id: ticket.id,
        status: ticket.status,
        order_id: ticket.order_id,
      },
      messages: await rows(
        e,
        "SELECT id,kind,message,created FROM ticket_messages WHERE ticket_id=? ORDER BY created,id",
        id,
      ),
    });
  await rate(e, u.id, "support-thread", 10);
  const message = clean(b!.message, 5000);
  if (message.length < 5) fail("Descreva sua mensagem.");
  const kind = staff ? "support" : "student";
  await e.DB.batch([
    e.DB.prepare(
      "INSERT INTO ticket_messages(id,ticket_id,user_id,kind,message,created) VALUES(?,?,?,?,?,?)",
    ).bind(crypto.randomUUID(), id, u.id, kind, message, now()),
    e.DB.prepare(
      "UPDATE tickets SET status=?,response=CASE WHEN ?=1 THEN ? ELSE response END WHERE id=?",
    ).bind(staff ? "closed" : "open", staff ? 1 : 0, message, id),
  ]);
  if (staff) {
    const notification = "support:" + crypto.randomUUID();
    await notify(
      e,
      notification,
      String(ticket.user_id),
      "Resposta do suporte",
      "Sua solicitação recebeu uma resposta. Consulte o atendimento na Nimbus.",
      "/#suporte",
    );
    await deliver(e, notification);
  }
  await audit(e, u.id, "ticket.message_added", id);
  return json({ ok: true });
}
