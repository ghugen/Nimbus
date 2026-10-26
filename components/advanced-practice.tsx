"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
type Q = {
  id: string;
  prompt: string;
  options: string[];
  topic?: string;
  difficulty?: string;
  page?: number;
};
type Feedback = {
  id: string;
  prompt: string;
  topic: string;
  correct: boolean;
  answer: string;
  explanation: string;
  page: number | null;
  options: { text: string; correct: boolean; explanation: string }[];
};
type Session = {
  id: string;
  status: string;
  questions?: Q[];
  answers?: Array<number | null>;
  deadline: string;
  created: string;
  score?: number;
  total?: number;
  feedback?: Feedback[];
};
export function AdvancedPractice({
  productId,
  onPage,
}: {
  productId: string;
  onPage: (p: number) => void;
}) {
  const [data, setData] = useState<{
      topics: string[];
      count: number;
      sessions: Session[];
    } | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [answers, setAnswers] = useState<Array<number | null>>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [clock, setClock] = useState(Date.now());
  async function load() {
    const d = await callApi("practice?id=" + productId);
    setData(d as typeof data);
    return d;
  }
  useEffect(() => {
    setSession(null);
    setAnswers([]);
    setMessage("");
    load().catch((e) => setMessage(e.message));
    return () => {};
  }, [productId]);
  useEffect(() => {
    if (session?.status !== "active") return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session?.id, session?.status]);
  async function save(action = "save", values = answers) {
    if (!session) return;
    setBusy(true);
    try {
      const d = await callApi("practice", {
        product_id: productId,
        session_id: session.id,
        answers: values,
        action,
      });
      const s = d.session as Session;
      setSession(s);
      setMessage(
        s.status === "active" ? "Respostas salvas." : "Tentativa finalizada.",
      );
      if (s.status !== "active") await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (
      session?.status === "active" &&
      session.deadline &&
      Date.parse(session.deadline) <= clock &&
      !busy
    )
      save("finish");
  }, [clock]);
  const remaining = session?.deadline
    ? Math.max(0, Math.ceil((Date.parse(session.deadline) - clock) / 1000))
    : null;
  return (
    <details className="panel">
      <summary>Simulado por tema e dificuldade</summary>
      <p>
        Prática pessoal, sem valor de avaliação acadêmica formal. As questões e
        respostas são preservadas na tentativa; alterações posteriores do autor
        não modificam o histórico.
      </p>
      {message && <p role="status">{message}</p>}
      {session?.status === "active" ? (
        <>
          <div className="notice">
            {remaining === null
              ? "Sem limite de tempo"
              : `Tempo restante: ${Math.floor(remaining / 60)}min ${remaining % 60}s`}{" "}
            · {answers.filter((a) => Number.isInteger(a)).length}/
            {session.questions?.length} respondidas
          </div>
          {session.questions?.map((q, i) => (
            <fieldset key={q.id}>
              <legend>
                {i + 1}. {q.prompt}
              </legend>
              <p>
                {q.topic || "Geral"} · {q.difficulty || "medium"}
              </p>
              {q.options.map((o, n) => (
                <label className="check-label" key={n}>
                  <input
                    type="radio"
                    name={"practice-" + q.id}
                    checked={answers[i] === n}
                    onChange={() => {
                      const v = Array.from(
                        { length: session.questions!.length },
                        (_, j) => (j === i ? n : (answers[j] ?? null)),
                      );
                      setAnswers(v);
                    }}
                  />
                  {o}
                </label>
              ))}
            </fieldset>
          ))}
          <div className="studio-actions">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => save()}
            >
              Salvar respostas e continuar depois
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => save("finish")}
            >
              Finalizar tentativa
            </button>
          </div>
          <p>
            Salve antes de fechar. O cronômetro continua contando enquanto você
            estiver fora.
          </p>
        </>
      ) : (
        <>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const f = new FormData(e.currentTarget);
              try {
                const d = await callApi("practice", {
                  product_id: productId,
                  action: "start",
                  topic: f.get("topic"),
                  difficulty: f.get("difficulty"),
                  count: Number(f.get("count")),
                  minutes: Number(f.get("minutes")),
                });
                const s = d.session as Session;
                setSession(s);
                setAnswers(s.answers || []);
                setClock(Date.now());
                setMessage(
                  d.resumed
                    ? "Sua tentativa em andamento foi retomada."
                    : "Simulado preparado.",
                );
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Tema
              <select name="topic">
                <option value="">Todos os temas</option>
                {data?.topics.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Dificuldade
              <select name="difficulty">
                <option value="">Todas</option>
                <option value="easy">Básica</option>
                <option value="medium">Intermediária</option>
                <option value="hard">Avançada</option>
              </select>
            </label>
            <div className="form-row">
              <label>
                Quantidade
                <input
                  name="count"
                  type="number"
                  min={1}
                  max={50}
                  defaultValue={10}
                />
              </label>
              <label>
                Minutos (0 = sem limite)
                <input
                  name="minutes"
                  type="number"
                  min={0}
                  max={180}
                  defaultValue={0}
                />
              </label>
            </div>
            <p>{data?.count || 0} questão(ões) publicadas no material.</p>
            <button className="btn primary" disabled={busy || !data?.count}>
              Iniciar ou retomar simulado
            </button>
          </form>
          <h4>Histórico de temas para retomar</h4>
          <ul>
            {Object.entries(
              (data?.sessions || [])
                .filter((s) => s.status === "completed")
                .flatMap((s) => s.feedback || [])
                .reduce<Record<string, number>>((counts, f) => {
                  if (!f.correct) counts[f.topic] = (counts[f.topic] || 0) + 1;
                  return counts;
                }, {}),
            )
              .sort((a, b) => b[1] - a[1])
              .map(([topic, n]) => (
                <li key={topic}>
                  {topic}: {n} resposta(s) para revisar nas últimas tentativas
                </li>
              ))}
          </ul>
          <h4>Tentativas anteriores</h4>
          {data?.sessions.map((s) => (
            <button
              className="btn secondary small"
              key={s.id}
              onClick={() => {
                setSession(s);
                setAnswers(s.answers || []);
              }}
            >
              {new Date(s.created).toLocaleDateString("pt-BR")} ·{" "}
              {s.status === "active" ? "Retomar" : `${s.score}/${s.total}`}
            </button>
          ))}
        </>
      )}
      {session?.status === "completed" && (
        <section>
          <h3>
            Resultado: {session.score}/{session.total}
          </h3>
          <h4>Assuntos para retomar</h4>
          <ul>
            {[
              ...new Set(
                session.feedback?.filter((f) => !f.correct).map((f) => f.topic),
              ),
            ].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {session.feedback?.map((f) => (
            <article className="source-card" key={f.id}>
              <strong>
                {f.correct ? "✓ Correta" : "Retome este ponto"} · {f.prompt}
              </strong>
              <p>Resposta: {f.answer}</p>
              <p>{f.explanation || "Explicação geral ainda não cadastrada."}</p>
              <ul>
                {f.options.map((o, i) => (
                  <li key={i}>
                    <strong>
                      {o.text}
                      {o.correct ? " ✓" : ""}
                    </strong>{" "}
                    — {o.explanation}
                  </li>
                ))}
              </ul>
              {f.page && (
                <button className="text-link" onClick={() => onPage(f.page!)}>
                  Conferir página {f.page}
                </button>
              )}
            </article>
          ))}
        </section>
      )}
    </details>
  );
}
export function AdaptiveCards({
  productId,
  onPage,
}: {
  productId: string;
  onPage: (n: number) => void;
}) {
  type C = {
    id: string;
    front: string;
    back: string;
    page: number;
    personal: boolean;
    schedule: { due: string; lapses: number; exam_date: string } | null;
  };
  const [cards, setCards] = useState<C[]>([]),
    [all, setAll] = useState(false),
    [exam, setExam] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setCards((await callApi("study-cards?id=" + productId)).cards as C[]);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, [productId]);
  const today = new Date().toISOString().slice(0, 10),
    queue = cards
      .filter((c) => all || !c.schedule || c.schedule.due <= today)
      .sort((a, b) => (b.schedule?.lapses || 0) - (a.schedule?.lapses || 0));
  return (
    <details className="panel">
      <summary>Minha fila de revisão e cartões pessoais</summary>
      <p>
        Os intervalos mudam conforme suas respostas anteriores. Cartões difíceis
        voltam antes; a data da prova limita o intervalo sugerido.
      </p>
      {message && <p role="status">{message}</p>}
      <label>
        Data da prova (opcional)
        <input
          type="date"
          value={exam}
          min={today}
          onChange={(e) => setExam(e.target.value)}
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={all}
          onChange={(e) => setAll(e.target.checked)}
        />
        Mostrar também cartões de revisões futuras
      </label>
      <p>{queue.length} cartão(ões) nesta fila.</p>
      {queue.map((c) => (
        <article className="source-card" key={c.id}>
          <h4>{c.front}</h4>
          <details>
            <summary>Conferir resposta</summary>
            <p className="pre-line">{c.back}</p>
          </details>
          {c.schedule && (
            <p>
              Próxima revisão: {c.schedule.due} · Retomadas por dificuldade:{" "}
              {c.schedule.lapses}
            </p>
          )}
          <div className="studio-actions">
            {[
              ["hard", "Difícil"],
              ["normal", "Consegui"],
              ["easy", "Fácil"],
            ].map(([rating, label]) => (
              <button
                key={rating}
                className="btn secondary small"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const d = await callApi("study-card-review", {
                      product_id: productId,
                      card_id: c.id,
                      rating,
                      exam_date: exam,
                      request_id: crypto.randomUUID(),
                    });
                    await load();
                    setMessage("Próxima revisão: " + d.due);
                  } catch (e) {
                    setMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {label}
              </button>
            ))}
            <button className="text-link" onClick={() => onPage(c.page)}>
              Página {c.page}
            </button>
            {c.personal && (
              <button
                className="text-link"
                disabled={busy}
                onClick={async () => {
                  try {
                    await callApi("study-cards", {
                      product_id: productId,
                      card_id: c.id,
                      action: "delete",
                    });
                    await load();
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                Remover cartão pessoal
              </button>
            )}
          </div>
        </article>
      ))}
      <details>
        <summary>Criar cartão com minhas anotações</summary>
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = e.currentTarget,
              d = new FormData(f);
            setBusy(true);
            try {
              await callApi("study-cards", {
                product_id: productId,
                front: d.get("front"),
                back: d.get("back"),
                page: Number(d.get("page")),
              });
              f.reset();
              await load();
              setMessage(
                "Cartão pessoal salvo. Ele não é compartilhado com outros estudantes.",
              );
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Pergunta ou conceito
            <textarea name="front" minLength={2} maxLength={3000} required />
          </label>
          <label>
            Minha resposta ou anotação
            <textarea name="back" minLength={2} maxLength={5000} required />
          </label>
          <label>
            Página da fonte
            <input
              name="page"
              type="number"
              min={1}
              max={5000}
              defaultValue={1}
            />
          </label>
          <button className="btn secondary" disabled={busy}>
            Salvar cartão privado
          </button>
        </form>
      </details>
    </details>
  );
}
