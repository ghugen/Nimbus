import {
  body,
  clean,
  fail,
  json,
  now,
  rows,
  run,
  rate,
  audit,
  type FeatureRuntime,
  type FeatureUser,
} from "./feature-db";
import { paymentsReady } from "./payment-readiness";
export async function operationDocuments(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const path = new URL(req.url).pathname.slice(5);
  if (!["documents", "documents-admin", "integration-readiness"].includes(path))
    return null;
  const u = await auth(req);
  if ((path.endsWith("-admin") || path === "integration-readiness") && !u.admin)
    fail("Acesso restrito.", 403);
  if (path === "integration-readiness")
    return json({
      payments: {
        key: !!e.STRIPE_SECRET_KEY,
        webhook_secret: !!e.STRIPE_WEBHOOK_SECRET,
        delivery_verified: e.STRIPE_WEBHOOK_READY === "1",
        ready: paymentsReady(e),
        mode: e.STRIPE_SECRET_KEY?.startsWith("sk_test_")
          ? "test"
          : "unconfirmed",
      },
      email: { ready: !!e.RESEND_API_KEY && !!e.EMAIL_FROM },
      assistant: { configured: !!e.AI_GATEWAY_API_KEY && !!e.AI_GATEWAY_MODEL },
      electronic_signature: { connected: false },
      tax_documents: { connected: false },
    });
  if (req.method === "GET")
    return json({
      documents: await rows(
        e,
        `SELECT d.id,d.user_id,d.kind,d.order_id,d.reference,d.status,d.url,d.notes,d.created,d.updated FROM operation_documents d ${u.admin && path === "documents-admin" ? "" : "WHERE d.user_id=?"} ORDER BY d.updated DESC LIMIT 200`,
        ...(u.admin && path === "documents-admin" ? [] : [u.id]),
      ),
    });
  await rate(e, u.id, path, 10);
  const b = await body(req);
  if (path === "documents") {
    if (b.kind !== "invoice") fail("Solicitação inválida.");
    const order = (
      await rows(
        e,
        "SELECT id FROM orders WHERE id=? AND user_id=? AND status='paid' AND total>0",
        clean(b.order_id, 100),
        u.id,
      )
    )[0];
    if (!order) fail("Selecione uma compra paga de sua conta.", 403);
    const id = "invoice:" + order.id;
    await run(
      e,
      "INSERT OR IGNORE INTO operation_documents(id,user_id,kind,order_id,status,notes,created,updated) VALUES(?,?,'invoice',?,'requested',?,?,?)",
      id,
      u.id,
      order.id,
      clean(b.notes, 2000),
      now(),
      now(),
    );
    return json({ ok: true, id });
  }
  if (b.action === "create-contract") {
    const userId = clean(b.user_id, 150);
    if (!(await rows(e, "SELECT id FROM users WHERE id=?", userId)).length)
      fail("Conta não encontrada.");
    const reference = clean(b.reference, 150);
    if (reference.length < 5) fail("Identifique o contrato.");
    const id = crypto.randomUUID();
    await run(
      e,
      "INSERT INTO operation_documents(id,user_id,kind,reference,status,notes,created,updated) VALUES(?,?,'contract',?,'preparing',?,?,?)",
      id,
      userId,
      reference,
      clean(b.notes, 3000),
      now(),
      now(),
    );
    await audit(e, u.id, "contract.prepared", id);
    return json({ ok: true, id });
  }
  const d = (
    await rows(
      e,
      "SELECT * FROM operation_documents WHERE id=?",
      clean(b.id, 180),
    )
  )[0];
  if (!d) fail("Registro não encontrado.", 404);
  const status = clean(b.status, 30),
    allowed =
      d.kind === "invoice"
        ? ["requested", "processing", "issued", "canceled"]
        : ["preparing", "awaiting_signature", "signed", "canceled"];
  if (!allowed.includes(status)) fail("Estado inválido.");
  const reference = clean(b.reference, 150),
    link = clean(b.url, 2000),
    notes = clean(b.notes, 3000);
  if (link) {
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      fail("Informe uma URL HTTPS válida.");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      fail("Informe uma URL HTTPS válida.");
  }
  if (
    ["issued", "signed"].includes(status) &&
    (!link || reference.length < 5 || b.verified !== true)
  )
    fail(
      "Confira a emissão ou assinatura no serviço externo e informe referência e link de consulta.",
    );
  await run(
    e,
    "UPDATE operation_documents SET status=?,reference=?,url=?,notes=?,updated=? WHERE id=?",
    status,
    reference,
    link,
    notes,
    now(),
    d.id,
  );
  await audit(e, u.id, "document.status_changed", String(d.id));
  return json({ ok: true });
}
