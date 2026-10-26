"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
type Atlas = {
  image: number;
  caption: string;
  question: string;
  answer: string;
  source: string;
  points: {
    x: number;
    y: number;
    label: string;
    question?: string;
    answer?: string;
  }[];
};
export function EditorialTools({
  id,
  edit = false,
}: {
  id: string;
  edit?: boolean;
}) {
  const [data, setData] = useState<{
      glossary?: { term: string; definition: string }[];
      atlas?: Atlas[];
    }>({}),
    [query, setQuery] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false);
  useEffect(() => {
    if (open)
      callApi((edit ? "editorial-tools-edit" : "editorial-tools") + "?id=" + id)
        .then((d) => setData(d.tools as typeof data))
        .catch((e) => setMessage(e.message));
  }, [id, edit, open]);
  return (
    <details className="panel" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        {edit
          ? "Preparar glossário e atlas comentado"
          : "Glossário e atlas do material"}
      </summary>
      {message && <p role="status">{message}</p>}
      {edit ? (
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              const glossary = String(f.get("glossary"))
                .split("\n")
                .filter((x) => x.trim())
                .map((l) => {
                  const [term, ...definition] = l.split("|");
                  return {
                    term: term.trim(),
                    definition: definition.join("|").trim(),
                  };
                });
              await callApi("editorial-tools-edit", {
                product_id: id,
                glossary,
                atlas: data.atlas || [],
                rights: f.get("rights") === "on",
                deidentified: f.get("deidentified") === "on",
              });
              setMessage("Rascunho salvo. Solicite nova aprovação editorial.");
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Glossário: um termo e sua definição por linha, separados por |
            <textarea
              name="glossary"
              defaultValue={(data.glossary || [])
                .map((t) => t.term + " | " + t.definition)
                .join("\n")}
              key={JSON.stringify(data.glossary)}
              maxLength={150000}
            />
          </label>
          <p>
            O atlas usa as imagens de amostra já enviadas no cadastro. Essas
            imagens são públicas; use apenas imagens autorizadas e sem
            identificação de pacientes ou responsáveis. As legendas e exercícios
            ficam restritos aos titulares de acesso.
          </p>
          {(data.atlas || []).map((a, i) => (
            <fieldset key={i}>
              <legend>Imagem {i + 1}</legend>
              <label>
                Número da amostra (1 a 6)
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={a.image + 1}
                  onChange={(e) =>
                    setData((d) => ({
                      ...d,
                      atlas: d.atlas!.map((x, n) =>
                        n === i
                          ? { ...x, image: Number(e.target.value) - 1 }
                          : x,
                      ),
                    }))
                  }
                />
              </label>
              {(["caption", "source", "question", "answer"] as const).map(
                (k) => (
                  <label key={k}>
                    {
                      {
                        caption: "Legenda e descrição da imagem",
                        source: "Fonte e autorização",
                        question: "Pergunta de interpretação",
                        answer: "Comentário para conferência",
                      }[k]
                    }
                    <textarea
                      value={a[k]}
                      onChange={(e) =>
                        setData((d) => ({
                          ...d,
                          atlas: d.atlas!.map((x, n) =>
                            n === i ? { ...x, [k]: e.target.value } : x,
                          ),
                        }))
                      }
                    />
                  </label>
                ),
              )}
              <label>
                Marcações: uma por linha, no formato posição horizontal (%) |
                vertical (%) | legenda
                <textarea
                  defaultValue={a.points
                    .map((p) => `${p.x} | ${p.y} | ${p.label}`)
                    .join("\n")}
                  onBlur={(e) => {
                    const points = e.target.value
                      .split("\n")
                      .filter((l) => l.trim())
                      .map((l, pointIndex) => {
                        const [x, y, ...label] = l.split("|");
                        return {
                          question: a.points[pointIndex]?.question || "",
                          answer: a.points[pointIndex]?.answer || "",
                          x: Number(x),
                          y: Number(y),
                          label: label.join("|").trim(),
                        };
                      });
                    setData((d) => ({
                      ...d,
                      atlas: d.atlas!.map((x, n) =>
                        n === i ? { ...x, points } : x,
                      ),
                    }));
                  }}
                />
              </label>
              {a.points.map((point, n) => (
                <div className="source-card" key={n}>
                  <strong>Exercício da marcação {n + 1}</strong>
                  {(["question", "answer"] as const).map((key) => (
                    <label key={key}>
                      {key === "question" ? "Pergunta" : "Resposta comentada"}
                      <textarea
                        maxLength={key === "question" ? 1000 : 2000}
                        value={point[key] || ""}
                        onChange={(e) =>
                          setData((d) => ({
                            ...d,
                            atlas: d.atlas!.map((entry, j) =>
                              j === i
                                ? {
                                    ...entry,
                                    points: entry.points.map((p, k) =>
                                      k === n
                                        ? { ...p, [key]: e.target.value }
                                        : p,
                                    ),
                                  }
                                : entry,
                            ),
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              ))}
              <button
                className="text-link"
                type="button"
                onClick={() =>
                  setData((d) => ({
                    ...d,
                    atlas: d.atlas!.filter((_, n) => n !== i),
                  }))
                }
              >
                Remover imagem do atlas
              </button>
            </fieldset>
          ))}
          <button
            className="btn secondary"
            type="button"
            disabled={(data.atlas || []).length >= 6}
            onClick={() =>
              setData((d) => ({
                ...d,
                atlas: [
                  ...(d.atlas || []),
                  {
                    image: 0,
                    caption: "",
                    source: "",
                    question: "",
                    answer: "",
                    points: [],
                  },
                ],
              }))
            }
          >
            Adicionar imagem ao atlas
          </button>
          <label className="check-label">
            <input name="rights" type="checkbox" required />
            Tenho direitos para publicar os textos e imagens
          </label>
          <label className="check-label">
            <input name="deidentified" type="checkbox" required />
            Conferi a remoção de nomes, documentos e outras identificações
          </label>
          <button className="btn primary" disabled={busy}>
            Salvar para revisão
          </button>
        </form>
      ) : (
        <>
          <label>
            Buscar termo
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {(data.glossary || [])
            .filter((t) =>
              (t.term + " " + t.definition)
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((t) => (
              <details key={t.term}>
                <summary>{t.term}</summary>
                <p className="pre-line">{t.definition}</p>
              </details>
            ))}
          {!(data.glossary || []).length && (
            <p>O autor ainda não publicou um glossário.</p>
          )}
          {(data.atlas || []).map((a, i) => (
            <AtlasViewer
              key={i}
              id={id}
              atlas={a}
              others={(data.atlas || []).filter((_, n) => n !== i)}
            />
          ))}
        </>
      )}
    </details>
  );
}
export function VersionComparison({ id }: { id: string }) {
  const [versions, setVersions] = useState<{ id: string; sequence: number }[]>(
      [],
    ),
    [result, setResult] = useState<{
      total: number;
      notice: string;
      changes: { page: number; before: string; after: string }[];
    } | null>(null),
    [message, setMessage] = useState("");
  return (
    <details
      className="panel"
      onToggle={(e) => {
        if (e.currentTarget.open && !versions.length)
          callApi("versions?id=" + id)
            .then((d) => setVersions(d.versions as typeof versions))
            .catch((e) => setMessage(e.message));
      }}
    >
      <summary>Comparar versões do PDF</summary>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setMessage("Comparando texto…");
          try {
            setResult(
              (await callApi(
                "version-compare?" +
                  new URLSearchParams({
                    id,
                    a: String(f.get("a")),
                    b: String(f.get("b")),
                  }),
              )) as typeof result,
            );
            setMessage("");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        <label>
          Antes
          <select name="a">
            {versions.map((v) => (
              <option value={v.id} key={v.id}>
                Versão {v.sequence}
              </option>
            ))}
          </select>
        </label>
        <label>
          Depois
          <select name="b">
            {versions.map((v) => (
              <option value={v.id} key={v.id}>
                Versão {v.sequence}
              </option>
            ))}
          </select>
        </label>
        <button className="btn secondary" disabled={versions.length < 2}>
          Comparar
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      {result && (
        <>
          <p>
            {result.total} página(s) com texto alterado. {result.notice}
          </p>
          {result.changes.map((c) => (
            <article key={c.page}>
              <h4>Página {c.page}</h4>
              <div className="market-grid">
                <div>
                  <strong>Antes</strong>
                  <p className="pre-line">{c.before || "Página ausente"}</p>
                </div>
                <div>
                  <strong>Depois</strong>
                  <p className="pre-line">{c.after || "Página ausente"}</p>
                </div>
              </div>
            </article>
          ))}
        </>
      )}
    </details>
  );
}
export function ServiceStatus() {
  const [data, setData] = useState<{
    sales: { paused: boolean; message: string };
    incidents: {
      id: string;
      title: string;
      body: string;
      status: string;
      updated: string;
    }[];
    notice: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    callApi("service-status")
      .then((d) => setData(d as typeof data))
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <main className="container page-section">
      <a href="/">← Nimbus</a>
      <h1>Situação do serviço</h1>
      {message && <p role="status">{message}</p>}
      {data && (
        <>
          <p className="notice">
            {data.sales.paused
              ? "Novas compras suspensas pela operação."
              : "Sem suspensão administrativa de novas compras."}{" "}
            {data.sales.message}
          </p>
          <p>
            Essa informação não confirma a disponibilidade dos meios de
            pagamento.
          </p>
          {data.incidents.map((i) => (
            <article className="panel" key={i.id}>
              <span className="badge">
                {i.status === "resolved" ? "Resolvido" : "Em acompanhamento"}
              </span>
              <h2>{i.title}</h2>
              <p>{new Date(i.updated).toLocaleString("pt-BR")}</p>
              <p className="pre-line">{i.body}</p>
            </article>
          ))}
          {!data.incidents.length && (
            <p>Nenhum incidente publicado pela operação.</p>
          )}
          <p className="muted">{data.notice}</p>
          <a href="/#biblioteca">Acessar minha biblioteca</a>
        </>
      )}
    </main>
  );
}
export function StudyPaths() {
  const [paths, setPaths] = useState<
    {
      id: string;
      title: string;
      body: string;
      course: string;
      semester: string;
      items: { id: string; title: string }[];
    }[]
  >([]);
  useEffect(() => {
    callApi("study-paths").then((d) => setPaths(d.paths as typeof paths));
  }, []);
  return (
    <section className="container page-section">
      <h1>Trilhas por disciplina e semestre</h1>
      <p>
        Sequências sugeridas pela curadoria; não substituem a matriz curricular
        ou o plano de ensino.
      </p>
      {!paths.length && (
        <p>A curadoria ainda não publicou trilhas com materiais reais.</p>
      )}
      {paths.map((p) => (
        <article className="panel" key={p.id}>
          <h2>{p.title}</h2>
          <p>
            {p.course} · {p.semester}
          </p>
          <p className="pre-line">{p.body}</p>
          <ol>
            {p.items.map((i) => (
              <li key={i.id}>
                <a href={"/materiais/" + i.id}>{i.title}</a>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </section>
  );
}
export function MaterialErrata({ id }: { id: string }) {
  const [items, setItems] = useState<
    { id: string; title: string; body: string }[]
  >([]);
  useEffect(() => {
    callApi("material-errata?id=" + id)
      .then((d) => setItems(d.errata as typeof items))
      .catch(() => {});
  }, [id]);
  return items.length ? (
    <section
      className="notice"
      role="region"
      aria-label="Correções importantes"
    >
      <h3>Correções importantes</h3>
      {items.map((i) => (
        <article key={i.id}>
          <h4>{i.title}</h4>
          <p className="pre-line">{i.body}</p>
        </article>
      ))}
    </section>
  ) : null;
}

export function SalesNotice() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    callApi("service-status")
      .then((d) => {
        const s = d.sales as { paused: boolean; message: string };
        if (s.paused) setMessage(s.message);
      })
      .catch(() => {});
  }, []);
  return message ? (
    <div className="notice" role="status">
      Novas compras suspensas: {message}{" "}
      <a href="/situacao">Acompanhar situação</a>
    </div>
  ) : null;
}

function AtlasViewer({
  id,
  atlas: a,
  others,
}: {
  id: string;
  atlas: Atlas;
  others: Atlas[];
}) {
  const [zoom, setZoom] = useState(100),
    [labels, setLabels] = useState(true),
    [active, setActive] = useState<number | null>(null),
    [compare, setCompare] = useState(-1);
  function image(entry: Atlas, interactive: boolean) {
    return (
      <div
        className="atlas-scroll"
        tabIndex={0}
        aria-label="Imagem ampliada; use as barras para navegar"
      >
        <div
          className="atlas-image"
          style={{ width: zoom + "%", maxWidth: "none" }}
        >
          <img
            src={"/api/asset/" + id + "/preview/" + entry.image}
            alt={entry.caption}
          />
          {entry.points.map((p, n) =>
            interactive ? (
              <button
                className="atlas-marker"
                key={n}
                style={{ left: p.x + "%", top: p.y + "%" }}
                aria-label={
                  labels
                    ? `Marcação ${n + 1}: ${p.label}`
                    : `Exercitar marcação ${n + 1}`
                }
                onClick={() => setActive(n)}
              >
                {n + 1}
              </button>
            ) : (
              <span key={n} style={{ left: p.x + "%", top: p.y + "%" }}>
                {n + 1}
              </span>
            ),
          )}
        </div>
      </div>
    );
  }
  return (
    <article className="source-card">
      <div className="studio-actions">
        <label>
          Ampliação
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            {[100, 150, 200, 300].map((n) => (
              <option value={n} key={n}>
                {n}%
              </option>
            ))}
          </select>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={labels}
            onChange={(e) => setLabels(e.target.checked)}
          />
          Mostrar legendas
        </label>
        {others.length > 0 && (
          <label>
            Comparar com
            <select
              value={compare}
              onChange={(e) => setCompare(Number(e.target.value))}
            >
              <option value={-1}>Sem comparação</option>
              {others.map((o, i) => (
                <option value={i} key={i}>
                  {o.caption || "Imagem " + (i + 1)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className={compare >= 0 ? "atlas-compare" : ""}>
        <div>
          {image(a, true)}
          <p className="pre-line">{a.caption}</p>
          <p>Fonte: {a.source || "Não informada"}</p>
        </div>
        {compare >= 0 && others[compare] && (
          <div>
            {image(others[compare], false)}
            <p>{others[compare].caption}</p>
            <p>Fonte: {others[compare].source || "Não informada"}</p>
          </div>
        )}
      </div>
      {labels && (
        <ol>
          {a.points.map((p, i) => (
            <li key={i}>{p.label}</li>
          ))}
        </ol>
      )}
      {active !== null && a.points[active] && (
        <section className="notice" key={active}>
          <h4>Marcação {active + 1}</h4>
          <p>
            {a.points[active].question ||
              "Qual conceito ou estrutura esta marcação indica?"}
          </p>
          <details>
            <summary>Conferir resposta</summary>
            <p>{a.points[active].answer || a.points[active].label}</p>
          </details>
        </section>
      )}
      {a.question && (
        <details>
          <summary>{a.question}</summary>
          <p>{a.answer}</p>
        </details>
      )}
    </article>
  );
}
