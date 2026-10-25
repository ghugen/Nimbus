import { commercialIdeas } from "./commercial-ideas";
import type { StoreRuntime } from "./catalog-services";
import { publicProducts, publicDTO, entitlement } from "./catalog-services";
import { notify, deliver, type NotificationRuntime } from "./notifications";
type Runtime = StoreRuntime & NotificationRuntime;
type User = { id: string; admin: boolean };
const json = (d: unknown) =>
    Response.json(d, { headers: { "Cache-Control": "no-store" } }),
  now = () => new Date().toISOString();
const clean = (v: unknown, n = 500) =>
  typeof v === "string" ? v.trim().slice(0, n) : "";
function fail(s: string, status = 400): never {
  throw Object.assign(new Error(s), { status });
}
async function rows<T = Record<string, unknown>>(
  e: Runtime,
  s: string,
  ...a: unknown[]
) {
  return (
    await e.DB.prepare(s)
      .bind(...a)
      .all<T>()
  ).results;
}
type Coupon = {
  code: string;
  kind: string;
  value: number;
  min_total: number;
  max_uses: number;
  starts: string;
  ends: string;
  active: number;
};
export async function couponQuote(
  e: Runtime,
  code: string,
  items: { id: string; price: number; owned?: number }[],
  userId: string,
) {
  const c = (
    await rows<Coupon>(
      e,
      "SELECT * FROM coupons WHERE code=?",
      code.trim().toUpperCase(),
    )
  )[0];
  if (!c || !c.active || now() < c.starts || now() > c.ends)
    fail("Cupom inválido, inativo ou fora da validade.");
  const uses = await rows(
    e,
    "SELECT c.order_id,c.user_id FROM coupon_uses c JOIN orders o ON o.id=c.order_id WHERE c.code=? AND o.status NOT IN ('failed','expired')",
    c.code,
  );
  if (uses.length >= c.max_uses) fail("Limite de usos atingido.", 409);
  if (uses.some((x) => x.user_id === userId))
    fail("Você já utilizou este cupom.", 409);
  const eligible = items.filter((p) => p.owned === 1 && p.price > 0),
    base = eligible.reduce((s, p) => s + p.price, 0);
  if (!base || base < c.min_total)
    fail(
      "O cupom não se aplica ao acervo próprio deste carrinho ou ao valor mínimo.",
    );
  const discount = Math.min(
    base,
    c.kind === "percent" ? Math.floor((base * c.value) / 100) : c.value,
  );
  const amounts = new Map(items.map((p) => [p.id, p.price]));
  const parts = eligible.map((p) => ({
    p,
    d: Math.floor((discount * p.price) / base),
    fraction: (discount * p.price) % base,
  }));
  let remaining = discount - parts.reduce((s, x) => s + x.d, 0);
  for (const x of [...parts].sort((a, b) => b.fraction - a.fraction)) {
    if (remaining > 0 && x.d < x.p.price) {
      x.d++;
      remaining--;
    }
  }
  for (const x of parts) amounts.set(x.p.id, x.p.price - x.d);
  return {
    code: c.code,
    discount,
    total: items.reduce((s, p) => s + p.price, 0) - discount,
    amounts,
  };
}
export const veterinaryCollections = [
  ["patologia-veterinaria", "Patologia Veterinária", "Patologia"],
  ["toxicologia-veterinaria", "Toxicologia e intoxicações", "Toxicologia"],
  ["doencas-dos-suinos", "Doenças dos Suínos", "Doenças dos Suínos"],
].map(([slug, title, subject]) => ({
  slug,
  title,
  description:
    "Resumos, questões e mapas para organizar a revisão por disciplina.",
  course: "Medicina Veterinária",
  subject,
  product_ids: "[]",
  published: 1,
}));
export async function growth(
  req: Request,
  e: Runtime,
  auth: (r: Request) => Promise<User>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  const body = async () => (await req.json()) as Record<string, unknown>;
  const run = async (s: string, ...a: unknown[]) =>
    e.DB.prepare(s)
      .bind(...a)
      .run();
  if (path === "commercial-plan") {
    const u = await auth(req);
    if (!u.admin) fail("Acesso restrito à administração.", 403);
    if (method === "GET") {
      const saved = await rows(e, "SELECT * FROM commercial_plan");
      return json({
        ideas: commercialIdeas.map((i) => ({
          ...i,
          status: "evaluate",
          priority: "normal",
          notes: "",
          ...saved.find((x) => x.id === i.id),
        })),
      });
    }
    const b = await body();
    if (
      !commercialIdeas.some((x) => x.id === b.id) ||
      !["evaluate", "planned", "producing", "available", "postponed"].includes(
        String(b.status),
      ) ||
      !["low", "normal", "high"].includes(String(b.priority))
    )
      fail("Ideia ou estado inválido.");
    await run(
      "INSERT INTO commercial_plan(id,status,priority,notes,updated) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,priority=excluded.priority,notes=excluded.notes,updated=excluded.updated",
      b.id,
      b.status,
      b.priority,
      clean(b.notes, 5000),
      now(),
    );
    return json({ ok: true });
  }
  if (path === "collections" && method === "GET") {
    const stored = await rows(e, "SELECT * FROM collections");
    const all = [
      ...stored.filter((c) => c.published === 1),
      ...veterinaryCollections.filter(
        (c) => !stored.some((x) => x.slug === c.slug),
      ),
    ];
    const products = await publicProducts(e);
    return json({
      collections: all.map((c) => ({
        ...c,
        products: products
          .filter((p) => {
            const ids = JSON.parse(String(c.product_ids || "[]")) as string[];
            return ids.length
              ? ids.includes(p.id)
              : p.course === c.course &&
                  p.subject
                    .toLowerCase()
                    .includes(String(c.subject).toLowerCase());
          })
          .map(publicDTO),
      })),
    });
  }
  if (path === "collections-admin") {
    const u = await auth(req);
    if (!u.admin) fail("Acesso negado.", 403);
    if (method === "GET")
      return json({
        collections: await rows(
          e,
          "SELECT * FROM collections ORDER BY created DESC",
        ),
      });
    const b = await body(),
      slug = clean(b.slug, 70),
      ids = b.product_ids;
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      !Array.isArray(ids) ||
      ids.length > 100 ||
      ids.some((id) => typeof id !== "string")
    )
      fail("Coleção inválida.");
    if (clean(b.title).length < 4) fail("Informe um título.");
    await run(
      "INSERT INTO collections(slug,title,description,course,subject,product_ids,published,created) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET title=excluded.title,description=excluded.description,course=excluded.course,subject=excluded.subject,product_ids=excluded.product_ids,published=excluded.published",
      slug,
      clean(b.title, 100),
      clean(b.description, 2000),
      clean(b.course, 100),
      clean(b.subject, 100),
      JSON.stringify(ids),
      b.published === true ? 1 : 0,
      now(),
    );
    return json({ ok: true });
  }
  if (path === "coupon-quote" && method === "POST") {
    const u = await auth(req),
      b = await body();
    if (
      !Array.isArray(b.ids) ||
      b.ids.length > 30 ||
      b.ids.some((x) => typeof x !== "string")
    )
      fail("Carrinho inválido.");
    const products = await publicProducts(e),
      items = [...new Set(b.ids)].map(
        (id) =>
          products.find((p) => p.id === id) || fail("Material indisponível."),
      );
    const q = await couponQuote(e, clean(b.code, 40), items, u.id);
    return json({ code: q.code, discount: q.discount, total: q.total });
  }
  if (path === "coupons") {
    const u = await auth(req);
    if (!u.admin) fail("Acesso negado.", 403);
    if (method === "GET")
      return json({
        coupons: await rows(
          e,
          "SELECT c.*,(SELECT COUNT(*) FROM coupon_uses x JOIN orders o ON o.id=x.order_id WHERE x.code=c.code AND o.status NOT IN ('failed','expired')) uses FROM coupons c ORDER BY created DESC",
        ),
      });
    const b = await body(),
      code = clean(b.code, 40).toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) fail("Código inválido.");
    if (b.action === "toggle") {
      await run(
        "UPDATE coupons SET active=? WHERE code=?",
        b.active === true ? 1 : 0,
        code,
      );
      return json({ ok: true });
    }
    const value = Number(b.value),
      minimum = Number(b.min_total || 0),
      max = Number(b.max_uses),
      starts = clean(b.starts, 30),
      ends = clean(b.ends, 30);
    if (
      !["percent", "fixed"].includes(String(b.kind)) ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > (b.kind === "percent" ? 100 : 1000000) ||
      !Number.isSafeInteger(minimum) ||
      minimum < 0 ||
      !Number.isSafeInteger(max) ||
      max < 1 ||
      max > 100000 ||
      !Number.isFinite(Date.parse(starts)) ||
      !Number.isFinite(Date.parse(ends)) ||
      starts >= ends
    )
      fail("Confira desconto, validade e limite.");
    if ((await rows(e, "SELECT code FROM coupons WHERE code=?", code)).length)
      fail(
        "Código já cadastrado. Crie outro código para novas condições.",
        409,
      );
    await run(
      "INSERT INTO coupons(code,kind,value,min_total,max_uses,starts,ends,active,created) VALUES(?,?,?,?,?,?,?,?,?)",
      code,
      b.kind,
      value,
      minimum,
      max,
      new Date(starts).toISOString(),
      new Date(ends).toISOString(),
      1,
      now(),
    );
    return json({ ok: true });
  }
  if (path === "material-requests") {
    const u = await auth(req);
    if (method === "GET")
      return json({
        requests: await rows(
          e,
          `SELECT id,course,subject,description,status,response,created FROM material_requests ${u.admin ? "" : "WHERE user_id=?"} ORDER BY created DESC LIMIT 200`,
          ...(u.admin ? [] : [u.id]),
        ),
      });
    const b = await body();
    if (b.action === "respond") {
      if (!u.admin) fail("Acesso negado.", 403);
      if (
        !["open", "planned", "completed", "declined"].includes(
          String(b.status),
        ) ||
        clean(b.response).length < 5
      )
        fail("Informe status e resposta.");
      const r = (
        await rows(
          e,
          "SELECT * FROM material_requests WHERE id=?",
          clean(b.id, 100),
        )
      )[0];
      if (!r) fail("Pedido não encontrado.", 404);
      await run(
        "UPDATE material_requests SET status=?,response=? WHERE id=?",
        b.status,
        clean(b.response, 3000),
        r.id,
      );
      const id = crypto.randomUUID();
      await notify(
        e,
        id,
        String(r.user_id),
        "Retorno sobre sua sugestão",
        clean(b.response, 3000),
        "/#interesses",
      );
      await deliver(e, id);
      return json({ ok: true });
    }
    if (
      clean(b.description).length < 15 ||
      clean(b.course).length < 2 ||
      clean(b.subject).length < 2
    )
      fail("Informe curso, disciplina e o material desejado.");
    if (
      (
        await rows(
          e,
          "SELECT id FROM material_requests WHERE user_id=? AND created>=?",
          u.id,
          now().slice(0, 10),
        )
      ).length >= 5
    )
      fail("Limite diário de cinco sugestões atingido.", 429);
    await run(
      "INSERT INTO material_requests(id,user_id,course,subject,description,created) VALUES(?,?,?,?,?,?)",
      crypto.randomUUID(),
      u.id,
      clean(b.course, 100),
      clean(b.subject, 100),
      clean(b.description, 3000),
      now(),
    );
    return json({ ok: true });
  }
  if (path === "content-issues") {
    const u = await auth(req);
    if (method === "GET") {
      const scope = url.searchParams.get("scope");
      return json({
        issues: await rows(
          e,
          `SELECT x.id,x.product_id,x.page,x.message,x.status,x.response,x.created,p.title FROM content_issues x JOIN products p ON p.id=x.product_id ${u.admin ? "" : scope === "author" ? "WHERE p.author_id=?" : "WHERE x.user_id=?"} ORDER BY x.created DESC LIMIT 200`,
          ...(u.admin ? [] : [u.id]),
        ),
      });
    }
    const b = await body();
    if (b.action === "respond") {
      const r = (
        await rows(
          e,
          "SELECT x.*,p.author_id FROM content_issues x JOIN products p ON p.id=x.product_id WHERE x.id=?",
          clean(b.id, 100),
        )
      )[0];
      if (!r || (!u.admin && r.author_id !== u.id)) fail("Acesso negado.", 403);
      if (
        !["open", "in_progress", "resolved", "declined"].includes(
          String(b.status),
        ) ||
        clean(b.response).length < 5
      )
        fail("Informe status e resposta.");
      await run(
        "UPDATE content_issues SET status=?,response=?,updated=? WHERE id=?",
        b.status,
        clean(b.response, 3000),
        now(),
        r.id,
      );
      const id = crypto.randomUUID();
      await notify(
        e,
        id,
        String(r.user_id),
        "Retorno sobre o conteúdo",
        clean(b.response, 3000),
        "/#correcoes",
      );
      await deliver(e, id);
      return json({ ok: true });
    }
    const productId = clean(b.product_id, 100);
    if (!(await entitlement(e, u.id, productId)))
      fail("Você precisa ter adquirido o material.", 403);
    if (clean(b.page, 100).length < 1 || clean(b.message).length < 15)
      fail("Indique a página e descreva o problema.");
    if (
      (
        await rows(
          e,
          "SELECT id FROM content_issues WHERE user_id=? AND created>=?",
          u.id,
          now().slice(0, 10),
        )
      ).length >= 10
    )
      fail("Limite diário de dez relatos atingido.", 429);
    await run(
      "INSERT INTO content_issues(id,user_id,product_id,page,message,created,updated) VALUES(?,?,?,?,?,?,?)",
      crypto.randomUUID(),
      u.id,
      productId,
      clean(b.page, 100),
      clean(b.message, 3000),
      now(),
      now(),
    );
    const owner = (
      await rows(e, "SELECT author_id FROM products WHERE id=?", productId)
    )[0];
    if (owner) {
      const id = crypto.randomUUID();
      await notify(
        e,
        id,
        String(owner.author_id),
        "Sugestão de correção recebida",
        "Um comprador indicou uma possível correção no seu material.",
        "/#autores",
      );
      await deliver(e, id);
    }
    return json({ ok: true });
  }
  return null;
}
