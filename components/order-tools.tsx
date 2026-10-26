"use client";
import { statusLabel } from "@/lib/status-labels";
import { useState } from "react";
import { callApi } from "./commerce-panels";
import { downloadPrivate } from "@/lib/client-auth";
import { money } from "@/lib/catalog";
export function OrderTools({
  order,
}: {
  order: { id: string; status: string; total: number };
}) {
  const [detail, setDetail] = useState<{
      items: { title: string; price: number }[];
      discount: { code: string; discount: number } | null;
      refund: { status: string; response: string; reason: string } | null;
      tickets: {
        id: string;
        subject: string;
        status: string;
        response: string;
      }[];
    } | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    try {
      setDetail(
        (await callApi(
          "order-detail?id=" + encodeURIComponent(order.id),
        )) as typeof detail,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <details
      className="order-tools"
      onToggle={(e) => {
        if (e.currentTarget.open) load();
      }}
    >
      <summary>Detalhes, comprovante e atendimento</summary>
      {error && <p className="error">{error}</p>}
      {message && <p className="notice">{message}</p>}
      {["paid", "refunded"].includes(order.status) && (
        <button
          className="btn secondary small"
          onClick={() =>
            downloadPrivate(
              "/api/receipt?id=" + encodeURIComponent(order.id),
            ).catch((e) => setError(e.message))
          }
        >
          Baixar comprovante
        </button>
      )}
      {["pending","failed"].includes(order.status) && (
        <button
          className="btn secondary small"
          onClick={async () => {
            try {
              const d = await callApi("order-retry", { id: order.id });
              location.assign(String(d.url));
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Retomar pagamento
        </button>
      )}
      {detail && (
        <>
          <h4>Valores efetivamente pagos</h4>
          {detail.items.map((i, index) => (
            <p key={index}>
              {i.title} · {money(i.price)}
            </p>
          ))}
          {detail.discount && (
            <p className="notice">
              Cupom {detail.discount.code}: {money(detail.discount.discount)} de
              desconto, já considerado nos itens.
            </p>
          )}
          {detail.refund ? (
            <div className="panel">
              <h4>
                Solicitação de reembolso · {statusLabel(detail.refund.status)}
              </h4>
              <p>{detail.refund.reason}</p>
              <p>{detail.refund.response}</p>
              <small>
                A devolução só é confirmada quando o provedor informa sucesso.
              </small>
            </div>
          ) : order.status === "paid" && order.total > 0 ? (
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  await callApi("refund-requests", {
                    order_id: order.id,
                    reason: f.get("reason"),
                  });
                  setMessage("Solicitação enviada para análise.");
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <label>
                Solicitar análise de reembolso
                <textarea
                  name="reason"
                  required
                  minLength={10}
                  maxLength={3000}
                  placeholder="Descreva o motivo da solicitação."
                />
              </label>
              <button className="btn secondary small">
                Enviar solicitação
              </button>
            </form>
          ) : null}
          <h4>Atendimentos vinculados ao pedido</h4>
          {detail.tickets.map((t) => (
            <div className="notice" key={t.id}>
              <strong>
                {t.subject} · {statusLabel(t.status)}
              </strong>
              <p>{t.response || "Aguardando resposta."}</p>
            </div>
          ))}
          <a className="text-link" href="/#suporte">
            Abrir atendimento e informar a referência {order.id.slice(0, 8)}…
          </a>
        </>
      )}
    </details>
  );
}
