"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { callApi } from "./commerce-panels";
import { PdfReader } from "./pdf-reader";
import { AdvancedPractice, AdaptiveCards } from "./advanced-practice";
import { LearningExperience } from "./learning-experience";
import { StudyAssistant } from "./study-assistant";
type Annotation = { id: string; page: number; kind: string; text: string };
type Session = {
  id: string;
  started: string;
  finished: string;
  summary?: string;
  page?: number;
  progress?: number;
  next_review?: string;
};
type Data = {
  state: { page: number; zoom: number; next_review: string };
  study: { notes: string; progress: number };
  annotations: Annotation[];
  sessions: Session[];
  due_cards: number;
};
export function StudyWorkspace({
  productId,
  isPdf,
  onSaved,
}: {
  productId: string;
  isPdf: boolean;
  onSaved?: () => void;
}) {
  const [data, setData] = useState<Data | null>(null),
    [tab, setTab] = useState("read"),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [notePage, setNotePage] = useState(1),
    [jump, setJump] = useState<{ page: number; key: number }>(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [kind, setKind] = useState("note"),
    [card, setCard] = useState<Annotation | null>(null),
    [revision, setRevision] = useState(0),
    [general, setGeneral] = useState(""),
    [progress, setProgress] = useState(0),
    [summary, setSummary] = useState(""),
    [due, setDue] = useState("");
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    setNotePage(page);
  }, [page]);
  const onPage = useCallback((p: number, n: number) => {
    setPage(p);
    setTotal(n);
  }, []);
  async function load(initial = false) {
    const d = (await callApi(
      "study-workspace?id=" + encodeURIComponent(productId),
    )) as Data;
    setData(d);
    if (initial) {
      setPage(d.state.page);
      setGeneral(d.study.notes);
      setProgress(d.study.progress);
      setDue(d.state.next_review || "");
    }
    return d;
  }
  useEffect(() => {
    let alive = true;
    callApi("study-workspace?id=" + encodeURIComponent(productId))
      .then((d) => {
        if (!alive) return;
        const v = d as Data;
        setData(v);
        setPage(v.state.page);
        setGeneral(v.study.notes);
        setProgress(v.study.progress);
        setDue(v.state.next_review || "");
      })
      .catch((e) => {
        if (alive) setMessage(e.message);
      });
    return () => {
      alive = false;
    };
  }, [productId]);
  const active = data?.sessions.find((s) => !s.finished),
    today = new Date().toISOString().slice(0, 10);
  function goPage(p: number) {
    setJump({ page: p, key: Date.now() });
    setTab("read");
  }
  const labels = [
    ["read", "Ler"],
    ["notes", "Anotar"],
    ["practice", "Praticar"],
  ] as const;
  return (
    <section className="study-workspace" aria-label="Estudar agora">
      <header className="study-heading">
        <div>
          <span className="eyebrow">ESTUDAR AGORA</span>
          <p>
            Página {page}
            {total ? ` de ${total}` : ""} · {data?.due_cards || 0} cartão(ões)
            com revisão agendada para hoje ou em atraso
          </p>
          {data?.state.next_review && (
            <p>Próxima revisão do material: {data.state.next_review}</p>
          )}
        </div>
        <button
          className="btn secondary small"
          disabled={busy || !data || !!active}
          onClick={async () => {
            setBusy(true);
            try {
              await callApi("study-session", {
                product_id: productId,
                action: "start",
              });
              await load();
              setMessage(
                "Sessão iniciada. Você pode sair e retomar este material.",
              );
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {active ? "Sessão em andamento" : "Iniciar sessão"}
        </button>
      </header>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <div className="study-tabs" role="group" aria-label="Etapas do estudo">
        {labels.map(([key, label], i) => (
          <button
            ref={(el) => {
              tabs.current[key] = el;
            }}
            id={"study-tab-" + key}

            aria-pressed={tab === key}
            aria-controls={"study-panel-" + key}
            tabIndex={tab === key ? 0 : -1}
            key={key}
            onClick={() => setTab(key)}
            onKeyDown={(e) => {
              const n =
                e.key === "ArrowRight"
                  ? (i + 1) % 3
                  : e.key === "ArrowLeft"
                    ? (i + 2) % 3
                    : e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? 2
                        : -1;
              if (n >= 0) {
                e.preventDefault();
                setTab(labels[n][0]);
                tabs.current[labels[n][0]]?.focus();
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={"study-columns study-view-" + tab}>
        <section
          className={"study-read " + (tab === "read" ? "mobile-active" : "")}
          id="study-panel-read"
          aria-labelledby="study-tab-read"
          role="region"
          hidden={tab === "practice"}
        >
          {isPdf ? (
            <PdfReader
              productId={productId}
              jump={jump}
              hideNotes
              onPageChange={onPage}
            />
          ) : (
            <p className="notice">
              Use o download para abrir este formato. Suas anotações e
              atividades continuam disponíveis aqui.
            </p>
          )}
          {isPdf && <StudyAssistant productId={productId} onPage={goPage} />}
        </section>
        <section
          className={
            "study-notebook " + (tab === "notes" ? "mobile-active" : "")
          }
          id="study-panel-notes"
          aria-labelledby="study-tab-notes"
          role="region"
          hidden={tab === "practice"}
        >
          <h3>Meu caderno</h3>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await callApi("page-annotations", {
                  product_id: productId,
                  page: notePage,
                  kind,
                  text: note,
                });
                setNote("");
                await load();
                setMessage("Anotação salva na página " + notePage + ".");
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Página da anotação
              <input
                type="number"
                value={notePage}
                min={1}
                max={total || 5000}
                onChange={(e) => setNotePage(Number(e.target.value))}
              />
            </label>
            <label>
              Tipo
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="note">Anotação</option>
                <option value="highlight">Trecho destacado</option>
                <option value="bookmark">Marcador</option>
              </select>
            </label>
            <label>
              Minha anotação
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                maxLength={5000}
                rows={4}
              />
            </label>
            <button className="btn secondary small" disabled={busy}>
              Salvar anotação
            </button>
          </form>
          {data?.annotations.map((a) => (
            <article className="source-card" key={a.id}>
              <button className="text-link" onClick={() => goPage(a.page)}>
                Página {a.page}
              </button>
              <p className="pre-line">{a.text}</p>
              <div className="studio-actions">
                <button
                  className="btn secondary small"
                  onClick={() => setCard(a)}
                >
                  Criar cartão desta anotação
                </button>
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await callApi("page-annotations", {
                        product_id: productId,
                        action: "delete",
                        id: a.id,
                      });
                      if (card?.id === a.id) setCard(null);
                      await load();
                    } catch (e) {
                      setMessage((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Remover anotação
                </button>
              </div>
            </article>
          ))}
          {card && (
            <form
              className="form source-card"
              key={card.id}
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                try {
                  const d = await callApi("annotation-card", {
                    product_id: productId,
                    annotation_id: card.id,
                    front: f.get("front"),
                  });
                  setRevision((n) => n + 1);
                  setCard(null);
                  setMessage(
                    d.already_created
                      ? "Esta anotação já tem um cartão pessoal."
                      : "Cartão privado criado com a página da fonte. Encontre-o em Praticar.",
                  );
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h4>Criar cartão privado · página {card.page}</h4>
              <label>
                Pergunta do cartão
                <textarea
                  name="front"
                  required
                  minLength={2}
                  maxLength={3000}
                  defaultValue="Como você explicaria esta anotação?"
                />
              </label>
              <p>Verso: {card.text}</p>
              <button className="btn primary small" disabled={busy}>
                Criar cartão com esta fonte
              </button>
              <button
                type="button"
                className="text-link"
                onClick={() => setCard(null)}
              >
                Cancelar
              </button>
            </form>
          )}
          <details>
            <summary>Anotações gerais do material</summary>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await callApi("study", {
                    id: productId,
                    notes: general,
                    progress,
                  });
                  setMessage("Anotações gerais e progresso salvos.");
                  onSaved?.();
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Minhas anotações gerais
                <textarea
                  value={general}
                  maxLength={20000}
                  onChange={(e) => setGeneral(e.target.value)}
                />
              </label>
              <button className="btn secondary small" disabled={busy}>
                Salvar anotações gerais
              </button>
            </form>
          </details>
        </section>
        <section
          id="study-panel-practice"
          role="region"
          aria-labelledby="study-tab-practice"
          hidden={tab !== "practice"}
        >
          <h3>Praticar com o material</h3>
          <AdaptiveCards key={revision} productId={productId} onPage={goPage} />
          <AdvancedPractice productId={productId} onPage={goPage} />
          <LearningExperience productId={productId} />
        </section>
      </div>
      <details className="study-finish" open={!!active}>
        <summary>Concluir sessão e planejar a revisão</summary>
        {active ? (
          <>
            <p>
              Sessão iniciada em{" "}
              {new Date(active.started).toLocaleString("pt-BR")}. Fechar o
              material mantém a sessão aberta. O registro não mede tempo de
              estudo ativo.
            </p>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await callApi("study-session", {
                    product_id: productId,
                    action: "finish",
                    session_id: active.id,
                    page,
                    progress,
                    summary,
                    notes: general,
                    next_review: due,
                  });
                  await load();
                  setSummary("");
                  setMessage(
                    "Sessão concluída. Progresso e próxima revisão salvos.",
                  );
                  onSaved?.();
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                O que estudei nesta sessão
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  maxLength={3000}
                />
              </label>
              <label>
                Meu progresso no material: {progress}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                />
              </label>
              <label>
                Próxima revisão (opcional)
                <input
                  type="date"
                  min={today}
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </label>
              <button className="btn primary" disabled={busy}>
                Concluir sessão
              </button>
            </form>
          </>
        ) : (
          <p>
            Inicie uma sessão para registrar seu estudo e planejar a próxima
            revisão. As anotações podem ser salvas a qualquer momento.
          </p>
        )}
      </details>
      <details>
        <summary>Minhas sessões anteriores</summary>
        {data?.sessions
          .filter((s) => s.finished)
          .map((s) => (
            <article className="source-card" key={s.id}>
              <strong>{new Date(s.finished).toLocaleString("pt-BR")}</strong>
              <p>
                Página {s.page} · Progresso {s.progress}%
                {s.next_review ? " · Revisão " + s.next_review : ""}
              </p>
              <p className="pre-line">
                {s.summary || "Sem resumo registrado."}
              </p>
            </article>
          ))}
      </details>
    </section>
  );
}
