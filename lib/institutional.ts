import { assertSalesOpen } from "./editorial-evolution";
import { updateTermStatements, updateTerms } from "./student-experience";
import { STRIPE_API_VERSION, CHECKOUT_INTEGRATION } from "./stripe-config";
import { requirePayments } from "./payment-readiness";
import { retryOrder } from "./payment-retry";
import { assertSaleAvailable } from "./editorial-operations";
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
import { publicProducts, validateBundle, bundleIds } from "./catalog-services";
import { allocate, reconcile, policy, POLICY_VERSION } from "./finance";
import { purchaseNotice } from "./notifications";
type QuoteItem = {
  update_policy?: string;
  child_terms?: Record<string, string>;
  product_id: string;
  title: string;
  price: number;
  file_key: string | null;
  file_name: string | null;
  content: string;
  author_id: string;
  children: {
    id: string;
    title: string;
    file_key: string | null;
    file_name: string | null;
    preview: string;
  }[];
};
async function verifyItems(e: FeatureRuntime, ids: string[], seats: number) {
  const products = await publicProducts(e),
    seen = new Set<string>(),
    result: QuoteItem[] = [];
  for (const id of ids) {
    const p = products.find((p) => p.id === id && p.owned === 1 && !p.demo);
    if (!p)
      fail(
        "Licenciamento disponível apenas para materiais publicados do acervo próprio.",
        409,
      );
    await assertSaleAvailable(e, p.id);
    const rule = await policy(e, p.author_id);
    if (!rule.owned || p.accepted_owned !== 1 || p.accepted_bps !== 0)
      fail("O material precisa confirmar as condições comerciais.", 409);
    const children = await validateBundle(e, p.id, p.author_id, bundleIds(p));
    for (const child of [p, ...children]) {
      await assertSaleAvailable(e, child.id);
      if (seen.has(child.id)) fail("Há materiais repetidos na proposta.");
      seen.add(child.id);
      if (child.file_key && !(await e.BUCKET.head(child.file_key)))
        fail("Arquivo indisponível.", 409);
    }
    if (!p.file_key && !children.length) {
      const { hasPackage } = await import("./learning-products");
      if (!(await hasPackage(e, p.id)))
        fail("Material sem conteúdo comercial.", 409);
    }
    result.push({
      update_policy: await updateTerms(e, p.id),
      child_terms: Object.fromEntries(
        await Promise.all(
          children.map(async (c) => [c.id, await updateTerms(e, c.id)]),
        ),
      ),
      product_id: p.id,
      title: p.title,
      price: p.price * seats,
      file_key: p.file_key,
      file_name: p.file_name,
      content: p.preview,
      author_id: p.author_id,
      children,
    });
  }
  return result;
}
export async function institutional(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  if (
    !["institutions", "institution-admin", "institution-checkout"].includes(
      path,
    )
  )
    return null;
  const u = await auth(req);
  if (method !== "GET") await rate(e, u.id, path, 10);
  const b = method === "GET" ? null : await body(req);
  if (path === "institution-admin" && !u.admin) fail("Acesso restrito.", 403);
  if (method === "GET") {
    const requests = await rows(
      e,
      `SELECT * FROM institution_requests ${path === "institution-admin" ? "" : "WHERE user_id=?"} ORDER BY created DESC LIMIT 100`,
      ...(path === "institution-admin" ? [] : [u.id]),
    );
    return json({
      requests: requests.map((r) => {
        const { quoted_items, ...rest } = r;
        return {
          ...rest,
          items: (JSON.parse(String(quoted_items)) as QuoteItem[]).map((i) => ({
            product_id: i.product_id,
            title: i.title,
            price: i.price,
            update_policy: i.update_policy,
          })),
        };
      }),
    });
  }
  if (path === "institutions") {
    if (b!.action === "accept") {
      const r = (
        await rows(
          e,
          "SELECT * FROM institution_requests WHERE id=? AND user_id=? AND status='quoted' AND expires>?",
          clean(b!.id, 100),
          u.id,
          now(),
        )
      )[0];
      if (!r || b!.accepted !== true)
        fail("Proposta expirada, indisponível ou sem aceite.", 409);
      await e.DB.batch([
        e.DB.prepare(
          "UPDATE institution_requests SET status='accepted',updated=? WHERE id=? AND status='quoted'",
        ).bind(now(), r.id),
        e.DB.prepare(
          "INSERT INTO legal_acceptances(id,user_id,kind,version,details,created) VALUES(?,?,?,?,?,?)",
        ).bind(
          "institution:" + r.id,
          u.id,
          "institution_license",
          "v1",
          JSON.stringify({
            request: r.id,
            scope: r.scope,
            seats: r.seats,
            price: r.price,
            items: JSON.parse(String(r.quoted_items)).map((i: QuoteItem) => ({
              id: i.product_id,
              title: i.title,
              price: i.price,
              update_policy: i.update_policy,
            })),
          }),
          now(),
        ),
      ]);
      return json({ ok: true });
    }
    const ids = b!.product_ids,
      seats = Number(b!.seats);
    if (
      clean(b!.organization).length < 3 ||
      clean(b!.message).length < 20 ||
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > 30 ||
      ids.some((id) => typeof id !== "string") ||
      new Set(ids).size !== ids.length ||
      !Number.isInteger(seats) ||
      seats < 2 ||
      seats > 100
    )
      fail("Informe instituição, objetivo, materiais e de 2 a 100 licenças.");
    if (
      (
        await rows(
          e,
          "SELECT id FROM institution_requests WHERE user_id=? AND created>=?",
          u.id,
          now().slice(0, 10),
        )
      ).length >= 5
    )
      fail("Limite de cinco solicitações por dia.", 429);
    await verifyItems(e, ids as string[], seats);
    await run(
      e,
      "INSERT INTO institution_requests(id,user_id,organization,course,message,seats,product_ids,created,updated) VALUES(?,?,?,?,?,?,?,?,?)",
      crypto.randomUUID(),
      u.id,
      clean(b!.organization, 180),
      clean(b!.course, 100),
      clean(b!.message, 5000),
      seats,
      JSON.stringify(ids),
      now(),
      now(),
    );
    return json({ ok: true });
  }
  if (path === "institution-admin") {
    const r = (
      await rows(
        e,
        "SELECT * FROM institution_requests WHERE id=?",
        clean(b!.id, 100),
      )
    )[0];
    if (!r || !["requested", "quoted"].includes(String(r.status)))
      fail("A proposta aceita não pode ser alterada.", 409);
    if (b!.action === "decline") {
      await run(
        e,
        "UPDATE institution_requests SET status='declined',scope=?,updated=? WHERE id=?",
        clean(b!.scope, 10000),
        now(),
        r.id,
      );
      return json({ ok: true });
    }
    const price = Number(b!.price),
      seats = Number(b!.seats),
      expires = Date.parse(String(b!.expires)),
      ids = JSON.parse(String(r.product_ids)) as string[];
    if (
      !Number.isSafeInteger(price) ||
      price < 0 ||
      price > 10000000 ||
      !Number.isInteger(seats) ||
      seats < 2 ||
      seats > 100 ||
      !Number.isFinite(expires) ||
      expires <= Date.now() ||
      expires > Date.now() + 90 * 86400000 ||
      clean(b!.scope).length < 40
    )
      fail(
        "Confira valor total, licenças, escopo e validade de até noventa dias.",
      );
    const items = await verifyItems(e, ids, seats),
      prices = allocate(
        price,
        items.map((i) => Math.max(i.price, 1)),
      );
    items.forEach((i, n) => (i.price = prices[n]));
    await run(
      e,
      "UPDATE institution_requests SET status='quoted',seats=?,price=?,scope=?,expires=?,quoted_items=?,updated=? WHERE id=? AND status IN ('requested','quoted')",
      seats,
      price,
      clean(b!.scope, 10000),
      new Date(expires).toISOString(),
      JSON.stringify(items),
      now(),
      r.id,
    );
    await audit(e, u.id, "institution.quoted", String(r.id));
    return json({ ok: true });
  }
  const r = (
    await rows(
      e,
      "SELECT * FROM institution_requests WHERE id=? AND user_id=? AND status IN ('accepted','paid')",
      clean(b!.id, 100),
      u.id,
    )
  )[0];
  if (!r) fail("Aceite a proposta antes de continuar.", 409);
  const existing = (
    await rows(e, "SELECT * FROM orders WHERE id=? AND user_id=?", r.id, u.id)
  )[0];
  if (existing) {
    if (existing.status === "paid")
      return json({
        free: Number(existing.total) === 0,
        paid: true,
        order: r.id,
      });
    if (
      ["pending", "failed"].includes(String(existing.status)) &&
      existing.checkout_url
    )
      return json({
        ...(await retryOrder(e, u, existing, url.origin)),
        order: r.id,
      });
    fail("Aguarde a confirmação ou consulte o suporte sobre este pedido.", 409);
  }
  if (String(r.expires) <= now())
    fail("A validade da proposta encerrou. Solicite uma nova proposta.", 409);
  if (Number(r.price) > 0) {
    await assertSalesOpen(e);
    requirePayments(e);
  }
  const items = JSON.parse(String(r.quoted_items)) as QuoteItem[];
  await verifyItems(
    e,
    items.map((i) => i.product_id),
    Number(r.seats),
  );
  for (const i of items)
    for (const file of [i, ...i.children])
      if (file.file_key && !(await e.BUCKET.head(file.file_key)))
        fail("Um arquivo da proposta não está disponível.", 409);
  await e.DB.batch([
    ...(await updateTermStatements(
      e,
      String(r.id),
      items.flatMap((i) => [i.product_id, ...i.children.map((c) => c.id)]),
      Object.assign(
        {},
        ...items.map((i) => ({
          ...i.child_terms,
          ...(i.update_policy ? { [i.product_id]: i.update_policy } : {}),
        })),
      ),
    )),
    e.DB.prepare(
      "INSERT INTO orders(id,user_id,status,total,created) VALUES(?,?,?,?,?)",
    ).bind(
      r.id,
      u.id,
      Number(r.price) === 0 ? "paid" : "pending",
      r.price,
      now(),
    ),
    e.DB.prepare(
      "INSERT INTO order_licenses(order_id,seats,gift) VALUES(?,?,0)",
    ).bind(r.id, r.seats),
    ...items.map((i) =>
      e.DB.prepare(
        "INSERT INTO order_items(id,order_id,product_id,author_id,commission_bps,owned,policy_version,price,title,file_key,file_name,content) VALUES(?,?,?,?,0,1,?,?,?,?,?,?)",
      ).bind(
        crypto.randomUUID(),
        r.id,
        i.product_id,
        i.author_id,
        POLICY_VERSION,
        i.price,
        i.title,
        i.file_key,
        i.file_name,
        i.content,
      ),
    ),
    ...items.flatMap((i) =>
      i.children.map((c) =>
        e.DB.prepare(
          "INSERT INTO order_assets(id,order_id,parent_id,product_id,title,file_key,file_name,content) VALUES(?,?,?,?,?,?,?,?)",
        ).bind(
          crypto.randomUUID(),
          r.id,
          i.product_id,
          c.id,
          c.title,
          c.file_key,
          c.file_name,
          c.preview,
        ),
      ),
    ),
  ]);
  if (Number(r.price) === 0) {
    await reconcile(e, String(r.id));
    await purchaseNotice(e, String(r.id), u.id);
    return json({ free: true, order: r.id });
  }
  const form = new URLSearchParams({
    mode: "payment",
    integration_identifier: CHECKOUT_INTEGRATION,
    "metadata[order_id]": String(r.id),
    customer_email: u.email,
    success_url: url.origin + "/#licencas",
    cancel_url: url.origin + "/#instituicoes",
  });
  items.forEach((i, n) => {
    form.set(`line_items[${n}][price_data][currency]`, "brl");
    form.set(`line_items[${n}][price_data][unit_amount]`, String(i.price));
    form.set(
      `line_items[${n}][price_data][product_data][name]`,
      i.title + " · " + r.seats + " licenças",
    );
    form.set(`line_items[${n}][quantity]`, "1");
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + e.STRIPE_SECRET_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": STRIPE_API_VERSION,
        "Idempotency-Key": "institution:" + r.id,
      },
      body: form,
    }),
    d = (await res.json()) as { id?: string; url?: string };
  if (!res.ok || !d.id || !d.url)
    fail(
      "Não foi possível iniciar o pagamento. Consulte o suporte para retomar este pedido.",
      502,
    );
  await run(
    e,
    "UPDATE orders SET session_id=?,checkout_url=? WHERE id=?",
    d.id,
    d.url,
    r.id,
  );
  return json({ url: d.url, order: r.id });
}
