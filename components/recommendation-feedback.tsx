"use client";
import { useState } from "react";
import { callApi } from "./commerce-panels";
export function RecommendationFeedback({
  id,
  signedIn,
  onHide,
}: {
  id: string;
  signedIn: boolean;
  onHide: (id: string) => void;
}) {
  const [reason, setReason] = useState("off_topic"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <details className="recommend-feedback">
      <summary>Esta indicação não ajudou?</summary>
      <label>
        Motivo
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="off_topic">Não corresponde ao tema</option>
          <option value="too_advanced">Avançado demais</option>
          <option value="already_know">Já conheço este conteúdo</option>
        </select>
      </label>
      <p>
        Ocultar retira o material das próximas sugestões desta sessão. Salvar na
        conta é opcional.
      </p>
      <button
        className="btn secondary small"
        onClick={() => {
          onHide(id);
          setMessage(
            "Oculto nesta sessão. Para desfazer, use Restaurar sugestões.",
          );
        }}
      >
        Ocultar nesta sessão
      </button>
      {signedIn && (
        <button
          className="btn secondary small"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await callApi("recommendation-feedback", {
                product_id: id,
                reason,
              });
              onHide(id);
              setMessage(
                "Preferência salva na conta. Você pode apagar em Preferências.",
              );
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Salvar motivo na minha conta
        </button>
      )}
      <p role="status">{message}</p>
    </details>
  );
}
