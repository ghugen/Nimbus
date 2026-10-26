"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
export function SupportThread({
  id,
  readOnly = false,
}: {
  id: string;
  readOnly?: boolean;
}) {
  const [messages, setMessages] = useState<
      { id: string; kind: string; message: string; created: string }[]
    >([]),
    [order, setOrder] = useState(""),
    [text, setText] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const d = await callApi("support-thread?id=" + encodeURIComponent(id));
    setMessages(d.messages as typeof messages);
    setOrder(String((d.ticket as { order_id: string }).order_id || ""));
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, [id]);
  return (
    <details className="context-help">
      <summary>Histórico e acompanhamento</summary>
      {order && <p>Pedido vinculado: {order}</p>}
      {messages.map((m) => (
        <article className="source-card" key={m.id}>
          <strong>
            {m.kind === "support" ? "Equipe Nimbus" : "Estudante"} ·{" "}
            {new Date(m.created).toLocaleString("pt-BR")}
          </strong>
          <p className="pre-line">{m.message}</p>
        </article>
      ))}
      {!messages.length && (
        <p>As próximas mensagens ficarão registradas neste histórico.</p>
      )}
      {!readOnly && (
        <div className="form">
          <label>
            Acrescentar informação ou reabrir chamado
            <textarea
              value={text}
              minLength={5}
              maxLength={5000}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn secondary"
            disabled={busy || text.trim().length < 5}
            onClick={async () => {
              setBusy(true);
              try {
                await callApi("support-thread", { id, message: text });
                setText("");
                await load();
                setMessage("Mensagem enviada.");
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Enviar mensagem
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
