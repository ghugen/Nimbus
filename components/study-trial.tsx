"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
import { PdfReader } from "./pdf-reader";
import { StudyAssistant } from "./study-assistant";
type Card = { id: string; front: string; back: string; page: number };
type Question = { id: string; prompt: string; options: string[]; page: number };
type Feedback = {
  score: number;
  total: number;
  feedback: {
    id: string;
    correct: boolean;
    answer: string;
    explanation: string;
    page: number;
  }[];
};
export function StudyTrial() {
  const [cards, setCards] = useState<Card[]>([]),
    [questions, setQuestions] = useState<Question[]>([]),
    [answers, setAnswers] = useState<number[]>([]),
    [feedback, setFeedback] = useState<Feedback | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [jump, setJump] = useState<{ page: number; key: number }>({
      page: 1,
      key: 0,
    });
  function onPage(page: number) {
    setJump({ page, key: Date.now() });
    document
      .getElementById("trial-reader")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  useEffect(() => {
    callApi("demo-learning")
      .then((d) => {
        setCards(d.cards as Card[]);
        setQuestions(d.questions as Question[]);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="container page-section trial-page">
      <a className="text-link" href="/">
        ← Voltar à Nimbus
      </a>
      <span className="eyebrow">UMA EXPERIÊNCIA COMPLETA, SEM CUSTO</span>
      <h1>Experimente seu próximo jeito de estudar.</h1>
      <p className="lead">
        Leia o guia original de revisão ativa, pratique com cartões e confira
        três questões. Você pode começar sem criar uma conta.
      </p>
      <div className="studio-actions">
        <a
          className="btn primary"
          href="/materiais-gratuitos/revisao-ativa.pdf"
          download
        >
          Baixar guia gratuito · PDF
        </a>
        <a className="btn secondary" href="/#gratuitos">
          Conhecer os quatro guias
        </a>
      </div>
      <section className="panel" id="trial-reader">
        <h2>1. Leia e explore</h2>
        <PdfReader
          productId="revisao-ativa"
          publicSource="/materiais-gratuitos/revisao-ativa.pdf"
          jump={jump}
        />
      </section>
      <section className="panel">
        <h2>2. Tente responder antes de abrir o cartão</h2>
        <div className="market-grid">
          {cards.map((c) => (
            <details className="practice-card" key={c.id}>
              <summary>{c.front}</summary>
              <p>{c.back}</p>
              <button className="text-link" onClick={() => onPage(c.page)}>
                Conferir página {c.page}
              </button>
            </details>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>3. Confira sua compreensão</h2>
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              setFeedback(
                (await callApi("demo-quiz", { answers })) as Feedback,
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {questions.map((q, i) => (
            <fieldset key={q.id}>
              <legend>
                {i + 1}. {q.prompt}
              </legend>
              {q.options.map((o, n) => (
                <label className="check-label" key={o}>
                  <input
                    type="radio"
                    name={q.id}
                    required
                    checked={answers[i] === n}
                    onChange={() => {
                      setAnswers((a) => {
                        const v = [...a];
                        v[i] = n;
                        return v;
                      });
                      setFeedback(null);
                    }}
                  />
                  {o}
                </label>
              ))}
            </fieldset>
          ))}
          <button className="btn primary" disabled={busy || !questions.length}>
            {busy ? "Conferindo…" : "Conferir respostas"}
          </button>
        </form>
        {feedback && (
          <div role="status">
            <h3>
              {feedback.score} de {feedback.total} respostas corretas
            </h3>
            {feedback.feedback.map((f) => (
              <article key={f.id}>
                <strong>
                  {f.correct ? "✓ Correta" : "Retome este ponto"}: {f.answer}
                </strong>
                <p>{f.explanation}</p>
                <button className="text-link" onClick={() => onPage(f.page)}>
                  Consultar página {f.page}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <StudyAssistant productId="revisao-ativa" demo onPage={onPage} />
      <p className="muted">
        Esta experiência é sobre métodos de estudo. O resultado não representa
        certificação nem avaliação acadêmica formal. Suas respostas desta
        demonstração não são salvas em uma conta.
      </p>
    </div>
  );
}
