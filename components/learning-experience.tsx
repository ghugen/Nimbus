"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
import type { Card, Lesson, Question } from "@/lib/learning-products";
type Package = {
  cards: Card[];
  questions: Omit<Question, "correct" | "explanation">[];
  lessons: Lesson[];
};
export function LearningExperience({ productId }: { productId: string }) {
  const [data, setData] = useState<Package | null>(null),
    [completed, setCompleted] = useState<string[]>([]),
    [index, setIndex] = useState(0),
    [flipped, setFlipped] = useState(false),
    [answers, setAnswers] = useState<number[]>([]),
    [feedback, setFeedback] = useState<{
      score: number;
      total: number;
      feedback: {
        id: string;
        correct: boolean;
        answer: string;
        explanation: string;
      }[];
    } | null>(null),
    [message, setMessage] = useState("");
  async function load() {
    const d = await callApi(
      "learning-content?id=" + encodeURIComponent(productId),
    );
    setData(d.package as Package);
    setCompleted(
      (d.completed as { lesson_id: string; completed: number }[])
        .filter((x) => x.completed)
        .map((x) => x.lesson_id),
    );
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, [productId]);
  if (
    !data ||
    (!data.cards.length && !data.lessons.length && !data.questions.length)
  )
    return null;
  const card = data.cards[index];
  return (
    <section className="learning-experience">
      <h3>Estude, pratique e acompanhe.</h3>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {!!data.lessons.length && (
        <div>
          <h4>
            Trilha de aprendizagem · {completed.length}/{data.lessons.length}{" "}
            aulas concluídas
          </h4>
          {data.lessons.map((l, i) => (
            <details className="panel lesson" key={l.id}>
              <summary>
                {i + 1}. {l.title} {completed.includes(l.id) ? "✓" : ""}
              </summary>
              <p className="pre-line">{l.text}</p>
              {l.video_url && (
                <ExternalVideo url={l.video_url} title={l.title} />
              )}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={completed.includes(l.id)}
                  onChange={async (e) => {
                    try {
                      await callApi("lesson-progress", {
                        product_id: productId,
                        lesson_id: l.id,
                        completed: e.target.checked,
                      });
                      await load();
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                />
                <span>Concluí esta aula</span>
              </label>
            </details>
          ))}
        </div>
      )}
      {card && (
        <div className="panel flashcard">
          <h4>
            Flashcards · {index + 1}/{data.cards.length}
          </h4>
          <button
            className="flashcard-face"
            aria-label={
              flipped ? "Mostrar pergunta" : "Virar cartão e mostrar resposta"
            }
            onClick={() => setFlipped(!flipped)}
          >
            {flipped ? card.back : card.front}
          </button>
          <div className="studio-actions">
            <button
              className="btn secondary small"
              onClick={() => {
                setIndex((index - 1 + data.cards.length) % data.cards.length);
                setFlipped(false);
              }}
            >
              Anterior
            </button>
            <button
              className="btn secondary small"
              onClick={() => {
                setIndex((index + 1) % data.cards.length);
                setFlipped(false);
              }}
            >
              Próximo
            </button>
          </div>
          {flipped && (
            <div className="studio-actions">
              {[
                ["hard", "Difícil · retomar amanhã"],
                ["normal", "Regular · em 3 dias"],
                ["easy", "Fácil · em 7 dias"],
              ].map(([level, label]) => (
                <button
                  className="text-link"
                  key={level}
                  onClick={async () => {
                    try {
                      const d = await callApi("card-review", {
                        product_id: productId,
                        card_id: card.id,
                        level,
                      });
                      setMessage("Revisão registrada para " + d.due);
                      setFlipped(false);
                      setIndex((index + 1) % data.cards.length);
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!!data.questions.length && (
        <form
          className="panel form quiz"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const d = await callApi("quiz-submit", {
                product_id: productId,
                answers,
              });
              setFeedback(d as typeof feedback);
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          <h4>Questões para praticar</h4>
          {data.questions.map((q, i) => (
            <fieldset key={q.id}>
              <legend>
                {i + 1}. {q.prompt}
              </legend>
              {q.options.map((option, j) => (
                <label className="check-label" key={j}>
                  <input
                    type="radio"
                    name={"question-" + q.id}
                    required
                    checked={answers[i] === j}
                    onChange={() =>
                      setAnswers((old) => {
                        const next = [...old];
                        next[i] = j;
                        return next;
                      })
                    }
                  />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <button className="btn primary">Conferir respostas</button>
          {feedback && (
            <div aria-live="polite">
              <h4>
                {feedback.score} de {feedback.total} respostas corretas
              </h4>
              {feedback.feedback.map((f, i) => (
                <article className="notice" key={f.id}>
                  <strong>
                    Questão {i + 1}:{" "}
                    {f.correct ? "correta" : "revise este ponto"}
                  </strong>
                  <p>Resposta: {f.answer}</p>
                  <p>{f.explanation}</p>
                </article>
              ))}
            </div>
          )}
          <small>
            Atividade de estudo; não emite certificação profissional.
          </small>
        </form>
      )}
    </section>
  );
}
function ExternalVideo({ url, title }: { url: string; title: string }) {
  const [load, setLoad] = useState(false);
  return load ? (
    <iframe
      title={title}
      src={url}
      allow="fullscreen; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-presentation"
      loading="lazy"
    />
  ) : (
    <div className="notice">
      <p>
        Este vídeo é hospedado por um serviço externo. Ao carregá-lo, seu
        navegador se comunica com esse fornecedor.
      </p>
      <button className="btn secondary small" onClick={() => setLoad(true)}>
        Carregar vídeo da aula
      </button>
    </div>
  );
}
export function LearningAuthor({
  id,
  onSaved,
}: {
  id: string;
  onSaved?: () => void;
}) {
  const [data, setData] = useState<{
      cards: Card[];
      questions: Question[];
      lessons: Lesson[];
    }>({ cards: [], questions: [], lessons: [] }),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    callApi("learning-author?id=" + encodeURIComponent(id))
      .then((d) => setData(d.package as typeof data))
      .catch((e) => setMessage(e.message));
  }, [id]);
  return (
    <details className="panel learning-author">
      <summary>Flashcards, questões e aulas deste material</summary>
      <p>
        Cadastre atividades originais. Salvar exige nova análise editorial do
        material.
      </p>
      {message && <p role="status">{message}</p>}
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const d = await callApi("learning-author", {
              ...data,
              product_id: id,
            });
            setData(d.package as typeof data);
            setMessage("Atividades salvas. Submeta o material para revisão.");
            onSaved?.();
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h4>Cartões de revisão ({data.cards.length})</h4>
        {data.cards.map((c, i) => (
          <fieldset key={c.id}>
            <legend>Cartão {i + 1}</legend>
            <label>
              Frente
              <textarea
                value={c.front}
                onChange={(e) =>
                  setData({
                    ...data,
                    cards: data.cards.map((x, j) =>
                      j === i ? { ...x, front: e.target.value } : x,
                    ),
                  })
                }
                required
                minLength={2}
                maxLength={3000}
              />
            </label>
            <label>
              Verso
              <textarea
                value={c.back}
                onChange={(e) =>
                  setData({
                    ...data,
                    cards: data.cards.map((x, j) =>
                      j === i ? { ...x, back: e.target.value } : x,
                    ),
                  })
                }
                required
                minLength={2}
                maxLength={5000}
              />
            </label>
            <button
              type="button"
              className="text-link"
              onClick={() =>
                setData({
                  ...data,
                  cards: data.cards.filter((_, j) => j !== i),
                })
              }
            >
              Remover cartão
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="btn secondary small"
          disabled={data.cards.length >= 300}
          onClick={() =>
            setData({
              ...data,
              cards: [
                ...data.cards,
                { id: crypto.randomUUID(), front: "", back: "" },
              ],
            })
          }
        >
          Adicionar cartão
        </button>
        <h4>Questões comentadas ({data.questions.length})</h4>
        {data.questions.map((q, i) => (
          <fieldset key={q.id}>
            <legend>Questão {i + 1}</legend>
            <label>
              Enunciado
              <textarea
                required
                minLength={5}
                maxLength={4000}
                value={q.prompt}
                onChange={(e) =>
                  setData({
                    ...data,
                    questions: data.questions.map((x, j) =>
                      i === j ? { ...x, prompt: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
            {q.options.map((v, j) => (
              <div className="quiz-option-edit" key={j}>
                <label className="check-label">
                  <input
                    type="radio"
                    name={"correct-" + q.id}
                    checked={q.correct === j}
                    onChange={() =>
                      setData({
                        ...data,
                        questions: data.questions.map((x, n) =>
                          n === i ? { ...x, correct: j } : x,
                        ),
                      })
                    }
                  />
                  <span>Gabarito</span>
                </label>
                <label>
                  Alternativa {j + 1}
                  <input
                    required
                    maxLength={1000}
                    value={v}
                    onChange={(e) =>
                      setData({
                        ...data,
                        questions: data.questions.map((x, n) =>
                          n === i
                            ? {
                                ...x,
                                options: x.options.map((o, k) =>
                                  k === j ? e.target.value : o,
                                ),
                              }
                            : x,
                        ),
                      })
                    }
                  />
                </label>
              </div>
            ))}
            <label>
              Explicação e referência
              <textarea
                value={q.explanation}
                maxLength={5000}
                onChange={(e) =>
                  setData({
                    ...data,
                    questions: data.questions.map((x, j) =>
                      i === j ? { ...x, explanation: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              className="text-link"
              onClick={() =>
                setData({
                  ...data,
                  questions: data.questions.filter((_, j) => j !== i),
                })
              }
            >
              Remover questão
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="btn secondary small"
          disabled={data.questions.length >= 200}
          onClick={() =>
            setData({
              ...data,
              questions: [
                ...data.questions,
                {
                  id: crypto.randomUUID(),
                  prompt: "",
                  options: ["", "", "", ""],
                  correct: 0,
                  explanation: "",
                },
              ],
            })
          }
        >
          Adicionar questão
        </button>
        <h4>Aulas e trilha ({data.lessons.length})</h4>
        {data.lessons.map((l, i) => (
          <fieldset key={l.id}>
            <legend>Aula {i + 1}</legend>
            <label>
              Título
              <input
                value={l.title}
                required
                minLength={3}
                maxLength={150}
                onChange={(e) =>
                  setData({
                    ...data,
                    lessons: data.lessons.map((x, j) =>
                      j === i ? { ...x, title: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
            <label>
              Texto da aula
              <textarea
                value={l.text}
                required
                minLength={10}
                maxLength={20000}
                onChange={(e) =>
                  setData({
                    ...data,
                    lessons: data.lessons.map((x, j) =>
                      j === i ? { ...x, text: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
            <label>
              Vídeo opcional · URL de incorporação do YouTube ou Vimeo
              <input
                type="url"
                value={l.video_url}
                maxLength={500}
                placeholder="https://www.youtube.com/embed/..."
                onChange={(e) =>
                  setData({
                    ...data,
                    lessons: data.lessons.map((x, j) =>
                      j === i ? { ...x, video_url: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              className="text-link"
              onClick={() =>
                setData({
                  ...data,
                  lessons: data.lessons.filter((_, j) => j !== i),
                })
              }
            >
              Remover aula
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="btn secondary small"
          disabled={data.lessons.length >= 100}
          onClick={() =>
            setData({
              ...data,
              lessons: [
                ...data.lessons,
                { id: crypto.randomUUID(), title: "", text: "", video_url: "" },
              ],
            })
          }
        >
          Adicionar aula
        </button>
        <button className="btn primary" disabled={busy}>
          {busy ? "Salvando…" : "Salvar atividades para revisão"}
        </button>
      </form>
    </details>
  );
}
