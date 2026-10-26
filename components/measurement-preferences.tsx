"use client";
import { useEffect, useState } from "react";
export function MeasurementPreferences({
  always = false,
}: {
  always?: boolean;
}) {
  const [choice, setChoice] = useState<string | null | undefined>();
  const [searchChoice, setSearchChoice] = useState(false);
  useEffect(() => {
    setChoice(localStorage.getItem("nimbus-analytics"));
    setSearchChoice(
      localStorage.getItem("nimbus-search-analytics-v1") === "yes",
    );
  }, []);
  if (
    choice === undefined ||
    (!always && choice !== null && (choice === "no" || searchChoice))
  )
    return null;
  function save(v: string) {
    localStorage.setItem("nimbus-analytics", v);
    localStorage.setItem("nimbus-search-analytics-v1", v);
    setSearchChoice(v === "yes");
    if (v === "no") sessionStorage.removeItem("nimbus-visitor");
    setChoice(v);
  }
  return (
    <div className="measurement-note">
      <div>
        <strong>Medição opcional de uso</strong>
        <p>
          Podemos contar visualizações, prévias, carrinhos e buscas por curso e
          disciplina (sem guardar o texto digitado) para melhorar o catálogo? A
          escolha é opcional, não usa publicidade e pode ser alterada na página
          de privacidade.
        </p>
      </div>
      <button className="btn secondary small" onClick={() => save("no")}>
        Não permitir
      </button>
      <button className="btn primary small" onClick={() => save("yes")}>
        {choice === "yes" ? "Medição permitida" : "Permitir medição"}
      </button>
    </div>
  );
}
