"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
import { money, type Product } from "@/lib/catalog";
export function MaterialComparison({
  products,
  onClose,
}: {
  products: Product[];
  onClose: () => void;
}) {
  return (
    <details className="panel comparison" open>
      <summary>Comparar materiais ({products.length})</summary>
      <p>Confira formato, assunto e público antes de escolher.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Característica</th>
              {products.map((p) => (
                <th key={p.id}>
                  <a href={"/materiais/" + p.id}>{p.title}</a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Formato", ...products.map((p) => p.format)],
              ["Nível", ...products.map((p) => p.level)],
              ["Autoria", ...products.map((p) => p.author)],
              ["Assunto", ...products.map((p) => p.topic || "Não informado")],
              ["Disciplina", ...products.map((p) => p.subject)],
              ["Curso", ...products.map((p) => p.course || "")],
              ["Páginas", ...products.map((p) => String(p.pages))],
              [
                "Preço",
                ...products.map((p) =>
                  p.demo && p.price > 0 ? "Demonstrativo" : money(p.price),
                ),
              ],
              [
                "Atualização",
                ...products.map((p) =>
                  new Date(p.updated || p.created).toLocaleDateString("pt-BR"),
                ),
              ],
            ].map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) =>
                  j ? <td key={j}>{cell}</td> : <th key={j}>{cell}</th>,
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="text-link" onClick={onClose}>
        Limpar comparação
      </button>
    </details>
  );
}
export function SavedFilters({
  filters,
  onLoad,
}: {
  filters: Record<string, unknown>;
  onLoad: (filters: Record<string, unknown>) => void;
}) {
  const [items, setItems] = useState<
      { id: string; title: string; filters: string }[]
    >([]),
    [message, setMessage] = useState("");
  async function load() {
    setItems((await callApi("saved-searches")).searches as typeof items);
  }
  useEffect(() => {
    load().catch(() => {});
  }, []);
  return (
    <details className="panel saved-filters">
      <summary>Minhas buscas salvas</summary>
      {message && <p role="status">{message}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = e.currentTarget;
          try {
            await callApi("saved-searches", {
              filters,
              title: new FormData(f).get("title"),
            });
            await load();
            f.reset();
            setMessage("Filtros salvos.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        <label>
          Nome desta busca
          <input
            name="title"
            required
            minLength={2}
            maxLength={100}
            placeholder="Entre na conta para salvar"
          />
        </label>
        <button className="btn secondary small">Salvar filtros atuais</button>
      </form>
      {items.map((x) => (
        <div className="saved-filter-row" key={x.id}>
          <button
            className="text-link"
            onClick={() => {
              try {
                onLoad(JSON.parse(x.filters));
              } catch {
                setMessage("Filtro inválido.");
              }
            }}
          >
            {x.title}
          </button>
          <button
            className="text-link"
            onClick={async () => {
              try {
                await callApi("saved-searches", { action: "delete", id: x.id });
                await load();
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Remover
          </button>
        </div>
      ))}
    </details>
  );
}
export function PreferredTopics({
  products,
  onApply,
}: {
  products: Product[];
  onApply: (topics: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [message, setMessage] = useState("");
  useEffect(() => {
    callApi("preferences")
      .then((d) => setSelected(d.interests as string[]))
      .catch(() => {});
  }, []);
  return (
    <details className="panel">
      <summary>Personalizar sugestões por assunto</summary>
      <p>
        Você escolhe os interesses; não utilizamos suas anotações privadas para
        recomendar produtos.
      </p>
      <div className="topic-choices">
        {[...new Set(products.map((p) => p.subject))].map((t) => (
          <label className="check-label" key={t}>
            <input
              type="checkbox"
              checked={selected.includes(t)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, t].slice(0, 15)
                    : selected.filter((x) => x !== t),
                )
              }
            />
            <span>{t}</span>
          </label>
        ))}
      </div>
      <button
        className="btn secondary small"
        onClick={async () => {
          try {
            await callApi("preferences", { interests: selected });
            onApply(selected);
            setMessage("Preferências salvas.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        Salvar e usar interesses
      </button>
      <button className="text-link" onClick={() => onApply([])}>
        Ver todos os assuntos
      </button>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
