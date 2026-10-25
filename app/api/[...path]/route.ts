import {
  policy,
  reconcile,
  financialReport,
  recordPayout,
  POLICY_VERSION,
} from "@/lib/finance";
import {
  normalizeProduct,
  areas,
  levels,
  languages,
  legacyTypes,
  fileTypes,
  fileMime,
} from "@/lib/taxonomy";
import { env } from "cloudflare:workers";
import { seed, categories, formats, type Product } from "@/lib/catalog";
import { parseCart, validProduct, verifyStripe } from "@/lib/commerce";
export const dynamic = "force-dynamic";
type Runtime = {
  DB: D1Database;
  BUCKET: R2Bucket;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  ADMIN_EMAILS?: string;
};
const runtime = () => env as unknown as Runtime;
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
type Body = {
  controller?: string;
  contact?: string;
  retention?: string;
  kind?: string;
  accepted_rate?: number;
  accepted_owned?: number;
  commission_bps?: number;
  owned?: boolean;
  commercial_accepted?: boolean;
  amount?: number;
  reference?: string;
  topic?: string;
  level?: string;
  language?: string;
  name: string;
  course: string;
  institution: string;
  id: string;
  active: boolean;
  accepted: boolean;
  ids: unknown;
  progress: number;
  notes: string;
  rating: number;
  comment: string;
  subject: string;
  message: string;
  title: string;
  rights: boolean;
  category: string;
  format: string;
  description: string;
  preview: string;
  price: number;
  pages: number;
  action: string;
  status: string;
  response: string;
  request_id?: string;
};
async function body(req: Request) {
  const value: unknown = await req.json();
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("Dados inválidos.");
  return value as Body;
}
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const clean = (v: unknown, max = 500) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
async function all<T = Record<string, unknown>>(
  sql: string,
  ...args: unknown[]
) {
  return (
    await runtime()
      .DB.prepare(sql)
      .bind(...args)
      .all<T>()
  ).results;
}
async function run(sql: string, ...args: unknown[]) {
  return runtime()
    .DB.prepare(sql)
    .bind(...args)
    .run();
}
function who(req: Request) {
  const id = req.headers.get("oai-authenticated-user-id"),
    email = req.headers.get("oai-authenticated-user-email");
  if (!id || !email) return null;
  let name =
    req.headers.get("oai-authenticated-user-full-name") || email.split("@")[0];
  if (
    req.headers.get("oai-authenticated-user-full-name-encoding") ===
    "percent-encoded-utf-8"
  ) {
    try {
      name = decodeURIComponent(name);
    } catch {}
  }
  return {
    id,
    email,
    name,
    admin: (runtime().ADMIN_EMAILS || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
      .includes(email.toLowerCase()),
  };
}
async function auth(req: Request) {
  const user = who(req);
  if (!user) fail("Entre na sua conta para continuar.", 401);
  await run(
    "INSERT INTO users (id,email,name,created) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email",
    user!.id,
    user!.email,
    user!.name,
    now(),
  );
  return user!;
}
async function admin(req: Request) {
  const u = await auth(req);
  if (!u.admin) fail("Acesso restrito à administração.", 403);
  return u;
}
async function log(user: string, action: string, target: string) {
  await run(
    "INSERT INTO audit (id,user_id,action,target,created) VALUES (?,?,?,?,?)",
    uid(),
    user,
    action,
    target,
    now(),
  );
}
async function catalog() {
  const db = await all<Product>("SELECT * FROM products");
  const map = new Map(seed.map((p) => [p.id, p]));
  db.forEach((p) => map.set(p.id, p));
  const ratings = await all<{
    product_id: string;
    rating: number;
    review_count: number;
  }>(
    "SELECT product_id,AVG(rating) rating,COUNT(*) review_count FROM reviews GROUP BY product_id",
  );
  const ownership = await all<{ id: string; owned: number }>(
    "SELECT u.id,COALESCE(a.owned,CASE WHEN instr(?,','||lower(u.email)||',')>0 THEN 1 ELSE 0 END) owned FROM users u LEFT JOIN author_accounts a ON a.id=u.id",
    "," + (runtime().ADMIN_EMAILS || "").toLowerCase() + ",",
  );
  return [...map.values()].map((p) => ({
    owned: ownership.find((x) => x.id === p.author_id)?.owned || 0,
    ...normalizeProduct(p),
    rating: ratings.find((r) => r.product_id === p.id)?.rating || 0,
    review_count: ratings.find((r) => r.product_id === p.id)?.review_count || 0,
  }));
}
async function purchased(user: string, id: string) {
  return (
    await all(
      "SELECT i.* FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.user_id=? AND o.status='paid' AND i.product_id=? LIMIT 1",
      user,
      id,
    )
  )[0];
}
async function dispatch(req: Request) {
  const url = new URL(req.url);
  const path = url.pathname.slice(5).split("/").filter(Boolean);
  const method = req.method;
  const { DB, BUCKET } = runtime();
  if (method !== "GET" && path[0] !== "webhook") {
    const origin = req.headers.get("origin");
    if (!origin || origin !== url.origin)
      fail("Origem da solicitação inválida.", 403);
  }
  if (path[0] === "privacy-info" && method === "GET") {
    return json({
      settings: (
        await all(
          "SELECT controller,contact,retention,updated FROM privacy_settings WHERE id=?",
          "nimbus",
        )
      )[0] || { controller: "", contact: "", retention: "" },
    });
  }
  if (path[0] === "privacy-export" && method === "GET") {
    const u = await auth(req);
    const profile = (await all("SELECT * FROM users WHERE id=?", u.id))[0];
    const data = {
      exported_at: now(),
      profile,
      orders: await all(
        "SELECT id,status,total,created FROM orders WHERE user_id=?",
        u.id,
      ),
      items: await all(
        "SELECT i.product_id,i.price,i.title,o.id order_id FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.user_id=?",
        u.id,
      ),
      favorites: await all(
        "SELECT product_id FROM favorites WHERE user_id=?",
        u.id,
      ),
      notes: await all(
        "SELECT product_id,notes,progress FROM study WHERE user_id=?",
        u.id,
      ),
      reviews: await all(
        "SELECT product_id,rating,comment,name,created FROM reviews WHERE user_id=?",
        u.id,
      ),
      tickets: await all(
        "SELECT subject,message,status,response,created FROM tickets WHERE user_id=?",
        u.id,
      ),
      privacy_requests: await all(
        "SELECT kind,message,status,response,created,updated FROM privacy_requests WHERE user_id=?",
        u.id,
      ),
      acceptances: await all(
        "SELECT kind,version,details,created FROM legal_acceptances WHERE user_id=?",
        u.id,
      ),
      publications: await all(
        "SELECT id,title,description,category,course,subject,topic,format,price,pages,author,preview,status,file_name,created,updated FROM products WHERE author_id=?",
        u.id,
      ),
      finances: await financialReport(runtime(), u.id),
    };
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=nimbus-meus-dados.json",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (path[0] === "privacy") {
    const u = await auth(req);
    if (method === "GET")
      return json({
        requests: await all(
          "SELECT * FROM privacy_requests WHERE user_id=? ORDER BY created DESC",
          u.id,
        ),
      });
    const b = await body(req);
    if (
      !["acesso", "correção", "exclusão", "oposição", "informações"].includes(
        b.kind || "",
      )
    )
      fail("Tipo de solicitação inválido.");
    if (clean(b.message, 4000).length < 10) fail("Descreva sua solicitação.");
    await run(
      "INSERT INTO privacy_requests(id,user_id,kind,message,created,updated) VALUES(?,?,?,?,?,?)",
      uid(),
      u.id,
      b.kind,
      clean(b.message, 4000),
      now(),
      now(),
    );
    return json({ ok: true });
  }
  if (path[0] === "privacy-admin") {
    const u = await admin(req);
    if (method === "GET")
      return json({
        settings: (
          await all("SELECT * FROM privacy_settings WHERE id=?", "nimbus")
        )[0] || { controller: "", contact: "", retention: "" },
        requests: await all(
          "SELECT p.*,u.name,u.email FROM privacy_requests p JOIN users u ON u.id=p.user_id ORDER BY p.created DESC",
        ),
      });
    const b = await body(req);
    if (b.action === "settings") {
      const contact = clean(b.contact, 200);
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ||
        clean(b.controller, 200).length < 3 ||
        clean(b.retention, 4000).length < 50
      )
        fail("Informe responsável, e-mail e critérios de retenção completos.");
      await run(
        "INSERT INTO privacy_settings(id,controller,contact,retention,updated) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET controller=excluded.controller,contact=excluded.contact,retention=excluded.retention,updated=excluded.updated",
        "nimbus",
        clean(b.controller, 200),
        contact,
        clean(b.retention, 4000),
        now(),
      );
      await log(u.id, "privacy.settings", "nimbus");
    } else if (b.action === "respond") {
      if (
        !["responded", "in_progress"].includes(b.status) ||
        clean(b.response, 5000).length < 10
      )
        fail("Informe status e resposta fundamentada.");
      await run(
        "UPDATE privacy_requests SET status=?,response=?,updated=? WHERE id=?",
        b.status,
        clean(b.response, 5000),
        now(),
        clean(b.id, 100),
      );
      await log(u.id, "privacy.responded", clean(b.id, 100));
    } else fail("Ação inválida.");
    return json({ ok: true });
  }
  if (path[0] === "catalog" && method === "GET") {
    const products = (await catalog())
      .filter((p) => p.status === "published")
      .map(
        ({
          file_key,
          file_name,
          author_id,
          accepted_bps,
          accepted_owned,
          ...p
        }) => p,
      );
    return json({ products, payments: !!runtime().STRIPE_SECRET_KEY });
  }
  if (path[0] === "me" && method === "GET") {
    const u = who(req);
    if (!u) return json({ user: null });
    await auth(req);
    const profile = (await all("SELECT * FROM users WHERE id=?", u.id))[0];
    const favorites = await all(
      "SELECT product_id FROM favorites WHERE user_id=?",
      u.id,
    );
    return json({
      user: { ...profile, admin: u.admin },
      favorites: favorites.map((f) => f.product_id),
    });
  }
  if (path[0] === "profile" && method === "POST") {
    const u = await auth(req),
      b = await body(req);
    const name = clean(b.name, 100);
    if (name.length < 2) fail("Informe seu nome.");
    await run(
      "UPDATE users SET name=?,course=?,institution=? WHERE id=?",
      name,
      clean(b.course, 100),
      clean(b.institution, 150),
      u.id,
    );
    return json({ ok: true });
  }
  if (path[0] === "favorites" && method === "POST") {
    const u = await auth(req),
      b = await body(req),
      id = clean(b.id, 100);
    if (!(await catalog()).some((p) => p.id === id && p.status === "published"))
      fail("Material não encontrado.", 404);
    const key = `${u.id}:${id}`;
    if (b.active)
      await run(
        "INSERT OR IGNORE INTO favorites(id,user_id,product_id) VALUES(?,?,?)",
        key,
        u.id,
        id,
      );
    else await run("DELETE FROM favorites WHERE id=?", key);
    return json({ ok: true });
  }
  if (path[0] === "checkout" && method === "POST") {
    const u = await auth(req),
      b = await body(req);
    if (b.accepted !== true) fail("Confirme que leu as condições da compra.");
    if (b.request_id && !/^[a-f0-9-]{36}$/i.test(b.request_id))
      fail("Identificador de checkout inválido.");
    const requestHash = b.request_id
      ? Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(u.id + ":" + b.request_id),
            ),
          ),
        )
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("")
      : uid();
    const previous = (
      await all<{
        id: string;
        status: string;
        total: number;
        checkout_url: string;
      }>("SELECT * FROM orders WHERE id=? AND user_id=?", requestHash, u.id)
    )[0];
    if (previous) {
      if (previous.status === "paid")
        return json({
          ok: true,
          order: previous.id,
          free: previous.total === 0,
        });
      if (previous.checkout_url && previous.status === "pending")
        return json({ url: previous.checkout_url, order: previous.id });
      fail(
        "Este checkout está sendo processado ou foi encerrado. Atualize seu carrinho para tentar novamente.",
        409,
      );
    }
    const ids = parseCart(b.ids);
    const products = await catalog();
    const selected = ids.map(
      (id) =>
        products.find((p) => p.id === id && p.status === "published") ||
        fail("Um material não está mais disponível.", 409),
    );
    for (const p of selected) {
      if (await purchased(u.id, p.id)) fail(`Você já possui: ${p.title}`, 409);
      if (p.price > 0 && (p.demo || !p.file_key))
        fail("Este material é demonstrativo e ainda não está à venda.", 409);
      if (p.file_key && !(await BUCKET.head(p.file_key)))
        fail("Arquivo indisponível. Entre em contato com o suporte.", 409);
    }
    const policies = new Map<string, Awaited<ReturnType<typeof policy>>>();
    for (const p of selected) {
      const rule = await policy(runtime(), p.author_id);
      policies.set(p.id, rule);
      if (
        !p.demo &&
        (p.accepted_bps !== (rule.owned ? 0 : rule.commission_bps) ||
          p.accepted_owned !== rule.owned)
      )
        fail(
          "O autor precisa confirmar as condições comerciais deste material.",
          409,
        );
    }
    const total = selected.reduce((s, p) => s + p.price, 0);
    if (total > 0 && !runtime().STRIPE_SECRET_KEY)
      fail(
        "Os pagamentos ainda não foram ativados. Você pode experimentar o guia gratuito.",
        503,
      );
    const id = requestHash;
    await run(
      "INSERT OR IGNORE INTO legal_acceptances(id,user_id,kind,version,details,created) VALUES(?,?,?,?,?,?)",
      id + ":purchase",
      u.id,
      "purchase_terms",
      "nimbus-terms-v2",
      JSON.stringify({ ids, total }),
      now(),
    );
    await DB.batch([
      DB.prepare(
        "INSERT INTO orders (id,user_id,status,total,created) VALUES(?,?,?,?,?)",
      ).bind(id, u.id, total === 0 ? "paid" : "pending", total, now()),
      ...selected.map((p) =>
        DB.prepare(
          "INSERT INTO order_items (id,order_id,product_id,price,title,file_key,file_name,content,author_id,commission_bps,owned,policy_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        ).bind(
          uid(),
          id,
          p.id,
          p.price,
          p.title,
          p.file_key,
          p.file_name,
          p.preview,
          p.author_id,
          policies.get(p.id)!.owned ? 0 : policies.get(p.id)!.commission_bps,
          policies.get(p.id)!.owned,
          POLICY_VERSION,
        ),
      ),
    ]);
    if (total === 0) {
      await reconcile(runtime(), id);
      return json({ ok: true, order: id, free: true });
    }
    const form = new URLSearchParams({
      mode: "payment",
      success_url: `${url.origin}/?payment=success&order=${id}#biblioteca`,
      cancel_url: `${url.origin}/?payment=cancelled#carrinho`,
      "metadata[order_id]": id,
      client_reference_id: id,
      customer_email: u.email,
    });
    selected.forEach((p, i) => {
      form.set(`line_items[${i}][price_data][currency]`, "brl");
      form.set(`line_items[${i}][price_data][unit_amount]`, String(p.price));
      form.set(`line_items[${i}][price_data][product_data][name]`, p.title);
      form.set(`line_items[${i}][quantity]`, "1");
    });
    const response = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${runtime().STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": id,
        },
        body: form,
      },
    );
    const session = (await response.json()) as { id?: string; url?: string };
    if (!response.ok || !session.id || !session.url) {
      await run("UPDATE orders SET status=? WHERE id=?", "failed", id);
      fail("Não foi possível iniciar o pagamento. Tente novamente.", 502);
    }
    await run(
      "UPDATE orders SET session_id=?,checkout_url=? WHERE id=?",
      session.id,
      session.url,
      id,
    );
    return json({ url: session.url, order: id });
  }
  if (path[0] === "webhook" && method === "POST") {
    const secret = runtime().STRIPE_WEBHOOK_SECRET;
    if (!secret) fail("Webhook não configurado.", 503);
    const raw = await req.text();
    if (
      !(await verifyStripe(
        raw,
        req.headers.get("stripe-signature") || "",
        secret,
      ))
    )
      fail("Assinatura inválida.", 400);
    const event = JSON.parse(raw),
      s = event.data?.object;
    const order = (
      await all<{ id: string; total: number; status: string }>(
        "SELECT * FROM orders WHERE id=? AND session_id=?",
        s?.metadata?.order_id || "",
        s?.id || "",
      )
    )[0];
    const affected =
      order?.id ||
      (s?.payment_intent
        ? (
            await all<{ id: string }>(
              "SELECT id FROM orders WHERE payment_intent=?",
              typeof s.payment_intent === "string"
                ? s.payment_intent
                : s.payment_intent.id,
            )
          )[0]?.id
        : null);
    if (
      affected &&
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "charge.refunded",
        "charge.dispute.created",
      ].includes(event.type)
    ) {
      await run(
        "INSERT OR REPLACE INTO finance_events(id,order_id,type,detail,created) VALUES(?,?,?,?,?)",
        affected + ":hold",
        affected,
        "hold",
        "Aguardando conciliação do provedor",
        now(),
      );
    }
    if (
      event.type === "charge.refunded" &&
      s.refunded === true &&
      s.payment_intent
    )
      await run(
        "UPDATE orders SET status=? WHERE payment_intent=? AND status=?",
        "refunded",
        s.payment_intent,
        "paid",
      );
    if (
      order &&
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type) &&
      s.payment_status === "paid" &&
      s.amount_total === order.total &&
      s.currency === "brl"
    )
      await run(
        "UPDATE orders SET status=?,payment_intent=? WHERE id=? AND status=?",
        "paid",
        s.payment_intent || null,
        order.id,
        "pending",
      );
    if (
      order &&
      [
        "checkout.session.expired",
        "checkout.session.async_payment_failed",
      ].includes(event.type)
    )
      await run(
        "UPDATE orders SET status=? WHERE id=? AND status=?",
        "failed",
        order.id,
        "pending",
      );
    if (
      affected &&
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "charge.refunded",
      ].includes(event.type)
    ) {
      try {
        await reconcile(runtime(), affected);
      } catch (e) {
        console.warn("Finance pending", affected, (e as Error).message);
      }
    }
    return json({ received: true });
  }
  if (path[0] === "library" && method === "GET") {
    const u = await auth(req);
    const items = await all(
      "SELECT i.product_id,i.title,i.file_name,o.created,o.id order_id FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.user_id=? AND o.status='paid' ORDER BY o.created DESC",
      u.id,
    );
    const progress = await all("SELECT * FROM study WHERE user_id=?", u.id);
    return json({
      items: items
        .filter(
          (v, i, a) => a.findIndex((x) => x.product_id === v.product_id) === i,
        )
        .map((x) => ({
          ...x,
          ...progress.find((s) => s.product_id === x.product_id),
        })),
    });
  }
  if (path[0] === "orders" && method === "GET") {
    const u = await auth(req);
    const orders = await all(
      "SELECT * FROM orders WHERE user_id=? ORDER BY created DESC",
      u.id,
    );
    const items = await all(
      "SELECT i.* FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.user_id=?",
      u.id,
    );
    return json({
      orders: orders.map((o) => ({
        ...o,
        items: items
          .filter((i) => i.order_id === o.id)
          .map((i) => ({ title: i.title, price: i.price })),
      })),
    });
  }
  if (path[0] === "download" && path[1] && method === "GET") {
    const u = await auth(req);
    const item = await purchased(u.id, path[1]);
    if (!item) fail("Adquira o material para acessar o arquivo.", 403);
    if (item.file_key) {
      const file = await BUCKET.get(String(item.file_key));
      if (!file) fail("Arquivo indisponível. Contate o suporte.", 404);
      return new Response(file.body, {
        headers: {
          "Content-Type": fileMime(String(item.file_name || "material.pdf")),
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(String(item.file_name || "material.pdf"))}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return new Response(String(item.content), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="nimbus-guia.txt"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (path[0] === "study" && method === "POST") {
    const u = await auth(req),
      b = await body(req),
      id = clean(b.id, 100);
    if (!(await purchased(u.id, id))) fail("Material não adquirido.", 403);
    const progress = Math.max(
      0,
      Math.min(100, Math.round(Number(b.progress) || 0)),
    );
    await run(
      "INSERT INTO study(id,user_id,product_id,notes,progress) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET notes=excluded.notes,progress=excluded.progress",
      `${u.id}:${id}`,
      u.id,
      id,
      clean(b.notes, 20000),
      progress,
    );
    return json({ ok: true });
  }
  if (path[0] === "reviews" && method === "GET")
    return json({
      reviews: await all(
        "SELECT rating,comment,name,created FROM reviews WHERE product_id=? ORDER BY created DESC",
        url.searchParams.get("id") || "",
      ),
    });
  if (path[0] === "reviews" && method === "POST") {
    const u = await auth(req),
      b = await body(req),
      id = clean(b.id, 100);
    if (!(await purchased(u.id, id)))
      fail("Apenas compradores podem avaliar.", 403);
    if (!Number.isInteger(b.rating) || b.rating < 1 || b.rating > 5)
      fail("Avaliação inválida.");
    const comment = clean(b.comment, 2000);
    if (comment.length < 10) fail("Escreva ao menos 10 caracteres.");
    const profile = (await all("SELECT name FROM users WHERE id=?", u.id))[0];
    await run(
      "INSERT INTO reviews(id,user_id,product_id,rating,comment,name,created) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET rating=excluded.rating,comment=excluded.comment",
      `${u.id}:${id}`,
      u.id,
      id,
      b.rating,
      comment,
      profile.name,
      now(),
    );
    return json({ ok: true });
  }
  if (path[0] === "tickets") {
    const u = await auth(req);
    if (method === "GET")
      return json({
        tickets: await all(
          "SELECT * FROM tickets WHERE user_id=? ORDER BY created DESC",
          u.id,
        ),
      });
    if (method === "POST") {
      const b = await body(req);
      if (clean(b.subject).length < 3 || clean(b.message).length < 10)
        fail("Descreva o assunto e a solicitação.");
      await run(
        "INSERT INTO tickets(id,user_id,subject,message,created) VALUES(?,?,?,?,?)",
        uid(),
        u.id,
        clean(b.subject, 150),
        clean(b.message, 5000),
        now(),
      );
      return json({ ok: true });
    }
  }
  if (path[0] === "author") {
    const u = await auth(req);
    if (method === "GET") {
      const products = (await catalog()).filter((p) => p.author_id === u.id);
      const sales = await all(
        "SELECT i.product_id,i.price,o.created FROM order_items i JOIN orders o ON o.id=i.order_id JOIN products p ON p.id=i.product_id WHERE p.author_id=? AND o.status='paid'",
        u.id,
      );
      return json({
        products,
        sales,
        policy: await policy(runtime(), u.id),
        finance: await financialReport(runtime(), u.id),
      });
    }
    if (method === "POST") {
      const b = await body(req);
      validProduct({ ...b });
      const terms = await policy(runtime(), u.id);
      if (
        b.accepted_rate !== (terms.owned ? 0 : terms.commission_bps) ||
        b.accepted_owned !== terms.owned
      )
        fail(
          "As condições comerciais mudaram. Atualize a página e confirme a nova regra.",
          409,
        );
      if (b.commercial_accepted !== true)
        fail("Confirme as condições comerciais antes de salvar.");
      if (b.rights !== true)
        fail("Confirme a autoria ou autorização de publicação.");
      const legacyCourse = Object.values(areas).flat().includes(b.category)
        ? b.category
        : "";
      const normalized = normalizeProduct({
        category: b.category,
        format: b.format,
        course: b.course || legacyCourse,
        level: b.level,
        language: b.language,
        created: now(),
      });
      b.category = normalized.category;
      b.format = normalized.format;
      if (
        !categories.slice(1).includes(b.category) ||
        !formats.includes(b.format)
      )
        fail("Área ou formato inválido.");
      if (
        !areas[b.category].includes(normalized.course) ||
        !levels.includes(normalized.level) ||
        !languages.includes(normalized.language)
      )
        fail("Curso, nível ou idioma inválido.");
      const id = clean(b.id, 100) || uid();
      const existing = (await catalog()).find((p) => p.id === id);
      if (existing && existing.author_id !== u.id) fail("Acesso negado.", 403);
      if (
        clean(b.description, 5000).length < 30 ||
        clean(b.preview, 20000).length < 50
      )
        fail("Inclua descrição e prévia mais completas.");
      const profile = (await all("SELECT name FROM users WHERE id=?", u.id))[0];
      if (existing)
        await run(
          "UPDATE products SET title=?,description=?,category=?,subject=?,format=?,price=?,pages=?,preview=?,status=? WHERE id=?",
          clean(b.title, 150),
          clean(b.description, 5000),
          b.category,
          clean(b.subject, 100),
          b.format,
          b.price,
          b.pages,
          clean(b.preview, 20000),
          "draft",
          id,
        );
      else
        await run(
          "INSERT INTO products(id,author_id,title,description,category,subject,format,price,pages,author,preview,status,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
          id,
          u.id,
          clean(b.title, 150),
          clean(b.description, 5000),
          b.category,
          clean(b.subject, 100),
          b.format,
          b.price,
          b.pages,
          profile.name,
          clean(b.preview, 20000),
          "draft",
          now(),
        );
      await run(
        "UPDATE products SET course=?,level=?,language=?,updated=?,topic=? WHERE id=?",
        normalized.course,
        normalized.level,
        normalized.language,
        now(),
        clean(b.topic, 120),
        id,
      );
      await run(
        "UPDATE products SET accepted_bps=?,accepted_owned=? WHERE id=?",
        terms.owned ? 0 : terms.commission_bps,
        terms.owned,
        id,
      );
      await run(
        "INSERT INTO legal_acceptances(id,user_id,kind,version,details,created) VALUES(?,?,?,?,?,?)",
        uid(),
        u.id,
        "author_terms",
        POLICY_VERSION,
        JSON.stringify({
          product: id,
          rate: terms.owned ? 0 : terms.commission_bps,
          owned: terms.owned,
        }),
        now(),
      );
      await log(u.id, "product.saved", id);
      return json({ ok: true, id });
    }
  }
  if (path[0] === "upload" && method === "POST") {
    const u = await auth(req),
      form = await req.formData(),
      id = clean(form.get("id"), 100),
      file = form.get("file");
    const product = (await catalog()).find((p) => p.id === id);
    if (!product || (product.author_id !== u.id && !u.admin))
      fail("Acesso negado.", 403);
    if (
      !(file instanceof File) ||
      file.size > 20 * 1024 * 1024 ||
      file.size < 5 ||
      !fileTypes.includes(file.name.split(".").pop()?.toUpperCase() || "")
    )
      fail("Envie um arquivo de formato aceito com até 20 MB.");
    const buffer = await file.arrayBuffer();
    if (
      file.name.toLowerCase().endsWith(".pdf") &&
      new TextDecoder().decode(buffer.slice(0, 5)) !== "%PDF-"
    )
      fail("Arquivo PDF inválido.");
    const key = `materials/${id}/${uid()}.${file.name.split(".").pop()?.toLowerCase()}`;
    await BUCKET.put(key, buffer, {
      httpMetadata: { contentType: fileMime(file.name) },
    });
    await run(
      "UPDATE products SET file_key=?,file_name=?,status=?,updated=? WHERE id=?",
      key,
      file.name.slice(0, 180),
      "pending",
      now(),
      id,
    );
    await log(u.id, "product.submitted", id);
    return json({ ok: true });
  }
  if (path[0] === "admin-file" && path[1] && method === "GET") {
    await admin(req);
    const p = (await catalog()).find((p) => p.id === path[1]);
    if (!p?.file_key) fail("Arquivo não encontrado.", 404);
    const file = await BUCKET.get(p.file_key);
    if (!file) fail("Arquivo não encontrado.", 404);
    return new Response(file.body, {
      headers: {
        "Content-Type": fileMime(p.file_name || "material.pdf"),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(p.file_name || "material")}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (path[0] === "finance") {
    const u = await admin(req);
    if (method === "GET") {
      const accounts = await all<{ id: string; email: string; name: string }>(
        "SELECT id,email,name FROM users",
      );
      return json({
        finance: await financialReport(runtime()),
        accounts: await Promise.all(
          accounts.map(async (a) => ({
            ...a,
            ...(await policy(runtime(), a.id)),
          })),
        ),
      });
    }
    const b = await body(req);
    if (b.action === "policy") {
      if (
        !Number.isInteger(b.commission_bps) ||
        b.commission_bps! < 0 ||
        b.commission_bps! > 10000 ||
        typeof b.owned !== "boolean"
      )
        fail("Comissão inválida.");
      if (!(await all("SELECT id FROM users WHERE id=?", b.id)).length)
        fail("Autor não encontrado.", 404);
      const old = await policy(runtime(), b.id);
      await DB.batch([
        DB.prepare(
          "INSERT INTO author_accounts(id,commission_bps,owned,updated) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET commission_bps=excluded.commission_bps,owned=excluded.owned,updated=excluded.updated",
        ).bind(b.id, b.commission_bps, b.owned ? 1 : 0, now()),
        DB.prepare(
          "UPDATE products SET status='draft' WHERE author_id=? AND (accepted_bps IS NULL OR accepted_bps!=? OR accepted_owned IS NULL OR accepted_owned!=?)",
        ).bind(b.id, b.owned ? 0 : b.commission_bps, b.owned ? 1 : 0),
      ]);
      await log(
        u.id,
        "author.policy",
        JSON.stringify({
          id: b.id,
          old,
          rate: b.commission_bps,
          owned: b.owned,
        }),
      );
    } else if (b.action === "reconcile") {
      await reconcile(runtime(), b.id);
      await log(u.id, "finance.reconciled", b.id);
    } else if (b.action === "payout") {
      const id = await recordPayout(
        runtime(),
        b.id,
        b.amount!,
        clean(b.reference, 180),
        u.id,
      );
      await log(u.id, "payout.recorded", id);
    } else fail("Ação inválida.");
    return json({ ok: true });
  }
  if (path[0] === "admin") {
    const u = await admin(req);
    if (method === "GET") {
      return json({
        products: await catalog(),
        users: await all(
          "SELECT id,name,email,created FROM users ORDER BY created DESC",
        ),
        orders: await all(
          "SELECT o.*,u.name,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created DESC",
        ),
        tickets: await all(
          "SELECT t.*,u.email FROM tickets t JOIN users u ON u.id=t.user_id ORDER BY t.created DESC",
        ),
        audit: await all("SELECT * FROM audit ORDER BY created DESC LIMIT 100"),
      });
    }
    if (method === "POST") {
      const b = await body(req);
      if (b.action === "product") {
        if (!["published", "rejected", "draft"].includes(b.status))
          fail("Status inválido.");
        const p = (await catalog()).find((p) => p.id === b.id);
        if (p && b.status === "published") {
          const terms = await policy(runtime(), p.author_id);
          if (
            p.accepted_bps !== (terms.owned ? 0 : terms.commission_bps) ||
            p.accepted_owned !== terms.owned
          )
            fail("O autor deve aceitar as condições comerciais atuais.", 409);
        }
        if (!p || p.demo || !p.file_key)
          fail("Apenas materiais reais com arquivo podem ser publicados.");
        await run("UPDATE products SET status=? WHERE id=?", b.status, p.id);
        await log(u.id, `product.${b.status}`, p.id);
      } else if (b.action === "ticket") {
        await run(
          "UPDATE tickets SET response=?,status=? WHERE id=?",
          clean(b.response, 5000),
          "closed",
          clean(b.id, 100),
        );
        await log(u.id, "ticket.responded", clean(b.id, 100));
      } else fail("Ação inválida.");
      return json({ ok: true });
    }
  }
  fail("Recurso não encontrado.", 404);
}
async function handler(req: Request) {
  try {
    if (Number(req.headers.get("content-length")) > 21 * 1024 * 1024)
      return json({ error: "Solicitação muito grande." }, 413);
    return await dispatch(req);
  } catch (e) {
    const error = e as Error & { status?: number };
    if (error.status) return json({ error: error.message }, error.status);
    if (e instanceof SyntaxError)
      return json({ error: "Dados inválidos." }, 400);
    if (
      [
        "Referência de repasse",
        "Valores financeiros",
        "Rateio",
        "Dados de repasse",
        "Saldo não liberado",
        "Pedido sem pagamento",
        "Pedido anterior",
        "Aguardando dados",
        "Pagamento sem taxa",
        "Taxa alterada",
        "Não foi possível consultar",
      ].some((x) => error.message.startsWith(x)) ||
      error.message.startsWith("Carrinho") ||
      error.message.includes("inválido") ||
      error.message.startsWith("Título") ||
      error.message.startsWith("Número")
    )
      return json({ error: error.message }, 400);
    console.error("Nimbus API error", error.message);
    return json(
      {
        error:
          "Não foi possível concluir. Tente novamente ou contate o suporte.",
      },
      500,
    );
  }
}
export const GET = handler;
export const POST = handler;
