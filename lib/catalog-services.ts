import { releaseDuePublications } from "./publication-schedule";
import { orderAccess } from "./licenses";
import { seed, type Product } from "./catalog";
import { normalizeProduct } from "./taxonomy";
export type StoreRuntime = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ADMIN_EMAILS?: string;
};
export type RichProduct = Product & {
  objectives?: string;
  toc?: string;
  sources?: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  cover_key?: string | null;
  preview_keys?: string;
  bundle_ids?: string;
  revision_notes?: string;
  author_slug?: string;
};
export function bundleIds(p: { bundle_ids?: string }) {
  try {
    const a: unknown = JSON.parse(p.bundle_ids || "[]");
    if (
      !Array.isArray(a) ||
      a.length > 20 ||
      a.some((x) => typeof x !== "string")
    )
      return [];
    return [...new Set(a)] as string[];
  } catch {
    return [];
  }
}
export function parseBundle(v: unknown) {
  if (
    !Array.isArray(v) ||
    v.length > 20 ||
    v.some((x) => typeof x !== "string" || x.length > 100)
  )
    throw Object.assign(new Error("Itens do kit inválidos."), { status: 400 });
  return [...new Set(v)] as string[];
}
export async function publicProducts(env: StoreRuntime) {
  await releaseDuePublications(env);
  const db = (
    await env.DB.prepare(
      "SELECT p.*,u.author_slug FROM products p LEFT JOIN users u ON u.id=p.author_id WHERE p.status='published'",
    ).all<RichProduct>()
  ).results;
  const hidden = (
    await env.DB.prepare("SELECT id FROM products").all<{ id: string }>()
  ).results.map((x) => x.id);
  const source = [...seed.filter((p) => !hidden.includes(p.id)), ...db].map(
    (p) => normalizeProduct(p),
  );
  const ratings = (
    await env.DB.prepare(
      "SELECT r.product_id,AVG(r.rating) rating,COUNT(*) review_count FROM reviews r LEFT JOIN review_moderation m ON m.review_id=r.id WHERE COALESCE(m.status,'visible')='visible' GROUP BY r.product_id",
    ).all<{ product_id: string; rating: number; review_count: number }>()
  ).results;
  const ownership = (
    await env.DB.prepare(
      "SELECT u.id,COALESCE(a.owned,CASE WHEN instr(?,','||lower(u.email)||',')>0 THEN 1 ELSE 0 END) owned FROM users u LEFT JOIN author_accounts a ON a.id=u.id",
    )
      .bind("," + (env.ADMIN_EMAILS || "").toLowerCase() + ",")
      .all<{ id: string; owned: number }>()
  ).results;
  return source.map((p) => ({
    owned: ownership.find((x) => x.id === p.author_id)?.owned || 0,
    ...p,
    rating: ratings.find((r) => r.product_id === p.id)?.rating || 0,
    review_count: ratings.find((r) => r.product_id === p.id)?.review_count || 0,
  }));
}
export async function publicProduct(env: StoreRuntime, id: string) {
  return (await publicProducts(env)).find((p) => p.id === id) || null;
}
export async function entitlement(
  env: StoreRuntime,
  userId: string,
  productId: string,
) {
  const direct = await env.DB.prepare(
    `SELECT i.* FROM order_items i JOIN orders o ON o.id=i.order_id WHERE ${orderAccess} AND o.status='paid' AND i.product_id=? LIMIT 1`,
  )
    .bind(userId, userId, productId)
    .first<Record<string, unknown>>();
  if (direct) return direct;
  const child = await env.DB.prepare(
    `SELECT a.* FROM order_assets a JOIN orders o ON o.id=a.order_id WHERE ${orderAccess} AND o.status='paid' AND a.product_id=? LIMIT 1`,
  )
    .bind(userId, userId, productId)
    .first<Record<string, unknown>>();
  if (child) return child;
  return env.DB.prepare(
    "SELECT json_extract(a.value,'$.product_id') product_id,json_extract(a.value,'$.title') title,json_extract(a.value,'$.file_key') file_key,json_extract(a.value,'$.file_name') file_name,json_extract(a.value,'$.content') content FROM subscriptions s,json_each(s.assets) a WHERE s.user_id=? AND s.status='active' AND s.expires>? AND json_extract(a.value,'$.product_id')=? LIMIT 1",
  )
    .bind(userId, new Date().toISOString(), productId)
    .first<Record<string, unknown>>();
}
export async function validateBundle(
  env: StoreRuntime,
  parentId: string,
  authorId: string,
  ids: string[],
) {
  if (!ids.length) return [];
  if (ids.length < 2 || ids.includes(parentId))
    throw Object.assign(
      new Error("O kit precisa de pelo menos dois materiais diferentes."),
      { status: 400 },
    );
  const result = [];
  for (const id of ids) {
    const p = await env.DB.prepare(
      "SELECT * FROM products WHERE id=? AND author_id=? AND status='published' AND demo=0",
    )
      .bind(id, authorId)
      .first<RichProduct>();
    if (!p || bundleIds(p).length || !p.file_key)
      throw Object.assign(
        new Error(
          "Kits aceitam apenas materiais publicados do mesmo autor, sem outros kits.",
        ),
        { status: 400 },
      );
    if (!(await env.BUCKET.head(p.file_key)))
      throw Object.assign(new Error("Um arquivo do kit está indisponível."), {
        status: 400,
      });
    result.push(p);
  }
  return result;
}
// DTO explícito para componentes públicos: não serializar chaves de R2 ou dados comerciais.
export function publicDTO(p: RichProduct): Product {
  return {
    public_download: p.public_download,
    id: p.id,
    author_id: "",
    title: p.title,
    description: p.description,
    category: p.category,
    course: p.course,
    subject: p.subject,
    topic: p.topic,
    format: p.format,
    price: p.price,
    pages: p.pages,
    author: p.author,
    preview: p.preview,
    status: "published",
    file_key: null,
    file_name: null,
    demo: p.demo,
    created: p.created,
    updated: p.updated,
    level: p.level,
    language: p.language,
    file_format: p.file_format,
    rating: p.rating,
    review_count: p.review_count,
    objectives: p.objectives,
    toc: p.toc,
    sources: p.sources,
    reviewed_by: p.reviewed_by,
    reviewed_at: p.reviewed_at,
    author_slug: p.author_slug,
    has_cover: !!p.cover_key,
    preview_count: JSON.parse(p.preview_keys || "[]").length,
    bundle_ids: p.bundle_ids,
  };
}
