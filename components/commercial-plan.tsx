"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
type Idea = {
  id: string;
  category: string;
  title: string;
  description: string;
  delivery: string;
  status: string;
  priority: string;
  notes: string;
  updated?: string;
};
const statuses = {
  evaluate: "A avaliar",
  planned: "Planejada",
  producing: "Em produção",
  available: "Disponível",
  postponed: "Adiada",
};
export function CommercialPlan() {
  const [ideas, setIdeas] = useState<Idea[]>([]),
    [category, setCategory] = useState(""),
    [status, setStatus] = useState(""),
    [query, setQuery] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    callApi("commercial-plan")
      .then((d) => setIdeas(d.ideas as Idea[]))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="commercial-plan">
      <span className="eyebrow">GUARDE AS PRÓXIMAS POSSIBILIDADES</span>
      <h2>Ideias de produtos e serviços</h2>
      <p className="lead">
        Um catálogo de possibilidades para lembrar, priorizar e desenvolver no
        seu tempo.
      </p>
      <p className="notice">
        Esta lista é um planejamento interno. Marcar uma ideia como disponível
        não publica um produto nem ativa cursos, agenda ou assinaturas. A
        indicação de entrega mostra o que o sistema já comporta e o que exige
        desenvolvimento.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="stats">
        <div className="stat">
          <strong>{ideas.length}</strong>
          <small>Ideias registradas</small>
        </div>
        <div className="stat">
          <strong>{ideas.filter((x) => x.priority === "high").length}</strong>
          <small>Prioridade alta</small>
        </div>
        <div className="stat">
          <strong>
            {
              ideas.filter((x) => ["planned", "producing"].includes(x.status))
                .length
            }
          </strong>
          <small>Planejadas ou em produção</small>
        </div>
      </div>
      <div className="plan-filters">
        <label>
          Buscar ideia
          <input
            type="search"
            placeholder="Apostilas, mapas, mentorias…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Categoria
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Todas</option>
            {[...new Set(ideas.map((x) => x.category))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Andamento
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(statuses).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="idea-grid">
        {ideas
          .filter(
            (i) =>
              (!category || i.category === category) &&
              (!status || i.status === status) &&
              [i.title, i.description]
                .join(" ")
                .toLocaleLowerCase("pt-BR")
                .includes(query.toLocaleLowerCase("pt-BR")),
          )
          .map((i) => (
            <IdeaCard
              key={i.id}
              idea={i}
              onSave={(next) =>
                setIdeas((old) => old.map((x) => (x.id === next.id ? next : x)))
              }
            />
          ))}
      </div>
    </section>
  );
}
function IdeaCard({
  idea: i,
  onSave,
}: {
  idea: Idea;
  onSave: (i: Idea) => void;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="panel form idea-card"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget),
          next = {
            ...i,
            status: String(f.get("status")),
            priority: String(f.get("priority")),
            notes: String(f.get("notes")),
            updated: new Date().toISOString(),
          };
        setBusy(true);
        try {
          await callApi("commercial-plan", next);
          onSave(next);
          setMessage("Planejamento salvo.");
        } catch (e) {
          setMessage((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="eyebrow">{i.category}</span>
      <h3>{i.title}</h3>
      <p>{i.description}</p>
      <p className="delivery-note">
        <strong>Entrega:</strong> {i.delivery}
      </p>
      <div className="form-row">
        <label>
          Andamento
          <select name="status" defaultValue={i.status}>
            {Object.entries(statuses).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prioridade
          <select name="priority" defaultValue={i.priority}>
            <option value="low">Baixa</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
          </select>
        </label>
      </div>
      <label>
        Suas observações
        <textarea
          name="notes"
          defaultValue={i.notes}
          maxLength={5000}
          rows={3}
          placeholder="Público, tema, formato, preço a avaliar, próximos passos…"
        />
      </label>
      <button className="btn secondary small" disabled={busy}>
        {busy ? "Salvando…" : "Salvar ideia"}
      </button>
      {message && <p role="status">{message}</p>}
      {i.updated && (
        <small>
          Atualizada em {new Date(i.updated).toLocaleDateString("pt-BR")}
        </small>
      )}
    </form>
  );
}
