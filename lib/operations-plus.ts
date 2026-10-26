import { retryOrder } from "./payment-retry";
import { reconcile } from "./finance";
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
  escapeHtml,
  csv,
  type FeatureRuntime,
  type FeatureUser,
} from "./feature-db";
import { notify, deliver } from "./notifications";
import { roadmap } from "./roadmap";

async function confirmedRefund(e: FeatureRuntime, orderId: string) {
  await run(e, "UPDATE orders SET status='refunded' WHERE id=?", orderId);
  await run(
    e,
    "UPDATE service_bookings SET status='refunded' WHERE id=?",
    orderId,
  );
  await run(
    e,
    "UPDATE service_quotes SET payment_status='refunded' WHERE id=?",
    orderId,
  );
  await run(
    e,
    "INSERT OR REPLACE INTO finance_events(id,order_id,type,detail,created) VALUES(?,?,'hold','Reembolso confirmado; aguardando conciliação',?)",
    orderId + ":hold",
    orderId,
    now(),
  );
  try {
    await reconcile(e, orderId);
  } catch {
    /* The hold blocks payouts until the provider reports matching refund totals. */
  }
}
export async function syncRefundEvent(
  e: FeatureRuntime,
  event: { type: string; data?: { object?: Record<string, unknown> } },
) {
  if (
    !["refund.created", "refund.updated", "refund.failed"].includes(event.type)
  )
    return;
  const r = event.data?.object;
  if (!r || typeof r.id !== "string") return;
  const request = (
    await rows(
      e,
      "SELECT r.*,o.total FROM refund_requests r JOIN orders o ON o.id=r.order_id WHERE r.provider_id=?",
      r.id,
    )
  )[0];
  if (!request) return;
  const map: Record<string, string> = {
    succeeded: "refunded",
    pending: "processing",
    requires_action: "action_required",
    failed: "failed",
    canceled: "canceled",
  };
  const state = map[String(r.status)];
  if (!state) return;
  await run(
    e,
    "UPDATE refund_requests SET status=?,updated=? WHERE id=?",
    state,
    now(),
    request.id,
  );
  if (state === "refunded" && Number(r.amount) === Number(request.total))
    await confirmedRefund(e, String(request.order_id));
  const id = "refund:" + r.id + ":" + state;
  await notify(
    e,
    id,
    String(request.user_id),
    "Atualização do reembolso",
    "O pedido recebeu atualização de reembolso: " +
      state +
      ". Consulte o histórico na Nimbus.",
    "/#pedidos",
  );
  await deliver(e, id);
}
export async function operationsPlus(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  if (
    ![
      "refund-requests",
      "order-detail",
      "receipt",
      "finance-export",
      "order-retry",
      "quality-reports",
      "operation-tasks",
      "roadmap",
      "operation-events",
      "review-moderation",
    ].includes(path)
  )
    return null;
  const u = await auth(req);
  if (method !== "GET") await rate(e, u.id, path, 20);
  const b = method === "GET" ? null : await body(req);
  if (path === "roadmap") {
    if (!u.admin) fail("Acesso restrito.", 403);
    if (method === "GET") {
      const saved = await rows(e, "SELECT * FROM roadmap_tasks");
      return json({
        items: roadmap.map((x) => ({
          ...x,
          owner: "",
          deadline: "",
          status: "open",
          notes: "",
          ...saved.find((y) => Number(y.id) === x.id),
        })),
      });
    }
    const id = Number(b!.id),
      deadline = clean(b!.deadline, 10);
    if (
      !roadmap.some((x) => x.id === id) ||
      !["open", "in_progress", "waiting", "done"].includes(String(b!.status)) ||
      (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline))
    )
      fail("Dados de planejamento inválidos.");
    await run(
      e,
      "INSERT INTO roadmap_tasks(id,owner,deadline,status,notes,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,deadline=excluded.deadline,status=excluded.status,notes=excluded.notes,updated=excluded.updated",
      id,
      clean(b!.owner, 100),
      deadline,
      b!.status,
      clean(b!.notes, 5000),
      now(),
    );
    return json({ ok: true });
  }
  if (path === "operation-tasks") {
    if (!u.admin) fail("Acesso restrito.", 403);
    if (method === "GET")
      return json({
        tasks: await rows(
          e,
          "SELECT * FROM operation_tasks ORDER BY deadline,updated DESC LIMIT 500",
        ),
      });
    if (
      clean(b!.title).length < 3 ||
      !["open", "in_progress", "done"].includes(String(b!.status))
    )
      fail("Informe título e estado.");
    const deadline = clean(b!.deadline, 10);
    if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline))
      fail("Data inválida.");
    const id = clean(b!.id, 100) || crypto.randomUUID();
    await run(
      e,
      "INSERT INTO operation_tasks(id,title,owner,deadline,status,notes,updated) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,owner=excluded.owner,deadline=excluded.deadline,status=excluded.status,notes=excluded.notes,updated=excluded.updated",
      id,
      clean(b!.title, 150),
      clean(b!.owner, 100),
      deadline,
      b!.status,
      clean(b!.notes, 5000),
      now(),
    );
    return json({ ok: true });
  }
  if (path === "operation-events") {
    if (!u.admin) fail("Acesso restrito.", 403);
    if (method === "GET")
      return json({
        events: await rows(
          e,
          "SELECT * FROM operation_events ORDER BY created DESC LIMIT 200",
        ),
        duplicate_uploads: await rows(
          e,
          "SELECT hash,COUNT(*) count FROM upload_checks GROUP BY hash HAVING COUNT(*)>1",
        ),
      });
    await run(
      e,
      "UPDATE operation_events SET status='acknowledged' WHERE id=?",
      clean(b!.id, 100),
    );
    return json({ ok: true });
  }
  if (path === "finance-export") {
    const from = url.searchParams.get("from") || "2000-01-01",
      to = url.searchParams.get("to") || now().slice(0, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      from > to
    )
      fail("Período inválido.");
    const result = await rows(
      e,
      `SELECT s.*,i.title,i.owned FROM settlements s JOIN order_items i ON i.id=s.id WHERE s.created>=? AND s.created<? ${u.admin ? "" : "AND s.author_id=?"} ORDER BY s.created DESC`,
      from,
      to + "T23:59:59.999Z",
      ...(u.admin ? [] : [u.id]),
    );
    return new Response(
      csv([
        [
          "Data",
          "Pedido",
          "Material",
          "Acervo",
          "Venda (centavos)",
          "Processamento",
          "Nimbus",
          "Autor",
          "Estorno bruto",
          "Estorno autor",
        ],
        ...result.map((x) => [
          x.created,
          x.order_id,
          x.title,
          x.owned ? "Próprio" : "Parceiro",
          x.gross,
          x.fee,
          x.platform,
          x.author_net,
          x.refunded_gross,
          x.refunded_author,
        ]),
      ]),
      {
        headers: {
          "Content-Type": "text/csv;charset=utf-8",
          "Content-Disposition": 'attachment; filename="nimbus-financeiro.csv"',
          "Cache-Control": "private,no-store",
        },
      },
    );
  }
  if (path === "receipt" || path === "order-detail" || path === "order-retry") {
    const id = clean(b?.id || url.searchParams.get("id"), 100),
      order = (
        await rows(
          e,
          "SELECT * FROM orders WHERE id=? AND (user_id=? OR ?=1)",
          id,
          u.id,
          u.admin ? 1 : 0,
        )
      )[0];
    if (!order) fail("Pedido não encontrado.", 404);
    if (path === "order-retry") {if(method!=="POST")fail("Use o botão Retomar pagamento.",405);return json(await retryOrder(e,u,order,url.origin));}

    const items = await rows(
        e,
        "SELECT product_id,title,price FROM order_items WHERE order_id=?",
        id,
      ),
      discount =
        (
          await rows(
            e,
            "SELECT code,discount FROM coupon_uses WHERE order_id=? UNION ALL SELECT code,discount FROM referral_sales WHERE order_id=?",
            id,id,
          )
        )[0] || null;
    if (path === "order-detail")
      return json({
        order: {
          id: order.id,
          status: order.status,
          total: order.total,
          created: order.created,
        },
        items,
        discount,
        refund:
          (
            await rows(
              e,
              "SELECT status,reason,response,created,updated FROM refund_requests WHERE order_id=?",
              id,
            )
          )[0] || null,
        tickets: await rows(
          e,
          "SELECT id,subject,message,response,status,created FROM tickets WHERE user_id=? AND instr(message,?)>0",
          order.user_id,
          id,
        ),
      });
    if (!["paid", "refunded"].includes(String(order.status)))
      fail("Comprovante disponível após confirmação.", 409);
    return new Response(
      `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Comprovante Nimbus</title><style>body{font:16px sans-serif;max-width:780px;margin:50px auto;padding:25px;line-height:1.6}h1{color:#5941A9}td,th{padding:12px;text-align:left;border-bottom:1px solid #ccc}table{width:100%}</style><h1>nimbus. | Comprovante de aquisição</h1><p>Pedido ${escapeHtml(id)}<br>Data: ${escapeHtml(order.created)}<br>Estado: ${escapeHtml(order.status)}</p><table><tr><th>Material</th><th>Valor pago</th></tr>${items.map((x) => `<tr><td>${escapeHtml(x.title)}</td><td>R$ ${(Number(x.price) / 100).toFixed(2)}</td></tr>`).join("")}</table><p>Total: R$ ${(Number(order.total) / 100).toFixed(2)}</p>${discount ? `<p>Cupom ${escapeHtml(discount.code)}: R$ ${(Number(discount.discount) / 100).toFixed(2)} de desconto, já considerado nos valores acima.</p>` : ""}<p>Este comprovante registra a aquisição na plataforma. Não substitui documento fiscal.</p></html>`,
      {
        headers: {
          "Content-Type": "text/html;charset=utf-8",
          "Content-Disposition": `attachment; filename="nimbus-comprovante-${id.slice(0, 8)}.html"`,
          "Cache-Control": "private,no-store",
          "Content-Security-Policy":
            "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        },
      },
    );
  }
  if (path === "refund-requests") {
    if (method === "GET")
      return json({
        requests: await rows(
          e,
          `SELECT r.id,r.order_id,r.reason,r.status,r.response,r.amount,r.created,r.updated FROM refund_requests r ${u.admin ? "" : "WHERE r.user_id=?"} ORDER BY r.created DESC LIMIT 200`,
          ...(u.admin ? [] : [u.id]),
        ),
      });
    if (b!.action === "respond" || b!.action === "approve") {
      if (!u.admin) fail("Acesso restrito.", 403);
      const r = (
        await rows(
          e,
          "SELECT r.*,o.payment_intent,o.total,o.status order_status FROM refund_requests r JOIN orders o ON o.id=r.order_id WHERE r.id=?",
          clean(b!.id, 100),
        )
      )[0];
      if (!r) fail("Solicitação não encontrada.", 404);
      if (b!.action === "respond") {
        if (
          !["reviewing", "rejected"].includes(String(b!.status)) ||
          clean(b!.response).length < 5 ||
          ["refunded", "processing"].includes(String(r.status))
        )
          fail("Estado ou resposta inválidos.");
        await run(
          e,
          "UPDATE refund_requests SET status=?,response=?,updated=? WHERE id=?",
          b!.status,
          clean(b!.response, 3000),
          now(),
          r.id,
        );
        await audit(e, u.id, "refund." + b!.status, String(r.order_id));
        return json({ ok: true });
      }
      if (!e.STRIPE_SECRET_KEY)
        fail("Configure o provedor antes de iniciar um reembolso.", 503);
      if (!r.payment_intent || r.order_status !== "paid")
        fail("Pagamento não confirmado ou já reembolsado.", 409);
      if (["rejected", "refunded", "canceled"].includes(String(r.status)))
        fail("Esta solicitação está encerrada.", 409);
      await run(
        e,
        "UPDATE refund_requests SET status='processing',response=?,updated=? WHERE id=?",
        clean(b!.response, 3000) ||
          "Reembolso solicitado ao provedor. Acompanhe a confirmação.",
        now(),
        r.id,
      );
      await run(
        e,
        "INSERT OR REPLACE INTO finance_events(id,order_id,type,detail,created) VALUES(?,?,'hold','Reembolso iniciado; aguardando confirmação e conciliação',?)",
        String(r.order_id) + ":hold",
        r.order_id,
        now(),
      );
      let response: Response;
      try {
        response = await fetch("https://api.stripe.com/v1/refunds", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + e.STRIPE_SECRET_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
            "Idempotency-Key": "nimbus-refund:" + r.id,
          },
          body: new URLSearchParams({
            payment_intent: String(r.payment_intent),
            amount: String(r.total),
            reason: "requested_by_customer",
            "metadata[nimbus_request_id]": String(r.id),
          }),
        });
      } catch {
        fail(
          "Resposta do provedor indisponível. O estado permanece em processamento; uma nova tentativa reutiliza o mesmo identificador.",
          502,
        );
      }
      const d = (await response.json()) as { id?: string; status?: string };
      if (!response.ok || !d.id) {
        await run(
          e,
          "UPDATE refund_requests SET status='failed',response=?,updated=? WHERE id=?",
          "O provedor não aceitou o pedido. Verifique o painel financeiro.",
          now(),
          r.id,
        );
        fail("Não foi possível solicitar o reembolso.", 502);
      }
      await run(
        e,
        "UPDATE refund_requests SET provider_id=?,status=?,updated=? WHERE id=?",
        d.id,
        d.status === "succeeded"
          ? "refunded"
          : d.status === "failed"
            ? "failed"
            : "processing",
        now(),
        r.id,
      );
      if (d.status === "succeeded")
        await confirmedRefund(e, String(r.order_id));
      await audit(e, u.id, "refund.provider_requested", String(r.order_id));
      return json({ ok: true, status: d.status });
    }
    const id = clean(b!.order_id, 100),
      order = (
        await rows(
          e,
          "SELECT * FROM orders WHERE id=? AND user_id=? AND status='paid' AND total>0",
          id,
          u.id,
        )
      )[0];
    if (!order) fail("Pedido pago não encontrado.", 404);
    if (clean(b!.reason).length < 10)
      fail("Informe o motivo com pelo menos 10 caracteres.");
    if (
      (await rows(e, "SELECT id FROM refund_requests WHERE order_id=?", id))
        .length
    )
      fail("Já existe uma solicitação para este pedido.", 409);
    await run(
      e,
      "INSERT INTO refund_requests(id,order_id,user_id,reason,amount,created,updated) VALUES(?,?,?,?,?,?,?)",
      crypto.randomUUID(),
      id,
      u.id,
      clean(b!.reason, 3000),
      order.total,
      now(),
      now(),
    );
    return json({ ok: true });
  }
  if (path === "quality-reports") {
    if (method === "GET") {
      if (!u.admin) fail("Acesso restrito.", 403);
      return json({
        reports: await rows(
          e,
          "SELECT r.*,p.title FROM quality_reports r LEFT JOIN products p ON p.id=r.product_id ORDER BY r.created DESC LIMIT 200",
        ),
      });
    }
    if (b!.action === "respond") {
      if (!u.admin) fail("Acesso restrito.", 403);
      if (
        !["reviewing", "resolved", "dismissed"].includes(String(b!.status)) ||
        clean(b!.response).length < 5
      )
        fail("Informe estado e resposta.");
      await run(
        e,
        "UPDATE quality_reports SET status=?,response=?,updated=? WHERE id=?",
        b!.status,
        clean(b!.response, 3000),
        now(),
        clean(b!.id, 100),
      );
      await audit(e, u.id, "quality.responded", clean(b!.id, 100));
      return json({ ok: true });
    }
    if (clean(b!.reason).length < 20)
      fail("Descreva o problema e a referência da autoria.");
    await run(
      e,
      "INSERT INTO quality_reports(id,product_id,user_id,reason,created,updated) VALUES(?,?,?,?,?,?)",
      crypto.randomUUID(),
      clean(b!.product_id, 100),
      u.id,
      clean(b!.reason, 5000),
      now(),
      now(),
    );
    return json({ ok: true });
  }
  return null;
}
