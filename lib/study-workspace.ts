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
import { entitlement } from "./catalog-services";
export async function studyWorkspace(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  if (!["study-workspace", "study-session", "annotation-card"].includes(path))
    return null;
  if (
    !["GET", "POST"].includes(method) ||
    (path !== "study-workspace" && method !== "POST") ||
    (path === "study-workspace" && method !== "GET")
  )
    fail("Método não permitido.", 405);
  const u = await auth(req),
    b = method === "POST" ? await body(req) : null,
    id = clean(b?.product_id || url.searchParams.get("id"), 100);
  if (!(await entitlement(e, u.id, id)))
    fail("Adquira o material para estudar na sua biblioteca.", 403);
  if (method === "POST") await rate(e, u.id, path, 30);
  if (path === "study-workspace") {
    const [states, study, annotations, sessions, reviews] = await Promise.all([
      rows(
        e,
        "SELECT page,zoom,next_review FROM reader_states WHERE id=?",
        u.id + ":" + id,
      ),
      rows(e, "SELECT notes,progress FROM study WHERE id=?", u.id + ":" + id),
      rows(
        e,
        "SELECT id,page,kind,text FROM page_annotations WHERE user_id=? AND product_id=? ORDER BY page,created DESC LIMIT 500",
        u.id,
        id,
      ),
      rows(
        e,
        "SELECT id,started,finished,summary,page,progress,next_review FROM study_sessions WHERE user_id=? AND product_id=? ORDER BY started DESC LIMIT 20",
        u.id,
        id,
      ),
      rows(
        e,
        "SELECT card_id FROM adaptive_reviews WHERE user_id=? AND product_id=? AND due<=?",
        u.id,
        id,
        now().slice(0, 10),
      ),
    ]);
    return json({
      state: states[0] || { page: 1, zoom: 100, next_review: "" },
      study: study[0] || { notes: "", progress: 0 },
      annotations,
      sessions,
      due_cards: reviews.length,
    });
  }
  if (path === "annotation-card") {
    const annotation = (
      await rows(
        e,
        "SELECT * FROM page_annotations WHERE id=? AND user_id=? AND product_id=?",
        clean(b!.annotation_id, 100),
        u.id,
        id,
      )
    )[0];
    if (!annotation) fail("Anotação não encontrada.", 404);
    const key = u.id + ":" + annotation.id,
      prior = (
        await rows(e, "SELECT card_id FROM annotation_cards WHERE id=?", key)
      )[0];
    if (
      prior &&
      (
        await rows(
          e,
          "SELECT id FROM personal_cards WHERE id=? AND user_id=?",
          prior.card_id,
          u.id,
        )
      ).length
    )
      return json({ ok: true, already_created: true, card_id: prior.card_id });
    const front = clean(b!.front, 3000);
    if (front.length < 2) fail("Escreva a pergunta do cartão.");
    if (
      (
        await rows(
          e,
          "SELECT id FROM personal_cards WHERE user_id=? AND product_id=?",
          u.id,
          id,
        )
      ).length >= 300
    )
      fail("Limite de 300 cartões pessoais por material.");
    const cid = "annotation:" + annotation.id;
    await e.DB.batch([
      e.DB.prepare(
        "INSERT OR IGNORE INTO personal_cards(id,user_id,product_id,front,back,page,created) VALUES(?,?,?,?,?,?,?)",
      ).bind(
        cid,
        u.id,
        id,
        front,
        String(annotation.text),
        annotation.page,
        now(),
      ),
      e.DB.prepare(
        "INSERT INTO annotation_cards(id,user_id,product_id,annotation_id,card_id,created) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET card_id=excluded.card_id,created=excluded.created",
      ).bind(key, u.id, id, annotation.id, cid, now()),
    ]);
    return json({ ok: true, card_id: cid });
  }
  if (b!.action === "start") {
    const current = (
      await rows(
        e,
        "SELECT id,started,finished FROM study_sessions WHERE user_id=? AND product_id=? AND finished=''",
        u.id,
        id,
      )
    )[0];
    if (current) return json({ session: current, resumed: true });
    const sid = crypto.randomUUID(),
      started = now();
    try {
      await run(
        e,
        "INSERT INTO study_sessions(id,user_id,product_id,started) VALUES(?,?,?,?)",
        sid,
        u.id,
        id,
        started,
      );
    } catch (error) {
      const active = (
        await rows(
          e,
          "SELECT id,started,finished FROM study_sessions WHERE user_id=? AND product_id=? AND finished=''",
          u.id,
          id,
        )
      )[0];
      if (!active) throw error;
      return json({ session: active, resumed: true });
    }
    return json({ session: { id: sid, started, finished: "" } });
  }
  if (b!.action !== "finish") fail("Ação inválida.");
  const s = (
    await rows(
      e,
      "SELECT * FROM study_sessions WHERE id=? AND user_id=? AND product_id=?",
      clean(b!.session_id, 100),
      u.id,
      id,
    )
  )[0];
  if (!s) fail("Sessão não encontrada.", 404);
  if (s.finished) return json({ ok: true, already_finished: true });
  const page = Number(b!.page),
    progress = Number(b!.progress),
    due = clean(b!.next_review, 10);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 5000 ||
    !Number.isInteger(progress) ||
    progress < 0 ||
    progress > 100 ||
    (due &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(due) ||
        isNaN(Date.parse(due)) ||
        new Date(due).toISOString().slice(0, 10) !== due ||
        due < now().slice(0, 10)))
  )
    fail("Confira página, progresso e data da próxima revisão.");
  const token = crypto.randomUUID(),
    finished = now();
  await e.DB.batch([
    e.DB.prepare(
      "UPDATE study_sessions SET finished=?,finish_token=?,summary=?,page=?,progress=?,next_review=? WHERE id=? AND finished=''",
    ).bind(finished, token, clean(b!.summary, 3000), page, progress, due, s.id),
    e.DB.prepare(
      "INSERT INTO study(id,user_id,product_id,notes,progress) SELECT ?,?,?,CASE WHEN ?=1 THEN ? ELSE COALESCE((SELECT notes FROM study WHERE id=?),'') END,? WHERE EXISTS(SELECT 1 FROM study_sessions WHERE id=? AND finish_token=?) ON CONFLICT(id) DO UPDATE SET notes=excluded.notes,progress=excluded.progress",
    ).bind(
      u.id + ":" + id,
      u.id,
      id,
      typeof b!.notes === "string" ? 1 : 0,
      clean(b!.notes, 20000),
      u.id + ":" + id,
      progress,
      s.id,
      token,
    ),
    e.DB.prepare(
      "INSERT INTO reader_states(id,user_id,product_id,page,status,next_review,updated) SELECT ?,?,?,?,CASE WHEN ?=100 THEN 'completed' ELSE 'studying' END,?,? WHERE EXISTS(SELECT 1 FROM study_sessions WHERE id=? AND finish_token=?) ON CONFLICT(id) DO UPDATE SET page=excluded.page,next_review=excluded.next_review,updated=excluded.updated,status=excluded.status",
    ).bind(
      u.id + ":" + id,
      u.id,
      id,
      page,
      progress,
      due,
      finished,
      s.id,
      token,
    ),
  ]);
  return json({ ok: true });
}
