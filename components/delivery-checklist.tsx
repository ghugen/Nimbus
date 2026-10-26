"use client";
import { useState } from "react";
import { deliveryChecklist } from "@/lib/delivery-checklist";
const labels = {
  available: "Recurso disponível no código",
  partial: "Parcial",
  external: "Depende de configuração ou conteúdo",
  pending: "Adiado",
};
export function DeliveryChecklist() {
  const [query, setQuery] = useState("");
  return (
    <section className="panel">
      <span className="eyebrow">ESCOPO CONSOLIDADO</span>
      <h2>Lista de evolução da Nimbus</h2>
      <p>
        Os recursos abaixo complementam o acompanhamento das cem melhorias.
        Disponibilidade técnica não comprova ativação externa nem substitui
        testes com a operação real.
      </p>
      <label>
        Buscar melhoria
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Fiscal, contratos, pagamento, materiais…"
        />
      </label>
      {deliveryChecklist.map((g) => (
        <details key={g.group} open={!!query}>
          <summary>
            {g.group} · {g.items.length} itens
          </summary>
          {g.items
            .filter((i) =>
              i
                .join(" ")
                .toLocaleLowerCase("pt-BR")
                .includes(query.toLocaleLowerCase("pt-BR")),
            )
            .map(([title, state, evidence, path]) => (
              <article className="source-card" key={title}>
                <span className="badge">{labels[state]}</span>
                <h3>{title}</h3>
                <p>{evidence}</p>
                <a className="text-link" href={"/#" + encodeURI(path)}>
                  Abrir área relacionada ↗
                </a>
              </article>
            ))}
        </details>
      ))}
    </section>
  );
}
