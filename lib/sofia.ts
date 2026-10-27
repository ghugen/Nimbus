import {
  body,
  clean,
  fail,
  json,
  now,
  rows,
  rate,
  type FeatureRuntime,
  type FeatureUser,
} from "./feature-db";
import { publicProducts } from "./catalog-services";
import { orderAccess } from "./licenses";
import {
  buildPlan,
  emptyProfile,
  todayAt,
  validDate,
  type SofiaProfile,
  type SofiaPlan,
} from "./sofia-core";
function profileValue(b: Record<string, unknown>): SofiaProfile {
  const value = {
    ...emptyProfile,
    course: clean(b.course, 120),
    topic: clean(b.topic, 160),
    goal: clean(b.goal, 20) || "understand",
    format: clean(b.format, 80),
    budget:
      b.budget === null || b.budget === undefined ? null : Number(b.budget),
    freeOnly: b.freeOnly === true,
    examDate: clean(b.examDate, 10),
    dailyMinutes: Number(b.dailyMinutes ?? 30),
    topics: clean(b.topics, 3000),
    time: clean(b.time, 5) || "19:00",
    timezone: clean(b.timezone, 80) || "America/Sao_Paulo",
  };
  try {
    todayAt(value.timezone);
  } catch {
    fail("Fuso horário inválido.");
  }
  if (
    (value.budget !== null &&
      (!Number.isSafeInteger(value.budget) ||
        value.budget < 0 ||
        value.budget > 1000000)) ||
    !["understand", "review", "practice"].includes(value.goal) ||
    !Number.isInteger(value.dailyMinutes) ||
    value.dailyMinutes < 10 ||
    value.dailyMinutes > 180 ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) ||
    (value.examDate &&
      (!validDate(value.examDate) || value.examDate < todayAt(value.timezone)))
  )
    fail("Confira orçamento, objetivo, minutos, horário e data da prova.");
  return value;
}
export async function sofia(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  if (path === "sofia-catalog" && method === "GET") {
    const products = (await publicProducts(e)).filter(
      (p) => !p.demo || p.public_download,
    );
    return json({
      total: products.length,
      limit: 500,
      materials: products.slice(0, 500).map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description.slice(0, 700),
        course: p.course,
        subject: p.subject,
        topic: p.topic,
        format: p.format,
        price: p.price,
        pages: p.pages,
      })),
      mode: "guided_rules",
      external_ai: false,
    });
  }
  if (!["sofia-profile", "sofia-context", "sofia-plan"].includes(path))
    return null;
  if (
    !["GET", "POST"].includes(method) ||
    (path === "sofia-context" && method !== "GET") ||
    (path === "sofia-plan" && method !== "POST")
  )
    fail("Método não permitido.", 405);
  const u = await auth(req);
  if (method === "POST") await rate(e, u.id, path, 30);
  const stored = (
    await rows(
      e,
      "SELECT profile,plan,plan_id,updated FROM sofia_settings WHERE user_id=?",
      u.id,
    )
  )[0];
  if (path === "sofia-profile" && method === "GET")
    return json({
      profile: stored ? JSON.parse(String(stored.profile)) : null,
      plan: stored ? JSON.parse(String(stored.plan)) : null,
      plan_id: stored?.plan_id || "",
      completed: await rows(
        e,
        "SELECT task_id FROM sofia_task_checks WHERE user_id=? AND plan_id=?",
        u.id,
        stored?.plan_id || "",
      ),
    });
  if (path === "sofia-context") {
    const timezone =
      clean(url.searchParams.get("timezone"), 80) || "America/Sao_Paulo";
    let today: string;
    try {
      today = todayAt(timezone);
    } catch {
      fail("Fuso horário inválido.");
    }

    const purchased = await rows(
      e,
      `SELECT i.product_id,i.title FROM order_items i JOIN orders o ON o.id=i.order_id WHERE ${orderAccess} AND o.status='paid' AND i.product_id NOT LIKE 'service:%' UNION SELECT a.product_id,a.title FROM order_assets a JOIN orders o ON o.id=a.order_id WHERE ${orderAccess} AND o.status='paid'`,
      u.id,
      u.id,
      u.id,
      u.id,
    );
    const subscriptions = await rows(
      e,
      "SELECT json_extract(a.value,'$.product_id') product_id,json_extract(a.value,'$.title') title FROM subscriptions s,json_each(s.assets) a WHERE s.user_id=? AND s.status='active' AND s.expires>?",
      u.id,
      now(),
    );
    const ids = [
        ...new Set(
          [...purchased, ...subscriptions].map((p) => String(p.product_id)),
        ),
      ].slice(0, 150),
      list = JSON.stringify(ids);
    const [states, progress, due] = await Promise.all([
      rows(
        e,
        "SELECT product_id,page,next_review,updated FROM reader_states WHERE user_id=? AND product_id IN(SELECT value FROM json_each(?))",
        u.id,
        list,
      ),
      rows(
        e,
        "SELECT product_id,progress FROM study WHERE user_id=? AND product_id IN(SELECT value FROM json_each(?))",
        u.id,
        list,
      ),
      rows(
        e,
        "SELECT product_id,COUNT(*) n FROM (SELECT product_id,card_id FROM adaptive_reviews WHERE user_id=? AND product_id IN(SELECT value FROM json_each(?)) AND due<=? UNION SELECT product_id,card_id FROM card_reviews WHERE user_id=? AND product_id IN(SELECT value FROM json_each(?)) AND due<=?) GROUP BY product_id",
        u.id,
        list,
        today,
        u.id,
        list,
        today,
      ),
    ]);
    const items = new Map(
        [...purchased, ...subscriptions].map((p) => [String(p.product_id), p]),
      ),
      stateMap = new Map(states.map((s) => [String(s.product_id), s])),
      progressMap = new Map(progress.map((s) => [String(s.product_id), s])),
      dueMap = new Map(due.map((s) => [String(s.product_id), s]));
    const library = ids.map((id) => ({
      id,
      title: String(items.get(id)?.title || ""),
      page: Number(stateMap.get(id)?.page || 1),
      next_review: String(stateMap.get(id)?.next_review || ""),
      updated: String(stateMap.get(id)?.updated || ""),
      progress: Number(progressMap.get(id)?.progress || 0),
      due_cards: Number(dueMap.get(id)?.n || 0),
    }));

    return json({
      library: library.sort((a, b) =>
        String(b.updated).localeCompare(String(a.updated)),
      ),
      limit: 150,
      today,
      notice:
        "Somente os materiais com acesso atual. Não inclui o texto das suas anotações.",
    });
  }
  const b = await body(req);
  if (path === "sofia-profile") {
    if (b.action === "clear") {
      if (b.confirm !== true) fail("Confirme a exclusão dos dados da Sofia.");
      await e.DB.batch([
        e.DB.prepare("DELETE FROM sofia_settings WHERE user_id=?").bind(u.id),
        e.DB.prepare("DELETE FROM sofia_task_checks WHERE user_id=?").bind(
          u.id,
        ),
      ]);
      return json({ ok: true });
    }
    if (b.remember !== true)
      fail("Escolha lembrar preferências antes de salvar.");
    const profile = profileValue(b);
    await e.DB.prepare(
      "INSERT INTO sofia_settings(user_id,profile,updated) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET profile=excluded.profile,updated=excluded.updated",
    )
      .bind(u.id, JSON.stringify(profile), now())
      .run();
    return json({ ok: true });
  }
  if (b.action === "check") {
    if (!stored || stored.plan_id !== b.plan_id)
      fail("Este plano foi atualizado. Reabra a Sofia.", 409);
    const plan = JSON.parse(String(stored.plan)) as SofiaPlan,
      task = clean(b.task_id, 80);
    if (!Array.isArray(plan.tasks) || !plan.tasks.some((t) => t.id === task))
      fail("Tarefa não encontrada.", 404);
    const key = u.id + ":" + stored.plan_id + ":" + task;
    if (b.completed === true)
      await e.DB.prepare(
        "INSERT OR IGNORE INTO sofia_task_checks(id,user_id,plan_id,task_id,created) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sofia_settings WHERE user_id=? AND plan_id=?)",
      )
        .bind(key, u.id, stored.plan_id, task, now(), u.id, stored.plan_id)
        .run();
    else
      await e.DB.prepare(
        "DELETE FROM sofia_task_checks WHERE id=? AND user_id=?",
      )
        .bind(key, u.id)
        .run();
    return json({ ok: true });
  }
  if (b.action !== "save") fail("Ação inválida.");
  const profile = profileValue(b);
  if (b.preview_start && b.preview_start !== todayAt(profile.timezone))
    fail("O dia mudou. Prepare uma nova prévia antes de salvar.", 409);
  let plan: SofiaPlan;
  try {
    plan = buildPlan(profile);
  } catch (err) {
    fail((err as Error).message);
  }
  const id = crypto.randomUUID();
  await e.DB.batch([
    e.DB.prepare(
      "INSERT INTO sofia_settings(user_id,plan,plan_id,updated) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,plan_id=excluded.plan_id,updated=excluded.updated",
    ).bind(u.id, JSON.stringify(plan), id, now()),
    e.DB.prepare("DELETE FROM sofia_task_checks WHERE user_id=?").bind(u.id),
  ]);
  return json({ ok: true, plan, plan_id: id });
}
