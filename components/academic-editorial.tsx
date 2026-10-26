"use client";
import { useState } from "react";
import { callApi } from "./commerce-panels";
type Meta = {
  institution: string;
  course_code: string;
  isbn: string;
  edition: string;
};
export function AcademicMetadataEditor({ id }: { id: string }) {
  const [data, setData] = useState<Meta>({
      institution: "",
      course_code: "",
      isbn: "",
      edition: "",
    }),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <details
      className="panel"
      onToggle={(e) => {
        if (e.currentTarget.open)
          callApi("academic-metadata?id=" + id)
            .then((d) => setData(d.metadata as Meta))
            .catch((e) => setMessage(e.message));
      }}
    >
      <summary>Instituição, código da disciplina e edição</summary>
      <p>
        Use a instituição como contexto de estudo. Isso não representa vínculo
        ou aprovação oficial. ISBN identifica a referência, sem autorizar sua
        reprodução.
      </p>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await callApi("academic-metadata", { product_id: id, ...data });
            setMessage(
              "Dados salvos em rascunho. Solicite nova aprovação editorial.",
            );
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {(
          [
            ["institution", "Instituição"],
            ["course_code", "Código da disciplina"],
            ["isbn", "ISBN da referência (opcional)"],
            ["edition", "Edição"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              value={data[key] || ""}
              maxLength={key === "isbn" ? 30 : 200}
              onChange={(e) => setData({ ...data, [key]: e.target.value })}
            />
          </label>
        ))}
        <button className="btn secondary" disabled={busy}>
          Salvar para revisão
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
export function AcademicSearch({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  const [items, setItems] = useState<
      | {
          id: string;
          title: string;
          course: string;
          subject: string;
          metadata: Partial<Meta>;
        }[]
      | null
    >(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <details className="panel">
      <summary>Busca por instituição, disciplina, ISBN ou edição</summary>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          const q = new FormData(e.currentTarget).get("q");
          setBusy(true);
          try {
            setItems(
              (
                await callApi(
                  "academic-search?q=" + encodeURIComponent(String(q || "")),
                )
              ).products as typeof items,
            );
            setMessage("");
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Termo de busca
          <input
            name="q"
            maxLength={100}
            placeholder="Instituição, código da disciplina ou ISBN"
          />
        </label>
        <button className="btn secondary" disabled={busy}>
          Buscar materiais
        </button>
      </form>
      {items?.length === 0 && <p>Nenhum material publicado encontrado.</p>}
      {items?.map((p) => (
        <article className="source-card" key={p.id}>
          <button className="text-link" onClick={() => onSelect(p.id)}>
            {p.title}
          </button>
          <p>
            {p.course} · {p.subject}
          </p>
          <p>{Object.values(p.metadata).filter(Boolean).join(" · ")}</p>
        </article>
      ))}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
type Draft = {
  id: string;
  kind: string;
  data: string;
  sources: string;
  created: string;
};
export function EditorialAI({ id }: { id: string }) {
  const [available, setAvailable] = useState(false),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const d = await callApi("editorial-ai?id=" + id);
    setAvailable(!!d.available);
    setDrafts(d.drafts as Draft[]);
  }
  return (
    <details
      className="panel"
      onToggle={(e) => {
        if (e.currentTarget.open) load().catch((e) => setMessage(e.message));
      }}
    >
      <summary>Assistência editorial por IA</summary>
      <p>
        Prepara até cinco itens a partir de até três páginas do seu PDF. Confira
        autoria, precisão e páginas citadas. A incorporação salva um rascunho
        para edição; a publicação depende da revisão editorial.
      </p>
      {!available && (
        <p className="notice">
          A geração aguarda a configuração de um provedor e modelo de IA. Nenhum
          trecho será enviado enquanto estiver desativada.
        </p>
      )}
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await callApi("editorial-ai", {
              product_id: id,
              kind: f.get("kind"),
              page: Number(f.get("page")),
              consent: f.get("consent") === "on",
              rights: f.get("rights") === "on",
            });
            await load();
            setMessage("Rascunho gerado. Confira cada item abaixo.");
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Preparar
          <select name="kind">
            <option value="cards">Cartões de revisão</option>
            <option value="questions">Questões comentadas</option>
            <option value="glossary">Glossário</option>
            <option value="map">Relações para mapa conceitual</option>
          </select>
        </label>
        <label>
          Página inicial
          <input type="number" name="page" min={1} defaultValue={1} />
        </label>
        <label className="check-label">
          <input type="checkbox" name="rights" required />
          Tenho autorização para usar o conteúdo
        </label>
        <label className="check-label">
          <input type="checkbox" name="consent" required />
          Autorizo enviar os trechos selecionados ao provedor configurado para
          gerar este rascunho
        </label>
        <button className="btn secondary" disabled={busy || !available}>
          Gerar rascunho para conferência
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      {drafts.map((d) => {
        const content = JSON.parse(d.data) as Record<
          string,
          Record<string, unknown>[]
        >;
        const sources = JSON.parse(d.sources) as {
          page: number;
          text: string;
        }[];
        return (
          <article className="source-card" key={d.id}>
            <h4>
              Rascunho · {new Date(d.created).toLocaleDateString("pt-BR")}
            </h4>
            {Object.entries(content)
              .filter(([, v]) => v.length)
              .map(([kind, items]) => (
                <section key={kind}>
                  <h5>
                    {(
                      {
                        cards: "Cartões",
                        questions: "Questões",
                        glossary: "Glossário",
                        map: "Relações conceituais",
                      } as Record<string, string>
                    )[kind] || kind}
                  </h5>
                  {items.map((item, i) => (
                    <div className="source-card" key={i}>
                      {Object.entries(item).map(([key, v]) => (
                        <p className="pre-line" key={key}>
                          <strong>
                            {(
                              {
                                front: "Frente",
                                back: "Verso",
                                prompt: "Enunciado",
                                options: "Alternativas",
                                correct: "Índice correto (começa em 0)",
                                explanation: "Comentário",
                                option_explanations:
                                  "Comentários por alternativa",
                                page: "Página",
                                term: "Termo",
                                definition: "Definição",
                                concept: "Conceito",
                                relation: "Relação",
                                target: "Conceito relacionado",
                              } as Record<string, string>
                            )[key] || key}
                            :
                          </strong>{" "}
                          {Array.isArray(v) ? v.join("\n") : String(v)}
                        </p>
                      ))}
                    </div>
                  ))}
                </section>
              ))}
            <details>
              <summary>Conferir trechos de origem</summary>
              {sources.map((s) => (
                <p className="pre-line" key={s.page}>
                  <strong>Página {s.page}</strong> · {s.text}
                </p>
              ))}
            </details>
            {d.kind === "map" ? (
              <p>
                Use as relações acima para desenhar e editar seu mapa
                conceitual. Elas não são publicadas automaticamente.
              </p>
            ) : (
              <form
                className="form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    await callApi("editorial-ai", {
                      product_id: id,
                      action: "adopt",
                      draft_id: d.id,
                      reviewed: true,
                    });
                    setMessage(
                      "Incorporado ao rascunho editorial. Confira e edite na ferramenta correspondente antes de solicitar publicação.",
                    );
                  } catch (e) {
                    setMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="check-label">
                  <input type="checkbox" required />
                  Conferi todos os itens e as páginas de origem
                </label>
                <button className="btn secondary small" disabled={busy}>
                  Incorporar ao rascunho para edição
                </button>
              </form>
            )}
          </article>
        );
      })}
    </details>
  );
}
