import { hasPackage } from "./learning-products";
import type { RichProduct, StoreRuntime } from "./catalog-services";
import {
  bundleIds,
  parseBundle,
  publicProduct,
  validateBundle,
  entitlement,
} from "./catalog-services";
import { notify, deliver, type NotificationRuntime } from "./notifications";
import { fileMime } from "./taxonomy";
type User = { id: string; email: string; name: string; admin: boolean };
type Runtime = StoreRuntime &
  NotificationRuntime & {
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    CLERK_PUBLISHABLE_KEY?: string;
    CLERK_SECRET_KEY?: string;
  };
const now = () => new Date().toISOString(),
  uid = () => crypto.randomUUID();
const json = (v: unknown, status = 200) =>
  Response.json(v, { status, headers: { "Cache-Control": "no-store" } });
function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
const clean = (v: unknown, n = 500) =>
  typeof v === "string" ? v.trim().slice(0, n) : "";
async function body(req: Request) {
  const b: unknown = await req.json();
  if (!b || typeof b !== "object" || Array.isArray(b)) fail("Dados inválidos.");
  return b as Record<string, unknown>;
}
async function rows<T = Record<string, unknown>>(
  env: Runtime,
  sql: string,
  ...args: unknown[]
) {
  return (
    await env.DB.prepare(sql)
      .bind(...args)
      .all<T>()
  ).results;
}
async function run(env: Runtime, sql: string, ...args: unknown[]) {
  return env.DB.prepare(sql)
    .bind(...args)
    .run();
}
export async function extension(
  req: Request,
  env: Runtime,
  auth: (r: Request) => Promise<User>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5).split("/").filter(Boolean),
    method = req.method;
  if (path[0] === "config" && method === "GET")
    return json({
      clerkKey: env.CLERK_SECRET_KEY ? env.CLERK_PUBLISHABLE_KEY || null : null,
      emails: !!env.RESEND_API_KEY && !!env.EMAIL_FROM,
    });
  if (path[0] === "asset" && method === "GET") {
    const p = await publicProduct(env, path[1]);
    if (!p) fail("Material não encontrado.", 404);
    let key: string | null | undefined;
    if (path[2] === "cover") key = p.cover_key;
    else if (path[2] === "preview") {
      let keys: string[] = [];
      try {
        keys = JSON.parse(p.preview_keys || "[]");
      } catch {}
      key = keys[Number(path[3])];
    }
    if (!key) fail("Imagem não encontrada.", 404);
    const file = await env.BUCKET.get(key);
    if (!file) fail("Imagem não encontrada.", 404);
    return new Response(file.body, {
      headers: {
        "Content-Type": file.httpMetadata?.contentType || fileMime(key),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=300",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  }
  if (path[0] === "author-profile") {
    const u = await auth(req);
    if (method === "GET")
      return json({
        profile: (
          await rows(
            env,
            "SELECT author_slug,bio,credentials,public_name,profile_public FROM users WHERE id=?",
            u.id,
          )
        )[0],
      });
    const b = await body(req),
      slug = clean(b.slug, 60);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3)
      fail(
        "Use um endereço de autor com 3 a 60 letras minúsculas, números e hífens.",
      );
    if (
      (
        await rows(
          env,
          "SELECT id FROM users WHERE author_slug=? AND id!=?",
          slug,
          u.id,
        )
      ).length
    )
      fail("Endereço de autor já utilizado.", 409);
    const name = clean(b.public_name, 100);
    if (name.length < 2) fail("Informe seu nome público.");
    await run(
      env,
      "UPDATE users SET author_slug=?,public_name=?,bio=?,credentials=?,profile_public=? WHERE id=?",
      slug,
      name,
      clean(b.bio, 4000),
      clean(b.credentials, 2000),
      b.public === true ? 1 : 0,
      u.id,
    );
    await run(
      env,
      "UPDATE profile_verifications SET status='unverified',updated=? WHERE user_id=?",
      now(),
      u.id,
    );
    return json({ ok: true });
  }
  if (path[0] === "author-meta" && method === "POST") {
    const u = await auth(req),
      b = await body(req),
      id = clean(b.id, 100);
    const p = (
      await rows<RichProduct>(
        env,
        "SELECT * FROM products WHERE id=? AND author_id=?",
        id,
        u.id,
      )
    )[0];
    if (!p) fail("Material não encontrado.", 404);
    const ids = parseBundle(b.bundle_ids || []);
    const children = await validateBundle(env, id, u.id, ids);
    if (children.length && p.price > children.reduce((s, x) => s + x.price, 0))
      fail("O preço do kit não pode superar a soma dos materiais.");
    await run(
      env,
      "UPDATE products SET objectives=?,toc=?,sources=?,revision_notes=?,bundle_ids=?,reviewed_by=NULL,reviewed_at=NULL,status='draft',updated=? WHERE id=?",
      clean(b.objectives, 6000),
      clean(b.toc, 6000),
      clean(b.sources, 6000),
      clean(b.revision_notes, 4000),
      JSON.stringify(ids),
      now(),
      id,
    );
    return json({ ok: true });
  }
  if (path[0] === "asset-upload" && method === "POST") {
    const u = await auth(req),
      form = await req.formData(),
      id = clean(form.get("id"), 100),
      kind = clean(form.get("kind"), 20),
      file = form.get("file");
    const p = (
      await rows<RichProduct>(
        env,
        "SELECT * FROM products WHERE id=? AND author_id=?",
        id,
        u.id,
      )
    )[0];
    if (!p || !["cover", "preview"].includes(kind)) fail("Acesso negado.", 403);
    if (
      !(file instanceof File) ||
      file.size > 5 * 1024 * 1024 ||
      file.size < 12 ||
      !["image/png", "image/jpeg"].includes(file.type)
    )
      fail("Envie PNG ou JPG com até 5 MB.");
    const data = await file.arrayBuffer(),
      bytes = new Uint8Array(data);
    const png =
        bytes[0] === 137 &&
        bytes[1] === 80 &&
        bytes[2] === 78 &&
        bytes[3] === 71 &&
        bytes[4] === 13 &&
        bytes[5] === 10 &&
        bytes[6] === 26 &&
        bytes[7] === 10,
      jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!png && !jpg) fail("Imagem inválida.");
    if (kind === "preview" && JSON.parse(p.preview_keys || "[]").length >= 6)
      fail("Máximo de seis imagens de prévia.");
    const key = `images/${id}/${uid()}.${png ? "png" : "jpg"}`;
    await env.BUCKET.put(key, data, {
      httpMetadata: { contentType: png ? "image/png" : "image/jpeg" },
    });
    if (kind === "cover")
      await run(
        env,
        "UPDATE products SET cover_key=?,status='draft',reviewed_by=NULL,reviewed_at=NULL WHERE id=?",
        key,
        id,
      );
    else {
      const keys = JSON.parse(p.preview_keys || "[]") as string[];
      if (keys.length >= 6) fail("Máximo de seis imagens de prévia.");
      keys.push(key);
      await run(
        env,
        "UPDATE products SET preview_keys=?,status='draft',reviewed_by=NULL,reviewed_at=NULL WHERE id=?",
        JSON.stringify(keys),
        id,
      );
    }
    return json({ ok: true });
  }
  if (path[0] === "asset-remove" && method === "POST") {
    const u = await auth(req),
      b = await body(req),
      p = (
        await rows<RichProduct>(
          env,
          "SELECT * FROM products WHERE id=? AND author_id=?",
          clean(b.id, 100),
          u.id,
        )
      )[0];
    if (!p) fail("Acesso negado.", 403);
    if (b.kind === "cover")
      await run(
        env,
        "UPDATE products SET cover_key=NULL,status='draft',reviewed_by=NULL,reviewed_at=NULL WHERE id=?",
        p.id,
      );
    else {
      const keys = JSON.parse(p.preview_keys || "[]") as string[];
      const index = Number(b.index);
      if (!Number.isInteger(index) || index < 0 || index >= keys.length)
        fail("Prévia inválida.");
      keys.splice(index, 1);
      await run(
        env,
        "UPDATE products SET preview_keys=?,status='draft',reviewed_by=NULL,reviewed_at=NULL WHERE id=?",
        JSON.stringify(keys),
        p.id,
      );
    }
    return json({ ok: true });
  }
  if (path[0] === "submit" && method === "POST") {
    const u = await auth(req),
      b = await body(req),
      p = (
        await rows<RichProduct>(
          env,
          "SELECT * FROM products WHERE id=? AND author_id=?",
          clean(b.id, 100),
          u.id,
        )
      )[0];
    if (!p) fail("Acesso negado.", 403);
    if (!p.file_key && !bundleIds(p).length && !(await hasPackage(env, p.id)))
      fail("Envie o arquivo ou configure os materiais do kit.");
    await validateBundle(env, p.id, u.id, bundleIds(p));
    await run(env, "UPDATE products SET status='pending' WHERE id=?", p.id);
    return json({ ok: true });
  }
  if (path[0] === "versions" && method === "GET") {
    const u = await auth(req),
      id = url.searchParams.get("id") || "";
    if (!(await entitlement(env, u.id, id)))
      fail("Material não adquirido.", 403);
    return json({
      versions: await rows(
        env,
        "SELECT id,sequence,file_name,notes,released FROM product_versions WHERE product_id=? AND status='published' ORDER BY sequence DESC",
        id,
      ),
    });
  }
  if (path[0] === "version-download" && method === "GET") {
    const u = await auth(req);
    const v = (
      await rows<{ product_id: string; file_key: string; file_name: string }>(
        env,
        "SELECT * FROM product_versions WHERE id=? AND status='published'",
        path[1],
      )
    )[0];
    if (!v || !(await entitlement(env, u.id, v.product_id)))
      fail("Acesso negado.", 403);
    const file = await env.BUCKET.get(v.file_key);
    if (!file) fail("Arquivo indisponível.", 404);
    return new Response(file.body, {
      headers: {
        "Content-Type": fileMime(v.file_name),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(v.file_name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (path[0] === "notifications") {
    const u = await auth(req);
    if (method === "GET")
      return json({
        notifications: await rows(
          env,
          "SELECT id,title,message,href,read,created FROM notifications WHERE user_id=? ORDER BY created DESC LIMIT 100",
          u.id,
        ),
      });
    const b = await body(req);
    await run(
      env,
      "UPDATE notifications SET read=1 WHERE user_id=? AND id=?",
      u.id,
      clean(b.id, 200),
    );
    return json({ ok: true });
  }
  if (path[0] === "metric" && method === "POST") {
    const b = await body(req);
    if (
      b.consent !== true ||
      !["view", "preview", "cart"].includes(String(b.kind)) ||
      !/^[-a-f0-9]{36}$/i.test(String(b.visitor))
    )
      fail("Medição não autorizada ou evento inválido.");
    const id = clean(b.productId, 100);
    if (!(await publicProduct(env, id))) fail("Material não encontrado.", 404);
    const key = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(
            `${b.visitor}:${id}:${b.kind}:${now().slice(0, 10)}`,
          ),
        ),
      ),
    )
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    await run(
      env,
      "INSERT OR IGNORE INTO analytics_events(id,product_id,kind,created) VALUES(?,?,?,?)",
      key,
      id,
      String(b.kind),
      now(),
    );
    return json({ ok: true });
  }
  if (path[0] === "analytics" && method === "GET") {
    const u = await auth(req);
    const start = url.searchParams.get("from") || "2000-01-01",
      end = url.searchParams.get("to") || now().slice(0, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
      start > end
    )
      fail("Período inválido.");
    return json({
      metrics: await rows(
        env,
        `SELECT p.id,p.title,(SELECT COUNT(*) FROM analytics_events a WHERE a.product_id=p.id AND a.kind='view' AND a.created>=? AND a.created<?) views,(SELECT COUNT(*) FROM analytics_events a WHERE a.product_id=p.id AND a.kind='preview' AND a.created>=? AND a.created<?) previews,(SELECT COUNT(*) FROM analytics_events a WHERE a.product_id=p.id AND a.kind='cart' AND a.created>=? AND a.created<?) carts,(SELECT COUNT(*) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=p.id AND o.status='paid' AND o.created>=? AND o.created<?) purchases FROM products p ${u.admin ? "" : "WHERE p.author_id=?"} ORDER BY purchases DESC`,
        start,
        end + "T23:59:59.999Z",
        start,
        end + "T23:59:59.999Z",
        start,
        end + "T23:59:59.999Z",
        start,
        end + "T23:59:59.999Z",
        ...(u.admin ? [] : [u.id]),
      ),
    });
  }
  if (path[0] === "operations") {
    const u = await auth(req);
    if (!u.admin) fail("Acesso negado.", 403);
    if (method === "GET")
      return json({
        readiness: {
          payments: !!env.STRIPE_SECRET_KEY,
          webhook: !!env.STRIPE_WEBHOOK_SECRET,
          test_mode: env.STRIPE_SECRET_KEY?.startsWith("sk_test_") || false,
          email: !!env.RESEND_API_KEY && !!env.EMAIL_FROM,
          email_login: !!env.CLERK_SECRET_KEY && !!env.CLERK_PUBLISHABLE_KEY,
          privacy: !!(await env.DB.prepare(
            "SELECT id FROM privacy_settings WHERE id='nimbus' AND controller!='' AND contact!='' AND retention!=''",
          ).first()),
          last_webhook:
            (
              await rows(
                env,
                "SELECT kind,created FROM webhook_events ORDER BY created DESC LIMIT 1",
              )
            )[0] || null,
        },
        outbox: await rows(
          env,
          "SELECT e.id,e.subject,e.status,e.last_error,e.created,e.sent,u.name FROM email_outbox e JOIN users u ON u.id=e.user_id ORDER BY e.created DESC LIMIT 100",
        ),
      });
    const b = await body(req);
    if (b.action !== "retry_email") fail("Ação inválida.");
    return json(await deliver(env, clean(b.id, 200)));
  }
  return null;
}
