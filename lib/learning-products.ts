import { entitlement } from "./catalog-services";
import {
  body,
  clean,
  fail,
  json,
  now,
  owned,
  rows,
  run,
  rate,
  audit,
  type FeatureRuntime,
  type FeatureUser,
} from "./feature-db";
export type Card = { id: string; front: string; back: string; page?: number };
export type Question = {
  topic?: string;
  difficulty?: string;
  page?: number;
  option_explanations?: string[];
  id: string;
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
};
export type Lesson = {
  id: string;
  title: string;
  text: string;
  video_url: string;
};
function list(v: unknown, max: number) {
  if (!Array.isArray(v) || v.length > max)
    fail("Quantidade de atividades inválida.");
  if (v.some((x) => !x || typeof x !== "object" || Array.isArray(x)))
    fail("Atividade inválida.");
  return v as Record<string, unknown>[];
}
export function validatePackage(b: Record<string, unknown>) {
  if (JSON.stringify(b).length > 900000)
    fail("O conjunto de atividades excede o limite de 900 mil caracteres.");
  const ids = new Set<string>();
  function id(v: unknown) {
    const x = clean(v, 80) || crypto.randomUUID();
    if (ids.has(x)) fail("Identificadores de atividade repetidos.");
    ids.add(x);
    return x;
  }
  const cards = list(b.cards || [], 300).map((c) => {
    if (clean(c.front).length < 2 || clean(c.back).length < 2)
      fail("Preencha frente e verso dos cartões.");
    return {
      id: id(c.id),
      page:
        Number.isSafeInteger(c.page) &&
        Number(c.page) > 0 &&
        Number(c.page) <= 5000
          ? Number(c.page)
          : undefined,
      front: clean(c.front, 3000),
      back: clean(c.back, 5000),
    };
  });
  const questions = list(b.questions || [], 200).map((q) => {
    const options = q.options;
    if (
      clean(q.prompt).length < 5 ||
      !Array.isArray(options) ||
      options.length < 2 ||
      options.length > 8 ||
      options.some(
        (x) => typeof x !== "string" || x.trim().length < 1 || x.length > 1000,
      ) ||
      !Number.isInteger(q.correct) ||
      Number(q.correct) < 0 ||
      Number(q.correct) >= options.length
    )
      fail("Confira enunciado, alternativas e gabarito.");
    return {
      id: id(q.id),
      prompt: clean(q.prompt, 4000),
      options: options as string[],
      correct: Number(q.correct),
      topic: clean(q.topic, 100) || "Geral",
      difficulty: ["easy", "medium", "hard"].includes(String(q.difficulty))
        ? String(q.difficulty)
        : "medium",
      page:
        Number.isSafeInteger(q.page) &&
        Number(q.page) > 0 &&
        Number(q.page) <= 5000
          ? Number(q.page)
          : undefined,
      option_explanations:
        Array.isArray(q.option_explanations) &&
        q.option_explanations.length === options.length
          ? q.option_explanations.map((x) => clean(x, 1500))
          : undefined,
      explanation: clean(q.explanation, 5000),
    };
  });
  const lessons = list(b.lessons || [], 100).map((l) => {
    if (clean(l.title).length < 3 || clean(l.text).length < 10)
      fail("Informe título e conteúdo da aula.");
    const video = clean(l.video_url, 500);
    if (video) {
      let u: URL;
      try {
        u = new URL(video);
      } catch {
        fail("Link de vídeo inválido.");
      }
      if (
        u.protocol !== "https:" ||
        ![
          "www.youtube.com",
          "youtube.com",
          "www.youtube-nocookie.com",
          "player.vimeo.com",
        ].includes(u.hostname)
      )
        fail("Use um link HTTPS de incorporação de YouTube ou Vimeo.");
      if (
        !u.pathname.startsWith("/embed/") &&
        !u.pathname.startsWith("/video/")
      )
        fail("Informe a URL de incorporação do vídeo.");
    }
    return {
      id: id(l.id),
      title: clean(l.title, 150),
      text: clean(l.text, 20000),
      video_url: video,
    };
  });
  return { cards, questions, lessons };
}
export async function hasPackage(e: FeatureRuntime, id: string) {
  const r = (
    await rows(e, "SELECT * FROM learning_packages WHERE product_id=?", id)
  )[0];
  if (!r) return false;
  try {
    return (
      JSON.parse(String(r.cards)).length +
        JSON.parse(String(r.questions)).length +
        JSON.parse(String(r.lessons)).length >
      0
    );
  } catch {
    return false;
  }
}
export async function learningProducts(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  if (
    ![
      "learning-review",
      "learning-author",
      "learning-content",
      "quiz-submit",
      "lesson-progress",
      "card-review",
    ].includes(path)
  )
    return null;
  const u = await auth(req);
  if (method !== "GET") await rate(e, u.id, path, 40);
  const b = method === "GET" ? null : await body(req),
    id = clean(b?.product_id || url.searchParams.get("id"), 100);
  if (path === "learning-review") {
    const role = (
      await rows(e, "SELECT reviewer FROM staff_roles WHERE user_id=?", u.id)
    )[0];
    if (!u.admin && !role?.reviewer) fail("Acesso restrito à revisão.", 403);
    if (method !== "GET") fail("Somente leitura.", 405);
    const r = (
      await rows(e, "SELECT * FROM learning_packages WHERE product_id=?", id)
    )[0];
    return json({
      package: r
        ? {
            cards: JSON.parse(String(r.cards)),
            questions: JSON.parse(String(r.questions)),
            lessons: JSON.parse(String(r.lessons)),
          }
        : null,
    });
  }
  if (path === "learning-author") {
    await owned(e, u, id);
    if (method === "GET") {
      const r = (
        await rows(e, "SELECT * FROM learning_packages WHERE product_id=?", id)
      )[0];
      return json({
        package: r
          ? {
              cards: JSON.parse(String(r.cards)),
              questions: JSON.parse(String(r.questions)),
              lessons: JSON.parse(String(r.lessons)),
            }
          : { cards: [], questions: [], lessons: [] },
      });
    }
    const data = validatePackage(b!);
    await run(
      e,
      "INSERT INTO learning_packages(product_id,cards,questions,lessons,updated) VALUES(?,?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET cards=excluded.cards,questions=excluded.questions,lessons=excluded.lessons,updated=excluded.updated",
      id,
      JSON.stringify(data.cards),
      JSON.stringify(data.questions),
      JSON.stringify(data.lessons),
      now(),
    );
    await run(
      e,
      "UPDATE products SET status='draft',reviewed_by=NULL,reviewed_at=NULL WHERE id=?",
      id,
    );
    await audit(e, u.id, "learning.saved", id);
    return json({ ok: true, package: data });
  }
  if (!(await entitlement(e, u.id, id)))
    fail("Adquira o material para acessar estas atividades.", 403);
  const r = (
    await rows(e, "SELECT * FROM learning_packages WHERE product_id=?", id)
  )[0];
  if (!r)
    return path === "learning-content"
      ? json({
          package: { cards: [], questions: [], lessons: [] },
          completed: [],
          reviews: [],
          attempts: [],
        })
      : fail("Atividades não encontradas.", 404);
  const data = {
    cards: JSON.parse(String(r.published_cards)) as Card[],
    questions: JSON.parse(String(r.published_questions)) as Question[],
    lessons: JSON.parse(String(r.published_lessons)) as Lesson[],
  };
  if (path === "learning-content" && method === "GET")
    return json({
      package: {
        ...data,
        questions: data.questions.map(
          ({ correct, explanation, option_explanations, ...q }) => q,
        ),
      },
      completed: await rows(
        e,
        "SELECT lesson_id,completed FROM lesson_progress WHERE user_id=? AND product_id=?",
        u.id,
        id,
      ),
      reviews: await rows(
        e,
        "SELECT card_id,due,level FROM card_reviews WHERE user_id=? AND product_id=?",
        u.id,
        id,
      ),
      attempts: await rows(
        e,
        "SELECT id,score,total,created FROM quiz_attempts WHERE user_id=? AND product_id=? ORDER BY created DESC LIMIT 20",
        u.id,
        id,
      ),
    });
  if (path === "quiz-submit" && method === "POST") {
    if (
      !Array.isArray(b!.answers) ||
      b!.answers.length !== data.questions.length ||
      !data.questions.length
    )
      fail("Responda às questões do simulado.");
    const answers = b!.answers as unknown[];
    if (
      answers.some(
        (a, i) =>
          !Number.isInteger(a) ||
          Number(a) < 0 ||
          Number(a) >= data.questions[i].options.length,
      )
    )
      fail("Respostas inválidas.");
    const feedback = data.questions.map((q, i) => ({
        id: q.id,
        correct: answers[i] === q.correct,
        answer: q.options[q.correct],
        explanation: q.explanation,
      })),
      score = feedback.filter((x) => x.correct).length;
    await run(
      e,
      "INSERT INTO quiz_attempts(id,user_id,product_id,score,total,answers,created) VALUES(?,?,?,?,?,?,?)",
      crypto.randomUUID(),
      u.id,
      id,
      score,
      data.questions.length,
      JSON.stringify(answers),
      now(),
    );
    return json({ score, total: data.questions.length, feedback });
  }
  if (path === "lesson-progress" && method === "POST") {
    const lesson = clean(b!.lesson_id, 80);
    if (!data.lessons.some((l) => l.id === lesson))
      fail("Aula não encontrada.");
    await run(
      e,
      "INSERT INTO lesson_progress(id,user_id,product_id,lesson_id,completed,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET completed=excluded.completed,updated=excluded.updated",
      u.id + ":" + id + ":" + lesson,
      u.id,
      id,
      lesson,
      b!.completed === true ? 1 : 0,
      now(),
    );
    return json({ ok: true });
  }
  if (path === "card-review" && method === "POST") {
    const card = clean(b!.card_id, 80),
      level = String(b!.level);
    if (
      !data.cards.some((c) => c.id === card) ||
      !["hard", "normal", "easy"].includes(level)
    )
      fail("Cartão ou classificação inválidos.");
    const due = new Date(
      Date.now() +
        { hard: 1, normal: 3, easy: 7 }[level as "hard" | "normal" | "easy"] *
          86400000,
    )
      .toISOString()
      .slice(0, 10);
    await run(
      e,
      "INSERT INTO card_reviews(id,user_id,product_id,card_id,due,level,updated) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET due=excluded.due,level=excluded.level,updated=excluded.updated",
      u.id + ":" + id + ":" + card,
      u.id,
      id,
      card,
      due,
      level,
      now(),
    );
    return json({ ok: true, due });
  }
  return null;
}
