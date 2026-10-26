import {
  body,
  clean,
  fail,
  json,
  now,
  rows,
  run,
  rate,
  owned,
  audit,
  type FeatureRuntime,
  type FeatureUser,
} from "./feature-db";
import { entitlement, publicProducts } from "./catalog-services";
import type { Question, Card } from "./learning-products";
import { searchMatches } from "./search";
export function safeQuestion(q: Question) {
  const { correct, explanation, option_explanations, ...safe } = q;
  return safe;
}
function feedback(q: Question, a: unknown) {
  return {
    id: q.id,
    prompt: q.prompt,
    topic: q.topic || "Geral",
    difficulty: q.difficulty || "medium",
    page: q.page || null,
    correct: a === q.correct,
    selected: a,
    answer: q.options[q.correct],
    explanation: q.explanation,
    options: q.options.map((text, i) => ({
      text,
      correct: i === q.correct,
      explanation:
        q.option_explanations?.[i] ||
        "Comentário específico ainda não cadastrado pelo autor.",
    })),
  };
}
function result(s: Record<string, unknown>) {
  const questions = JSON.parse(String(s.questions)) as Question[],
    answers = JSON.parse(String(s.answers));
  const f = questions.map((q, i) => feedback(q, answers[i] ?? null));
  return {
    id: s.id,
    status: s.status,
    deadline: s.deadline,
    created: s.created,
    finished: s.finished,
    score: f.filter((x) => x.correct).length,
    total: f.length,
    feedback: f,
  };
}
async function sessionDTO(e: FeatureRuntime, s: Record<string, unknown>) {
  if (s.status === "active" && s.deadline && String(s.deadline) <= now()) {
    await run(
      e,
      "UPDATE practice_sessions SET status='completed',finished=? WHERE id=? AND status='active'",
      now(),
      s.id,
    );
    s = { ...s, status: "completed", finished: now() };
  }
  return s.status === "completed"
    ? result(s)
    : {
        id: s.id,
        status: s.status,
        deadline: s.deadline,
        created: s.created,
        questions: (JSON.parse(String(s.questions)) as Question[]).map(
          safeQuestion,
        ),
        answers: JSON.parse(String(s.answers)),
      };
}
export async function advancedStudy(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  if (path === "academic-search" && method === "GET") {
    const q = clean(url.searchParams.get("q"), 100),
      products = await publicProducts(e),
      m = await rows(e, "SELECT product_id,published FROM academic_metadata");
    return json({
      products: products
        .filter((p) => !p.demo || !!p.public_download)
        .filter((p) => {
          const data = m.find((x) => x.product_id === p.id);
          return searchMatches(
            [p.title, p.subject, p.course, data?.published || ""].join(" "),
            q,
          );
        })
        .slice(0, 50)
        .map((p) => ({
          id: p.id,
          title: p.title,
          course: p.course,
          subject: p.subject,
          metadata: JSON.parse(
            String(m.find((x) => x.product_id === p.id)?.published || "{}"),
          ),
        })),
    });
  }
  if (
    ![
      "practice",
      "study-cards",
      "study-card-review",
      "academic-metadata",
    ].includes(path)
  )
    return null;
  if (
    !["GET", "POST"].includes(method) ||
    (path === "study-card-review" && method !== "POST")
  )
    fail("Método não permitido.", 405);
  const u = await auth(req),
    b = method === "GET" ? null : await body(req),
    id = clean(b?.product_id || url.searchParams.get("id"), 100);
  if (method !== "GET") await rate(e, u.id, path, 30);
  if (path === "academic-metadata") {
    await owned(e, u, id);
    if (method === "GET")
      return json({
        metadata: JSON.parse(
          String(
            (
              await rows(
                e,
                "SELECT draft FROM academic_metadata WHERE product_id=?",
                id,
              )
            )[0]?.draft || "{}",
          ),
        ),
      });
    const data = {
      institution: clean(b!.institution, 200),
      course_code: clean(b!.course_code, 100),
      isbn: clean(b!.isbn, 30),
      edition: clean(b!.edition, 100),
    };
    if (data.isbn && !/^[0-9Xx -]{10,25}$/.test(data.isbn))
      fail("Informe ISBN válido ou deixe em branco.");
    await e.DB.batch([
      e.DB.prepare(
        "INSERT INTO academic_metadata(product_id,draft,updated) VALUES(?,?,?) ON CONFLICT(product_id) DO UPDATE SET draft=excluded.draft,updated=excluded.updated",
      ).bind(id, JSON.stringify(data), now()),
      e.DB.prepare(
        "UPDATE products SET status='draft',reviewed_by=NULL,reviewed_at=NULL WHERE id=?",
      ).bind(id),
    ]);
    await audit(e, u.id, "academic.metadata_saved", id);
    return json({ ok: true });
  }
  if (!(await entitlement(e, u.id, id)))
    fail("Acesso restrito aos titulares do material.", 403);
  const pkg = (
      await rows(
        e,
        "SELECT published_questions,published_cards FROM learning_packages WHERE product_id=?",
        id,
      )
    )[0],
    questions = JSON.parse(
      String(pkg?.published_questions || "[]"),
    ) as Question[],
    cards = JSON.parse(String(pkg?.published_cards || "[]")) as Card[];
  if (path === "practice") {
    if (method === "GET") {
      const sessions = await rows(
        e,
        "SELECT * FROM practice_sessions WHERE product_id=? AND user_id=? ORDER BY created DESC LIMIT 25",
        id,
        u.id,
      );
      const data = [];
      for (const s of sessions) data.push(await sessionDTO(e, s));
      return json({
        topics: [...new Set(questions.map((q) => q.topic || "Geral"))],
        count: questions.length,
        sessions: data,
      });
    }
    if (b!.action === "start") {
      const count = Number(b!.count),
        minutes = Number(b!.minutes || 0),
        topic = clean(b!.topic, 100),
        difficulty = clean(b!.difficulty, 20);
      if (
        !Number.isInteger(count) ||
        count < 1 ||
        count > 50 ||
        !Number.isInteger(minutes) ||
        minutes < 0 ||
        minutes > 180
      )
        fail("Escolha de 1 a 50 questões e até 180 minutos.");
      const active = (
        await rows(
          e,
          "SELECT * FROM practice_sessions WHERE user_id=? AND product_id=? AND status='active' ORDER BY created DESC LIMIT 1",
          u.id,
          id,
        )
      )[0];
      if (active) {
        const dto = await sessionDTO(e, active);
        if (dto.status === "active")
          return json({ session: dto, resumed: true });
      }
      let selected = questions.filter(
        (q) =>
          (!topic || (q.topic || "Geral") === topic) &&
          (!difficulty || (q.difficulty || "medium") === difficulty),
      );
      if (!selected.length) fail("Não há questões neste recorte.");
      for (let i = selected.length - 1; i > 0; i--) {
        const a = new Uint32Array(1);
        crypto.getRandomValues(a);
        const j = a[0] % (i + 1);
        [selected[i], selected[j]] = [selected[j], selected[i]];
      }
      selected = selected.slice(0, count);
      const sid = crypto.randomUUID(),
        created = now(),
        deadline = minutes
          ? new Date(Date.now() + minutes * 60000).toISOString()
          : "";
      try {
        await run(
          e,
          "INSERT INTO practice_sessions(id,user_id,product_id,questions,deadline,created) VALUES(?,?,?,?,?,?)",
          sid,
          u.id,
          id,
          JSON.stringify(selected),
          deadline,
          created,
        );
      } catch (error) {
        const existing = (
          await rows(
            e,
            "SELECT * FROM practice_sessions WHERE user_id=? AND product_id=? AND status='active'",
            u.id,
            id,
          )
        )[0];
        if (!existing) throw error;
        return json({ session: await sessionDTO(e, existing), resumed: true });
      }
      return json({
        session: {
          id: sid,
          status: "active",
          questions: selected.map(safeQuestion),
          answers: [],
          deadline,
          created,
        },
      });
    }
    const sid = clean(b!.session_id, 100),
      s = (
        await rows(
          e,
          "SELECT * FROM practice_sessions WHERE id=? AND user_id=? AND product_id=?",
          sid,
          u.id,
          id,
        )
      )[0];
    if (!s) fail("Tentativa não encontrada.", 404);
    const current = await sessionDTO(e, s);
    if (current.status !== "active") return json({ session: current });
    const qs = JSON.parse(String(s.questions)) as Question[],
      answers = b!.answers;
    if (
      !Array.isArray(answers) ||
      answers.length > qs.length ||
      answers.some(
        (a, i) =>
          a !== null &&
          (!Number.isInteger(a) ||
            Number(a) < 0 ||
            Number(a) >= qs[i].options.length),
      )
    )
      fail("Respostas inválidas.");
    await run(
      e,
      "UPDATE practice_sessions SET answers=?,status=?,finished=? WHERE id=? AND status='active'",
      JSON.stringify(answers),
      b!.action === "finish" ? "completed" : "active",
      b!.action === "finish" ? now() : "",
      sid,
    );
    return json({
      session: await sessionDTO(
        e,
        (await rows(e, "SELECT * FROM practice_sessions WHERE id=?", sid))[0],
      ),
    });
  }
  const personal = await rows(
    e,
    "SELECT id,front,back,page FROM personal_cards WHERE user_id=? AND product_id=? ORDER BY created",
    u.id,
    id,
  );
  const all = [
    ...cards.map((c) => ({ ...c, personal: false, page: c.page || 1 })),
    ...personal.map((c) => ({
      id: "private:" + c.id,
      front: String(c.front),
      back: String(c.back),
      page: Number(c.page),
      personal: true,
    })),
  ];
  if (path === "study-cards") {
    if (method === "GET") {
      const reviews = await rows(
        e,
        "SELECT * FROM adaptive_reviews WHERE user_id=? AND product_id=?",
        u.id,
        id,
      );
      return json({
        cards: all.map((c) => ({
          ...c,
          schedule: reviews.find((r) => r.card_id === c.id) || null,
        })),
        notice:
          "Fila de prática pessoal. O agendamento é uma regra de estudo, sem garantia de retenção.",
      });
    }
    if (b!.action === "delete") {
      await run(
        e,
        "DELETE FROM personal_cards WHERE id=? AND user_id=? AND product_id=?",
        clean(b!.card_id, 100).replace(/^private:/, ""),
        u.id,
        id,
      );
      return json({ ok: true });
    }
    if (
      personal.length >= 300 ||
      clean(b!.front).length < 2 ||
      clean(b!.back).length < 2 ||
      !Number.isInteger(b!.page) ||
      Number(b!.page) < 1 ||
      Number(b!.page) > 5000
    )
      fail("Preencha frente, verso e página (limite de 300 cartões pessoais).");
    await run(
      e,
      "INSERT INTO personal_cards(id,user_id,product_id,front,back,page,created) VALUES(?,?,?,?,?,?,?)",
      crypto.randomUUID(),
      u.id,
      id,
      clean(b!.front, 3000),
      clean(b!.back, 5000),
      b!.page,
      now(),
    );
    return json({ ok: true });
  }
  const card = clean(b!.card_id, 100),
    rating = clean(b!.rating, 10),
    request = clean(b!.request_id, 80),
    exam = clean(b!.exam_date, 10);
  if (
    !all.some((c) => c.id === card) ||
    !["hard", "normal", "easy"].includes(rating) ||
    !/^[-a-f0-9]{36}$/i.test(request) ||
    (exam &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(exam) ||
        isNaN(Date.parse(exam)) ||
        new Date(exam).toISOString().slice(0, 10) !== exam ||
        exam < now().slice(0, 10)))
  )
    fail("Confira o cartão, a dificuldade e a data da prova.");
  const eventId = u.id + ":" + request,
    previous = (
      await rows(e, "SELECT * FROM review_events WHERE id=?", eventId)
    )[0];
  if (previous) {
    if (previous.product_id !== id || previous.card_id !== card)
      fail("Tentativa já utilizada em outro cartão.", 409);
    return json(JSON.parse(String(previous.result)));
  }
  const key = u.id + ":" + id + ":" + card,
    r = (await rows(e, "SELECT * FROM adaptive_reviews WHERE id=?", key))[0];
  let interval =
    rating === "hard"
      ? 1
      : Math.min(
          365,
          Math.max(
            rating === "easy" ? 4 : 2,
            Math.round(
              Number(r?.interval || 1) * (rating === "easy" ? 2.5 : 2),
            ),
          ),
        );
  if (exam)
    interval = Math.min(
      interval,
      Math.max(
        0,
        Math.round(
          (Date.parse(exam) - Date.parse(now().slice(0, 10))) / 86400000,
        ),
      ),
    );
  const due = new Date(Date.now() + interval * 86400000)
      .toISOString()
      .slice(0, 10),
    value = { due, interval };
  try {
    await e.DB.batch([
      e.DB.prepare(
        "INSERT INTO review_events(id,user_id,product_id,card_id,result,created) VALUES(?,?,?,?,?,?)",
      ).bind(eventId, u.id, id, card, JSON.stringify(value), now()),
      e.DB.prepare(
        "INSERT INTO adaptive_reviews(id,user_id,product_id,card_id,interval,repetitions,lapses,due,exam_date,updated) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET interval=excluded.interval,repetitions=adaptive_reviews.repetitions+1,lapses=adaptive_reviews.lapses+excluded.lapses,due=excluded.due,exam_date=excluded.exam_date,updated=excluded.updated",
      ).bind(
        key,
        u.id,
        id,
        card,
        interval,
        1,
        rating === "hard" ? 1 : 0,
        due,
        exam,
        now(),
      ),
    ]);
  } catch (error) {
    const duplicate = (
      await rows(e, "SELECT * FROM review_events WHERE id=?", eventId)
    )[0];
    if (!duplicate) throw error;
    if (duplicate.product_id !== id || duplicate.card_id !== card)
      fail("Tentativa já utilizada.", 409);
    return json(JSON.parse(String(duplicate.result)));
  }
  return json(value);
}
