"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
import { ContextHelp } from "./context-help";
type Result = {
  message: string;
  mode: string;
  sources: { page: number; text: string }[];
  answer?: string;
  citations?: number[];
  practice?: { question: string; answer: string; page: number }[];
};
export function StudyAssistant({
  productId,
  demo = false,
  onPage,
}: {
  productId: string;
  demo?: boolean;
  onPage: (page: number) => void;
}) {
  const [question, setQuestion] = useState(""),
    [result, setResult] = useState<Result | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ai, setAi] = useState(false),
    [generate, setGenerate] = useState(false),
    [consent, setConsent] = useState(false);
  useEffect(() => {
    setResult(null);
    setAi(false);
    if (!demo)
      callApi("study-assistant?id=" + encodeURIComponent(productId))
        .then((d) => setAi(d.ai_available === true))
        .catch((e) => setError(e.message));
  }, [productId, demo]);
  return (
    <section className="panel study-assistant">
      <span className="eyebrow">ESTUDE COM A FONTE ABERTA</span>
      <h2>Pergunte ao material</h2>
      <p>
        Encontre trechos relacionados à sua pergunta e confira a página
        original.
      </p>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            setResult(
              (await callApi(demo ? "demo-assistant" : "study-assistant", {
                product_id: productId,
                question,
                generate,
                consent,
              })) as Result,
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Sua pergunta
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            minLength={5}
            maxLength={1200}
            required
            placeholder="Como conferir minha resposta na revisão?"
          />
        </label>
        {ai && (
          <>
            <label className="check-label">
              <input
                type="checkbox"
                checked={generate}
                onChange={(e) => setGenerate(e.target.checked)}
              />
              Pedir explicação por IA com base nos trechos encontrados
            </label>
            {generate && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={consent}
                  required
                  onChange={(e) => setConsent(e.target.checked)}
                />
                Autorizo enviar esta pergunta e os trechos ao provedor de IA.
                Não incluo dados pessoais ou casos reais.
              </label>
            )}
          </>
        )}
        <button className="btn secondary" disabled={busy}>
          {busy
            ? "Consultando…"
            : generate
              ? "Gerar explicação"
              : "Buscar trechos"}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div aria-live="polite">
          <p className="notice">{result.message}</p>
          {result.answer && <p className="pre-line">{result.answer}</p>}
          {result.sources.map((s, i) => (
            <article className="source-card" key={i}>
              <button className="text-link" onClick={() => onPage(s.page)}>
                Conferir página {s.page} ↗
              </button>
              <blockquote className="pre-line">{s.text}</blockquote>
            </article>
          ))}
          {result.practice?.map((q, i) => (
            <details key={i}>
              <summary>{q.question}</summary>
              <p>{q.answer}</p>
              <button className="text-link" onClick={() => onPage(q.page)}>
                Página {q.page}
              </button>
            </details>
          ))}
        </div>
      )}
      <ContextHelp topic="tutor" />
    </section>
  );
}
