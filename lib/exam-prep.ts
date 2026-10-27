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
import { publicProducts, entitlement } from "./catalog-services";
import { coverage, syllabusTopics } from "./exam-core";
import { todayAt } from "./sofia-core";
import type { Question } from "./learning-products";
export async function examPrep(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  if (
    ![
      "exam-coverage",
      "exam-reviews",
      "recommendation-feedback",
      "growth-cockpit",
    ].includes(path)
  )
    return null;
  if (path === "exam-coverage") {
    if (method !== "POST") fail("Método não permitido.", 405);
    // No syllabus or chat is persisted. A shared anonymous rate bucket bounds public work.
    await rate(e, "public", "exam-coverage", 120);
    const b = await body(req);
    let topics: string[];
    try {
      topics = syllabusTopics(clean(b.syllabus, 6001));
    } catch (x) {
      fail((x as Error).message);
    }
    const catalog = (await publicProducts(e))
      .filter(
        (p) =>
          (!p.demo || p.public_download) &&
          (!b.course || p.course === clean(b.course, 120)),
      )
      .slice(0, 500);
    const packages = await rows(
      e,
      "SELECT product_id,json_array_length(published_questions) questions,json_array_length(published_cards) cards FROM learning_packages",
    );
    const pm = new Map(packages.map((p) => [p.product_id, p]));
    return json({
      coverage: coverage(topics, catalog),
      catalog: catalog.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description.slice(0, 700),
        subject: p.subject,
        topic: p.topic,
        course: p.course,
        format: p.format,
        price: p.price,
        pages: p.pages,
        objectives: p.objectives || "",
        toc: p.toc || "",
        sources: p.sources || "",
        author: p.author,
        reviewed_at: p.reviewed_at || "",
        revision_notes: p.revision_notes || "",
        questions: Number(pm.get(p.id)?.questions || 0),
        cards: Number(pm.get(p.id)?.cards || 0),
      })),
      limit: 500,
      notice:
        "Correspondência de palavras no cadastro. Não comprova cobertura integral da prova ou qualidade do conteúdo. Confira sumário e amostra. Seu texto não foi armazenado.",
    });
  }
  const u = await auth(req);
  if (path === "recommendation-feedback") {
    if (method === "GET")
      return json({
        feedback: await rows(
          e,
          "SELECT product_id,reason,updated FROM recommendation_feedback WHERE user_id=?",
          u.id,
        ),
      });
    if (method !== "POST") fail("Método não permitido.", 405);
    await rate(e, u.id, path, 30);
    const b = await body(req),
      id = clean(b.product_id, 100);
    if (b.action === "clear") {
      if (b.confirm !== true) fail("Confirme a exclusão.");
      await e.DB.prepare("DELETE FROM recommendation_feedback WHERE user_id=?")
        .bind(u.id)
        .run();
      return json({ ok: true });
    }
    if (b.action === "remove") {
      await e.DB.prepare(
        "DELETE FROM recommendation_feedback WHERE user_id=? AND product_id=?",
      )
        .bind(u.id, id)
        .run();
      return json({ ok: true });
    }
    if (
      !["off_topic", "too_advanced", "already_know"].includes(String(b.reason))
    )
      fail("Motivo inválido.");
    if (
      !(await publicProducts(e)).some(
        (p) => p.id === id && (!p.demo || p.public_download),
      )
    )
      fail("Material indisponível.", 404);
    await e.DB.prepare(
      "INSERT INTO recommendation_feedback(id,user_id,product_id,reason,updated) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET reason=excluded.reason,updated=excluded.updated",
    )
      .bind(u.id + ":" + id, u.id, id, b.reason, now())
      .run();
    return json({ ok: true });
  }
  if (path === "exam-reviews") {
    if (method !== "GET") fail("Método não permitido.", 405);
    const sessions = await rows(
      e,
      "SELECT product_id,questions,answers,finished FROM practice_sessions WHERE user_id=? AND status='completed' ORDER BY finished DESC LIMIT 20",
      u.id,
    );
    const ids = [...new Set(sessions.map((s) => String(s.product_id)))],
      access = new Map(
        await Promise.all(
          ids.map(
            async (id) => [id, !!(await entitlement(e, u.id, id))] as const,
          ),
        ),
      );
    const current = await publicProducts(e),
      byId = new Map(current.map((p) => [p.id, p]));
    const mistakes = new Map<
      string,
      {
        product_id: string;
        title: string;
        topic: string;
        page: number | null;
        misses: number;
        latest: string;
      }
    >();
    for (const s of sessions) {
      if (!access.get(String(s.product_id))) continue;
      const qs = JSON.parse(String(s.questions)) as Question[],
        answers = JSON.parse(String(s.answers));
      qs.forEach((q, i) => {
        if (answers[i] === q.correct) return;
        const key =
            s.product_id + ":" + (q.topic || "Geral") + ":" + (q.page || 0),
          old = mistakes.get(key);
        mistakes.set(key, {
          product_id: String(s.product_id),
          title:
            byId.get(String(s.product_id))?.title ||
            "Material da sua biblioteca",
          topic: q.topic || "Geral",
          page: q.page || null,
          misses: (old?.misses || 0) + 1,
          latest: old?.latest || String(s.finished),
        });
      });
    }
    return json({
      reviews: [...mistakes.values()]
        .sort((a, b) => b.misses - a.misses)
        .slice(0, 30),
      limit: 20,
      notice:
        "Sugestões baseadas nos últimos 20 simulados concluídos. Não são diagnóstico de capacidade nem avaliação formal. Respostas e gabaritos não são usados na recomendação de compras.",
    });
  }
  if (!u.admin) fail("Acesso administrativo necessário.", 403);
  if (method !== "GET") fail("Método não permitido.", 405);
  const [catalog, demands, overdue, events, tickets, payments, feedback] =
    await Promise.all([
      publicProducts(e),
      rows(
        e,
        "SELECT course,subject,COUNT(*) total FROM demand_ideas WHERE status IN ('pending','published') GROUP BY course,subject ORDER BY total DESC LIMIT 40",
      ),
      rows(
        e,
        "SELECT s.product_id,p.title,s.next_review FROM review_schedules s JOIN products p ON p.id=s.product_id WHERE s.next_review<? ORDER BY s.next_review LIMIT 50",
        todayAt("America/Sao_Paulo"),
      ),
      rows(
        e,
        "SELECT kind,COUNT(*) total FROM operation_events WHERE status='open' GROUP BY kind",
      ),
      rows(e, "SELECT COUNT(*) total FROM tickets WHERE status!='closed'"),
      rows(
        e,
        "SELECT status,COUNT(*) total FROM orders WHERE status IN ('pending','failed') GROUP BY status",
      ),
      rows(
        e,
        "SELECT reason,COUNT(*) total FROM recommendation_feedback GROUP BY reason",
      ),
    ]);
  const real = catalog.filter((p) => !p.demo || p.public_download);
  const quality = real.map((p) => ({
    id: p.id,
    title: p.title,
    missing: [
      !p.objectives && "Objetivos",
      !p.toc && "Sumário",
      !p.sources && "Referências",
      !p.reviewed_at && "Data de revisão",
    ].filter(Boolean),
  }));
  return json({
    coverage: demands.map((d) => ({
      ...d,
      ...coverage(
        [String(d.subject)],
        real.filter((p) => !d.course || p.course === d.course),
      )[0],
    })),
    quality,
    overdue,
    events,
    tickets: Number(tickets[0]?.total || 0),
    payments,
    feedback,
    notice:
      "Fila operacional baseada nos registros internos. Ausência de eventos não comprova disponibilidade. Pedidos pendentes não são falhas confirmadas. O mapa usa assuntos de solicitações existentes; não grava ementas ou conversas.",
  });
}
