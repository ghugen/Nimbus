"use client";
import {DeliveryChecklist} from "./delivery-checklist";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
type Item = {
  id: number;
  title: string;
  category: string;
  implementation: string;
  evidence: string;
  owner: string;
  deadline: string;
  status: string;
  notes: string;
};
const labels: Record<string, string> = {
  implemented: "Implementado",
  partial: "Parcial",
  external: "Depende de ativação externa",
  pending: "Pendente",
};
export function RoadmapPanel() {
  const [items, setItems] = useState<Item[]>([]),
    [category, setCategory] = useState(""),
    [state, setState] = useState(""),
    [query, setQuery] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    callApi("roadmap")
      .then((d) => setItems(d.items as Item[]))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section>
      <DeliveryChecklist/>
      <span className="eyebrow">EVOLUÇÃO COM EVIDÊNCIAS</span>
      <h2>As 100 melhorias da Nimbus</h2>
      <p className="notice">
        O estado técnico abaixo descreve o que foi implementado e suas
        limitações. O andamento de planejamento é editável; marcar uma tarefa
        como concluída não ativa integrações nem altera a avaliação técnica.
      </p>
      {error && <p className="error">{error}</p>}
      <div className="overview-metrics">
        {Object.entries(labels).map(([key, label]) => (
          <div className="panel" key={key}>
            <small>{label}</small>
            <strong>
              {items.filter((i) => i.implementation === key).length}
            </strong>
          </div>
        ))}
      </div>
      <div className="plan-filters">
        <label>
          Buscar
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Leitor, mentoria, pagamentos…"
          />
        </label>
        <label>
          Grupo
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Todos</option>
            {[...new Set(items.map((i) => i.category))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Estado técnico
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(labels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="roadmap-list">
        {items
          .filter(
            (i) =>
              (!category || i.category === category) &&
              (!state || i.implementation === state) &&
              i.title.toLowerCase().includes(query.toLowerCase()),
          )
          .map((i) => (
            <RoadmapItem
              key={i.id}
              item={i}
              onSaved={(next) =>
                setItems((all) => all.map((x) => (x.id === next.id ? next : x)))
              }
            />
          ))}
      </div>
    </section>
  );
}
function RoadmapItem({
  item: i,
  onSaved,
}: {
  item: Item;
  onSaved: (i: Item) => void;
}) {
  const [message, setMessage] = useState("");
  return (
    <details className="panel roadmap-item">
      <summary>
        <span>{String(i.id).padStart(3, "0")}</span>
        <strong>{i.title}</strong>
        <small className={"badge implementation-" + i.implementation}>
          {labels[i.implementation]}
        </small>
      </summary>
      <p className="notice">{i.evidence}</p>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(e.currentTarget)),
            next = { ...i, ...d };
          try {
            await callApi("roadmap", next);
            onSaved(next);
            setMessage("Planejamento salvo.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        <div className="form-row">
          <label>
            Responsável
            <input name="owner" defaultValue={i.owner} maxLength={100} />
          </label>
          <label>
            Prazo
            <input type="date" name="deadline" defaultValue={i.deadline} />
          </label>
        </div>
        <label>
          Andamento
          <select name="status" defaultValue={i.status}>
            <option value="open">A fazer</option>
            <option value="in_progress">Em andamento</option>
            <option value="waiting">Aguardando dependência</option>
            <option value="done">Concluído no planejamento</option>
          </select>
        </label>
        <label>
          Observações
          <textarea name="notes" defaultValue={i.notes} maxLength={5000} />
        </label>
        <button className="btn secondary small">Salvar planejamento</button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
