import type { StoreRuntime } from "./catalog-services";
import type { NotificationRuntime } from "./notifications";
export type FeatureRuntime = StoreRuntime &
  NotificationRuntime & {
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
  };
export type FeatureUser = {
  id: string;
  email: string;
  name: string;
  admin: boolean;
};
export const now = () => new Date().toISOString();
export function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
export const clean = (v: unknown, n = 500) =>
  typeof v === "string" ? v.trim().slice(0, n) : "";
export const json = (v: unknown, status = 200) =>
  Response.json(v, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function body(req: Request) {
  const b: unknown = await req.json();
  if (!b || typeof b !== "object" || Array.isArray(b)) fail("Dados inválidos.");
  return b as Record<string, unknown>;
}
export async function rows<T = Record<string, unknown>>(
  e: FeatureRuntime,
  sql: string,
  ...args: unknown[]
) {
  return (
    await e.DB.prepare(sql)
      .bind(...args)
      .all<T>()
  ).results;
}
export async function run(e: FeatureRuntime, sql: string, ...args: unknown[]) {
  return e.DB.prepare(sql)
    .bind(...args)
    .run();
}
export async function owned(e: FeatureRuntime, user: FeatureUser, id: string) {
  const p = (await rows(e, "SELECT * FROM products WHERE id=?", id))[0];
  if (!p || (p.author_id !== user.id && !user.admin))
    fail("Material não encontrado ou acesso negado.", 403);
  return p;
}
export async function rate(
  e: FeatureRuntime,
  userId: string,
  key: string,
  max = 60,
) {
  await run(
    e,
    "DELETE FROM rate_buckets WHERE id IN (SELECT id FROM rate_buckets WHERE expires<? LIMIT 100)",
    now(),
  );
  const bucket = now().slice(0, 16),
    id = userId + ":" + key + ":" + bucket;
  await run(
    e,
    "INSERT INTO rate_buckets(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1",
    id,
    new Date(Date.now() + 3600000).toISOString(),
  );
  const r = (
    await rows<{ count: number }>(
      e,
      "SELECT count FROM rate_buckets WHERE id=?",
      id,
    )
  )[0];
  if (r.count > max)
    fail("Muitas tentativas. Aguarde um minuto e tente novamente.", 429);
}
export async function audit(
  e: FeatureRuntime,
  userId: string,
  action: string,
  target: string,
) {
  await run(
    e,
    "INSERT INTO audit(id,user_id,action,target,created) VALUES(?,?,?,?,?)",
    crypto.randomUUID(),
    userId,
    action,
    target,
    now(),
  );
}
export function escapeHtml(v: unknown) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function csv(rows: unknown[][]) {
  return (
    "\uFEFF" +
    rows
      .map((r) =>
        r
          .map(
            (v) =>
              '"' +
              String(v ?? "")
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(";"),
      )
      .join("\r\n")
  );
}
