import { entitlement } from "./catalog-services";
import {
  body,
  clean,
  fail,
  json,
  now,
  rows,
  run,
  rate,
  type FeatureRuntime,
  type FeatureUser,
} from "./feature-db";
export async function learning(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  if (!["reader-state", "page-annotations", "library-tools"].includes(path))
    return null;
  const u = await auth(req);
  if (method !== "GET") await rate(e, u.id, path, 90);
  if (path === "library-tools" && method === "GET")
    return json({
      states: await rows(
        e,
        "SELECT product_id,page,zoom,folder,status,next_review,updated FROM reader_states WHERE user_id=? ORDER BY updated DESC",
        u.id,
      ),
      reviews: await rows(
        e,
        "SELECT r.product_id,r.next_review,r.folder,r.status FROM reader_states r WHERE r.user_id=? AND r.next_review!='' ORDER BY r.next_review",
        u.id,
      ),
    });
  const b = method === "GET" ? null : await body(req),
    id = clean(b?.product_id || url.searchParams.get("id"), 100);
  if (!(await entitlement(e, u.id, id)))
    fail("Adquira o material para utilizar suas ferramentas de estudo.", 403);
  if (path === "reader-state") {
    if (method === "GET")
      return json({
        state: (
          await rows(
            e,
            "SELECT product_id,page,zoom,folder,status,next_review,updated FROM reader_states WHERE id=?",
            u.id + ":" + id,
          )
        )[0] || {
          product_id: id,
          page: 1,
          zoom: 100,
          folder: "",
          status: "not_started",
          next_review: "",
        },
      });
    const previous =
      (
        await rows(e, "SELECT * FROM reader_states WHERE id=?", u.id + ":" + id)
      )[0] || {};
    const p = { ...previous, ...b },
      page = Number(p.page ?? 1),
      zoom = Number(p.zoom ?? 100),
      status = String(p.status || "not_started"),
      due = clean(p.next_review, 10);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 5000 ||
      !Number.isInteger(zoom) ||
      zoom < 50 ||
      zoom > 200 ||
      !["not_started", "studying", "completed"].includes(status) ||
      (due && !/^\d{4}-\d{2}-\d{2}$/.test(due))
    )
      fail("Página, zoom, estado ou data inválidos.");
    await run(
      e,
      "INSERT INTO reader_states(id,user_id,product_id,page,zoom,folder,status,next_review,updated) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET page=CASE WHEN ? THEN excluded.page ELSE reader_states.page END,zoom=CASE WHEN ? THEN excluded.zoom ELSE reader_states.zoom END,folder=CASE WHEN ? THEN excluded.folder ELSE reader_states.folder END,status=CASE WHEN ? THEN excluded.status ELSE reader_states.status END,next_review=CASE WHEN ? THEN excluded.next_review ELSE reader_states.next_review END,updated=excluded.updated",
      u.id + ":" + id,
      u.id,
      id,
      page,
      zoom,
      clean(p.folder, 60),
      status,
      due,
      now(),
      b!.page !== undefined ? 1 : 0,
      b!.zoom !== undefined ? 1 : 0,
      b!.folder !== undefined ? 1 : 0,
      b!.status !== undefined ? 1 : 0,
      b!.next_review !== undefined ? 1 : 0,
    );
    return json({ ok: true });
  }
  if (path === "page-annotations") {
    if (method === "GET")
      return json({
        annotations: await rows(
          e,
          "SELECT id,page,kind,text,created FROM page_annotations WHERE user_id=? AND product_id=? ORDER BY page,created DESC LIMIT 500",
          u.id,
          id,
        ),
      });
    if (b!.action === "delete") {
      await run(
        e,
        "DELETE FROM page_annotations WHERE id=? AND user_id=? AND product_id=?",
        clean(b!.id, 100),
        u.id,
        id,
      );
      return json({ ok: true });
    }
    const page = Number(b!.page),
      kind = String(b!.kind),
      text = clean(b!.text, 5000);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 5000 ||
      !["bookmark", "note", "highlight"].includes(kind) ||
      !text
    )
      fail("Informe página, tipo e anotação.");
    if (
      (
        await rows(
          e,
          "SELECT id FROM page_annotations WHERE user_id=? AND product_id=?",
          u.id,
          id,
        )
      ).length >= 500
    )
      fail("Limite de 500 anotações por material.");
    await run(
      e,
      "INSERT INTO page_annotations(id,user_id,product_id,page,kind,text,created) VALUES(?,?,?,?,?,?,?)",
      crypto.randomUUID(),
      u.id,
      id,
      page,
      kind,
      text,
      now(),
    );
    return json({ ok: true });
  }
  return null;
}
