"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
type Atlas = {
  image: number;
  caption: string;
  question: string;
  answer: string;
  source: string;
  points: { x: number; y: number; label: string }[];
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
                      .map((l) => {
                        const [x, y, ...label] = l.split("|");
                        return {
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
            <article className="source-card" key={i}>
              <div className="atlas-image">
                <img
                  src={"/api/asset/" + id + "/preview/" + a.image}
                  alt={a.caption}
                />
                {a.points.map((p, n) => (
                  <span
                    key={n}
                    style={{ left: p.x + "%", top: p.y + "%" }}
                    title={p.label}
                  >
                    {n + 1}
                  </span>
                ))}
              </div>
              <p className="pre-line">{a.caption}</p>
              <ol>
                {a.points.map((p, n) => (
                  <li key={n}>{p.label}</li>
                ))}
              </ol>
              <p>Fonte: {a.source || "Não informada"}</p>
              {a.question && (
                <details>
                  <summary>{a.question}</summary>
                  <p>{a.answer}</p>
                </details>
              )}
            </article>
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
