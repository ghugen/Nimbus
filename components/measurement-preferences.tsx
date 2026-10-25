"use client";
import { useEffect, useState } from "react";
export function MeasurementPreferences({
  always = false,
}: {
  always?: boolean;
}) {
  const [choice, setChoice] = useState<string | null | undefined>();
  useEffect(() => {
    setChoice(localStorage.getItem("nimbus-analytics"));
  }, []);
  if (choice === undefined || (!always && choice !== null)) return null;
  function save(v: string) {
    localStorage.setItem("nimbus-analytics", v);
    if (v === "no") sessionStorage.removeItem("nimbus-visitor");
    setChoice(v);
  }
  return (
    <div className="measurement-note">
      <div>
        <strong>Medição opcional de uso</strong>
        <p>
          Podemos contar visualizações, prévias e carrinhos para melhorar o
          catálogo? A escolha é opcional, não usa publicidade e pode ser
          alterada na página de privacidade.
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
