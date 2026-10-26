import { STRIPE_API_VERSION, CHECKOUT_INTEGRATION } from "./stripe-config";
import { requirePayments } from "./payment-readiness";
import { retryOrder } from "./payment-retry";
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
import { fileMime } from "./taxonomy";
export async function syncServiceEvent(
  e: FeatureRuntime,
  event: { type: string; data?: { object?: Record<string, unknown> } },
) {
  const s = event.data?.object;
  if (
    event.type === "charge.refunded" &&
    s?.refunded === true &&
    s.payment_intent
  ) {
    const pi =
      typeof s.payment_intent === "string"
        ? s.payment_intent
        : (s.payment_intent as { id: string }).id;
    const order = (
      await rows(e, "SELECT id FROM orders WHERE payment_intent=?", pi)
    )[0];
    if (order) {
      await run(
        e,
        "UPDATE service_bookings SET status='refunded' WHERE id=?",
        order.id,
      );
      await run(
        e,
        "UPDATE service_quotes SET payment_status='refunded' WHERE id=?",
        order.id,
      );
    }
    return;
  }
  const m = s?.metadata as Record<string, string> | undefined;
  if (
    !s ||
    !m?.nimbus_service_kind ||
    !["booking", "quote"].includes(m.nimbus_service_kind)
  )
    return;
  const kind = m.nimbus_service_kind,
    id = m.order_id,
    table = kind === "booking" ? "service_bookings" : "service_quotes",
    r = (
      await rows(
        e,
        `SELECT r.* FROM ${table} r JOIN orders o ON o.id=r.id WHERE r.id=? AND r.session_id=? AND o.status IN ('pending','paid')`,
        id,
        s.id,
      )
    )[0];
  if (!r) return;
  if (
    [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
    ].includes(event.type) &&
    s.payment_status === "paid" &&
    s.currency === "brl" &&
    Number(s.amount_total) === Number(r.price)
  ) {
    await run(
      e,
      kind === "booking"
        ? "UPDATE service_bookings SET status='confirmed' WHERE id=? AND status IN ('requested','pending')"
        : "UPDATE service_quotes SET payment_status='paid',status='in_progress',updated=? WHERE id=? AND payment_status NOT IN ('paid','refunded')",
      ...(kind === "booking" ? [id] : [now(), id]),
    );
  }
  if (
    [
      "checkout.session.expired",
      "checkout.session.async_payment_failed",
    ].includes(event.type)
  ) {
    await run(
      e,
      kind === "booking"
        ? "UPDATE service_bookings SET status='failed' WHERE id=? AND status!='confirmed'"
        : "UPDATE service_quotes SET payment_status='failed',updated=? WHERE id=? AND payment_status!='paid'",
      ...(kind === "booking" ? [id] : [now(), id]),
    );
  }
  if (event.type === "charge.refunded" && s.refunded === true) {
    await run(
      e,
      kind === "booking"
        ? "UPDATE service_bookings SET status='refunded' WHERE id=?"
        : "UPDATE service_quotes SET payment_status='refunded' WHERE id=?",
      id,
    );
  }
}
export async function serviceRoutes(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  if (path === "services" && method === "GET")
    return json({
      offers: await rows(
        e,
        "SELECT id,title,kind,description,price,duration,capacity,terms,required_plan_id FROM service_offers WHERE status='published' ORDER BY created DESC",
      ),
    });
  if (path === "service-slots" && method === "GET")
    return json({
      slots: await rows(
        e,
        "SELECT s.id,s.starts,s.ends,o.capacity-(SELECT COUNT(*) FROM service_bookings b WHERE b.slot_id=s.id AND b.status IN ('requested','pending','confirmed')) remaining FROM service_slots s JOIN service_offers o ON o.id=s.offer_id WHERE o.id=? AND o.status='published' AND s.status='open' AND s.starts>? ORDER BY s.starts",
        clean(url.searchParams.get("id"), 100),
        now(),
      ),
    });
  if (
    ![
      "service-admin",
      "service-bookings",
      "service-quotes",
      "service-checkout",
      "service-delivery",
      "service-download",
    ].includes(path)
  )
    return null;
  const u = await auth(req);
  if (method !== "GET") await rate(e, u.id, path, 10);
  if (path === "service-delivery" && method === "POST") {
    if (!u.admin) fail("Acesso restrito.", 403);
    const f = await req.formData(),
      id = clean(f.get("id"), 100),
      file = f.get("file"),
      q = (
        await rows(
          e,
          "SELECT * FROM service_quotes WHERE id=? AND payment_status='paid'",
          id,
        )
      )[0];
    if (
      !q ||
      !(file instanceof File) ||
      file.size < 5 ||
      file.size > 20 * 1024 * 1024
    )
      fail("Orçamento pago ou arquivo válido não encontrado.");
    const ext = file.name.split(".").pop()?.toUpperCase();
    if (!["PDF", "TXT", "ZIP"].includes(ext || ""))
      fail("Use PDF, TXT ou ZIP para a entrega.");
    const buffer = await file.arrayBuffer();
    if (
      ext === "PDF" &&
      new TextDecoder().decode(buffer.slice(0, 5)) !== "%PDF-"
    )
      fail("PDF inválido.");
    const key =
      "service-deliveries/" +
      id +
      "/" +
      crypto.randomUUID() +
      "." +
      ext!.toLowerCase();
    await e.BUCKET.put(key, buffer, {
      httpMetadata: { contentType: fileMime(file.name) },
    });
    await run(
      e,
      "UPDATE service_quotes SET delivery=?,status='delivered',updated=? WHERE id=?",
      JSON.stringify({ key, name: file.name.slice(0, 180) }),
      now(),
      id,
    );
    await audit(e, u.id, "service.delivered", id);
    return json({ ok: true });
  }
  if (path === "service-download" && method === "GET") {
    const q = (
      await rows(
        e,
        "SELECT delivery FROM service_quotes WHERE id=? AND payment_status='paid' AND (user_id=? OR ?=1)",
        clean(url.searchParams.get("id"), 100),
        u.id,
        u.admin ? 1 : 0,
      )
    )[0];
    if (!q?.delivery) fail("Entrega não disponível.", 404);
    let d: { key: string; name: string };
    try {
      d = JSON.parse(String(q.delivery));
    } catch {
      fail("Entrega inválida.", 404);
    }
    const f = await e.BUCKET.get(d.key);
    if (!f) fail("Arquivo não encontrado.", 404);
    return new Response(f.body, {
      headers: {
        "Content-Type": fileMime(d.name),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(d.name)}`,
        "Cache-Control": "private,no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const b = method === "GET" ? null : await body(req);
  if (path === "service-admin") {
    if (!u.admin) fail("Acesso restrito.", 403);
    if (method === "GET")
      return json({
        offers: await rows(
          e,
          "SELECT * FROM service_offers ORDER BY created DESC",
        ),
        slots: await rows(e, "SELECT * FROM service_slots ORDER BY starts"),
      });
    if (b!.action === "slot") {
      const offer = (
          await rows(
            e,
            "SELECT * FROM service_offers WHERE id=?",
            clean(b!.offer_id, 100),
          )
        )[0],
        start = Date.parse(String(b!.starts)),
        end = Date.parse(String(b!.ends)),
        meeting = clean(b!.meeting_url, 1000);
      if (
        !offer ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start <= Date.now() ||
        end <= start ||
        end - start > 12 * 3600000
      )
        fail("Confira a oferta e os horários.");
      if (meeting && !meeting.startsWith("https://"))
        fail("Use um link HTTPS para o encontro.");
      await run(
        e,
        "INSERT INTO service_slots(id,offer_id,starts,ends,meeting_url,status) VALUES(?,?,?,?,?,?)",
        crypto.randomUUID(),
        offer.id,
        new Date(start).toISOString(),
        new Date(end).toISOString(),
        meeting,
        "open",
      );
      return json({ ok: true });
    }
    const price = Number(b!.price),
      duration = Number(b!.duration),
      capacity = Number(b!.capacity),
      kind = String(b!.kind),
      status = String(b!.status),
      plan = clean(b!.required_plan_id, 100);
    if (
      clean(b!.title).length < 5 ||
      clean(b!.description).length < 20 ||
      clean(b!.terms).length < 30 ||
      ![
        "mentoria_individual",
        "mentoria_grupo",
        "oficina",
        "aula_ao_vivo",
        "editorial",
        "clube",
      ].includes(kind) ||
      !["draft", "published", "archived"].includes(status) ||
      !Number.isSafeInteger(price) ||
      price < 0 ||
      price > 1000000 ||
      !Number.isInteger(duration) ||
      duration < 15 ||
      duration > 720 ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 500
    )
      fail("Confira descrição, condições, preço, duração e vagas.");
    if (
      plan &&
      (price !== 0 ||
        !(await rows(e, "SELECT id FROM subscription_plans WHERE id=?", plan))
          .length)
    )
      fail(
        "Encontros de clube exigem plano cadastrado e não têm cobrança adicional.",
      );
    if (status === "published" && price > 0 && !e.STRIPE_SECRET_KEY)
      fail("Configure pagamentos antes de publicar uma oferta paga.", 503);
    const id = clean(b!.id, 100) || crypto.randomUUID();
    await run(
      e,
      "INSERT INTO service_offers(id,author_id,title,kind,description,price,duration,capacity,status,terms,required_plan_id,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,price=excluded.price,duration=excluded.duration,capacity=excluded.capacity,status=excluded.status,terms=excluded.terms,required_plan_id=excluded.required_plan_id",
      id,
      u.id,
      clean(b!.title, 150),
      kind,
      clean(b!.description, 10000),
      price,
      duration,
      capacity,
      status,
      clean(b!.terms, 10000),
      plan,
      now(),
    );
    await audit(e, u.id, "service.offer_saved", id);
    return json({ ok: true, id });
  }
  if (path === "service-bookings") {
    if (method === "GET")
      return json({
        bookings: await rows(
          e,
          `SELECT b.id,b.offer_id,b.slot_id,b.status,b.price,b.created,o.title,s.starts,s.ends,CASE WHEN b.status='confirmed' THEN s.meeting_url ELSE '' END meeting_url FROM service_bookings b JOIN service_offers o ON o.id=b.offer_id JOIN service_slots s ON s.id=b.slot_id ${u.admin ? "" : "WHERE b.user_id=?"} ORDER BY s.starts`,
          ...(u.admin ? [] : [u.id]),
        ),
      });
    if (b!.action === "cancel") {
      const booking = (
        await rows(
          e,
          "SELECT * FROM service_bookings WHERE id=? AND (user_id=? OR ?=1)",
          clean(b!.id, 100),
          u.id,
          u.admin ? 1 : 0,
        )
      )[0];
      if (
        !booking ||
        (["confirmed", "pending"].includes(String(booking.status)) &&
          Number(booking.price) > 0)
      )
        fail(
          "Um pagamento iniciado ou confirmado precisa ser verificado no suporte antes do cancelamento.",
          409,
        );
      await run(
        e,
        "UPDATE service_bookings SET status='canceled' WHERE id=?",
        booking.id,
      );
      return json({ ok: true });
    }
    if (b!.accepted !== true) fail("Confirme as condições do encontro.");
    const slot = (
      await rows(
        e,
        "SELECT s.*,o.price,o.required_plan_id,o.terms FROM service_slots s JOIN service_offers o ON o.id=s.offer_id WHERE s.id=? AND s.status='open' AND o.status='published' AND s.starts>?",
        clean(b!.slot_id, 100),
        now(),
      )
    )[0];
    if (!slot) fail("Horário não disponível.", 404);
    if (
      slot.required_plan_id &&
      !(
        await rows(
          e,
          "SELECT id FROM subscriptions WHERE user_id=? AND plan_id=? AND status='active' AND expires>?",
          u.id,
          slot.required_plan_id,
          now(),
        )
      ).length
    )
      fail("Encontro disponível apenas aos assinantes ativos do clube.", 403);
    const id = crypto.randomUUID();
    try {
      await run(
        e,
        "INSERT INTO service_bookings(id,offer_id,slot_id,user_id,status,price,created) VALUES(?,?,?,?,?,?,?)",
        id,
        slot.offer_id,
        slot.id,
        u.id,
        Number(slot.price) === 0 ? "confirmed" : "requested",
        slot.price,
        now(),
      );
    } catch {
      fail(
        "Vagas indisponíveis ou você já possui uma reserva neste horário.",
        409,
      );
    }
    await run(
      e,
      "INSERT INTO legal_acceptances(id,user_id,kind,version,details,created) VALUES(?,?,?,?,?,?)",
      id,
      u.id,
      "service_terms",
      "v1",
      JSON.stringify({
        offer: slot.offer_id,
        slot: slot.id,
        price: slot.price,
        terms: slot.terms,
      }),
      now(),
    );
    return json({ id, free: Number(slot.price) === 0 });
  }
  if (path === "service-quotes") {
    if (method === "GET")
      return json({
        quotes: (
          await rows(
            e,
            `SELECT q.*,o.title FROM service_quotes q JOIN service_offers o ON o.id=q.offer_id ${u.admin ? "" : "WHERE q.user_id=?"} ORDER BY q.created DESC`,
            ...(u.admin ? [] : [u.id]),
          )
        ).map((q) => ({
          ...q,
          delivery: q.delivery ? "Arquivo disponível" : "",
        })),
      });
    if (b!.action === "respond") {
      if (!u.admin) fail("Acesso restrito.", 403);
      const q = (
          await rows(
            e,
            "SELECT * FROM service_quotes WHERE id=?",
            clean(b!.id, 100),
          )
        )[0],
        price = Number(b!.price);
      if (
        !q ||
        !["requested", "quoted"].includes(String(q.status)) ||
        !Number.isSafeInteger(price) ||
        price < 0 ||
        price > 1000000 ||
        clean(b!.response).length < 20
      )
        fail("Confira o estado, o escopo e o valor do orçamento.");
      await run(
        e,
        "UPDATE service_quotes SET status='quoted',price=?,response=?,updated=? WHERE id=?",
        price,
        clean(b!.response, 10000),
        now(),
        q.id,
      );
      return json({ ok: true });
    }
    if (b!.action === "accept") {
      if (b!.accepted !== true)
        fail("Confirme o escopo e o preço do orçamento.");
      const q = (
        await rows(
          e,
          "SELECT * FROM service_quotes WHERE id=? AND user_id=? AND status='quoted'",
          clean(b!.id, 100),
          u.id,
        )
      )[0];
      if (!q) fail("Orçamento não disponível.", 404);
      await run(
        e,
        "UPDATE service_quotes SET status='accepted',payment_status=?,updated=? WHERE id=?",
        Number(q.price) === 0 ? "paid" : "unpaid",
        now(),
        q.id,
      );
      await run(
        e,
        "INSERT INTO legal_acceptances(id,user_id,kind,version,details,created) VALUES(?,?,?,?,?,?)",
        crypto.randomUUID(),
        u.id,
        "service_quote",
        "v1",
        JSON.stringify({ quote: q.id, price: q.price, scope: q.response }),
        now(),
      );
      return json({ ok: true });
    }
    const offer = (
      await rows(
        e,
        "SELECT * FROM service_offers WHERE id=? AND status='published' AND kind='editorial'",
        clean(b!.offer_id, 100),
      )
    )[0];
    if (!offer || clean(b!.brief).length < 20)
      fail("Descreva o serviço solicitado.");
    await run(
      e,
      "INSERT INTO service_quotes(id,user_id,offer_id,brief,created,updated) VALUES(?,?,?,?,?,?)",
      crypto.randomUUID(),
      u.id,
      offer.id,
      clean(b!.brief, 10000),
      now(),
      now(),
    );
    return json({ ok: true });
  }
  if (path === "service-checkout" && method === "POST") {
    requirePayments(e);
    if (!e.STRIPE_SECRET_KEY)
      fail("Pagamentos de serviços ainda não foram ativados.", 503);
    const kind = b!.kind === "quote" ? "quote" : "booking",
      table = kind === "quote" ? "service_quotes" : "service_bookings",
      r = (
        await rows(
          e,
          `SELECT r.*,o.title,o.author_id FROM ${table} r JOIN service_offers o ON o.id=r.offer_id WHERE r.id=? AND r.user_id=?`,
          clean(b!.id, 100),
          u.id,
        )
      )[0];
    if (
      !r ||
      !["requested", "pending", "accepted", "failed"].includes(
        String(r.status),
      ) ||
      Number(r.price) <= 0
    )
      fail("Reserva ou orçamento indisponível.", 409);
    if (kind === "quote" && r.status !== "accepted")
      fail("Aceite o orçamento antes de pagar.");
    if (r.checkout_url && r.session_id) {
      const order = (await rows(e, "SELECT * FROM orders WHERE id=?", r.id))[0];
      if (!order) fail("Pedido não encontrado.", 404);
      return json(await retryOrder(e, u, order, url.origin));
    }
    await e.DB.batch([
      e.DB.prepare(
        "INSERT OR IGNORE INTO orders(id,user_id,status,total,created) VALUES(?,?,?,?,?)",
      ).bind(r.id, u.id, "pending", r.price, now()),
      e.DB.prepare(
        "INSERT OR IGNORE INTO order_items(id,order_id,product_id,price,title,content,author_id,commission_bps,owned,policy_version) VALUES(?,?,?,?,?,?,?,?,?,?)",
      ).bind(
        String(r.id) + ":service",
        r.id,
        "service:" + r.id,
        r.price,
        r.title,
        "Serviço contratado na Nimbus. Consulte a área Serviços.",
        r.author_id,
        0,
        1,
        "services-owned-v1",
      ),
    ]);
    const response = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + e.STRIPE_SECRET_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
          "Stripe-Version": STRIPE_API_VERSION,
          "Idempotency-Key": "nimbus-service:" + r.id,
        },
        body: new URLSearchParams({
          mode: "payment",
          integration_identifier: CHECKOUT_INTEGRATION,
          "line_items[0][price_data][currency]": "brl",
          "line_items[0][price_data][unit_amount]": String(r.price),
          "line_items[0][price_data][product_data][name]": String(r.title),
          "line_items[0][quantity]": "1",
          customer_email: u.email,
          success_url: url.origin + "/#servicos",
          cancel_url: url.origin + "/#servicos",
          "metadata[order_id]": String(r.id),
          "metadata[nimbus_service_kind]": kind,
        }),
      },
    );
    const d = (await response.json()) as { id?: string; url?: string };
    if (!response.ok || !d.id || !d.url)
      fail("Não foi possível iniciar o pagamento do serviço.", 502);
    await run(
      e,
      `UPDATE ${table} SET session_id=?,checkout_url=?${kind === "booking" ? ",status='pending'" : ""} WHERE id=?`,
      d.id,
      d.url,
      r.id,
    );
    await run(
      e,
      "UPDATE orders SET session_id=?,checkout_url=? WHERE id=?",
      d.id,
      d.url,
      r.id,
    );
    return json({ url: d.url });
  }
  return null;
}
