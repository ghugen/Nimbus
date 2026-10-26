"use client";
import { statusLabel } from "@/lib/status-labels";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
import { money } from "@/lib/catalog";
export function RefundAdmin() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]),
    [message, setMessage] = useState("");
  async function load() {
    setItems((await callApi("refund-requests")).requests as typeof items);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  return (
    <section>
      <h2>Solicitações de reembolso</h2>
      <p className="notice">
        Analise a solicitação antes de aprovar. A ação de aprovação inicia a
        devolução integral pelo provedor, quando configurado. Não execute um
        segundo estorno fora da plataforma sem conferir o estado atual.
      </p>
      {message && <p role="status">{message}</p>}
      {items.map((r) => (
        <form
          className="panel form ticket"
          key={String(r.id)}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              action = f.get("action");
            try {
              const d = await callApi("refund-requests", {
                id: r.id,
                action: action === "approve" ? "approve" : "respond",
                status: action,
                response: f.get("response"),
              });
              setMessage(
                action === "approve"
                  ? "Retorno do provedor: " + statusLabel(d.status)
                  : "Resposta registrada.",
              );
              await load();
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          <h3>
            Pedido {String(r.order_id).slice(0, 10)} · {money(Number(r.amount))}
          </h3>
          <p>Estado: {statusLabel(r.status)}</p>
          <p className="pre-line">{String(r.reason)}</p>
          <label>
            Resposta
            <textarea
              name="response"
              defaultValue={String(r.response)}
              minLength={5}
              required
              maxLength={3000}
            />
          </label>
          <label>
            Ação
            <select name="action">
              <option value="reviewing">Colocar em análise</option>
              <option value="rejected">Recusar com justificativa</option>
              <option value="approve">
                Aprovar e solicitar devolução integral
              </option>
            </select>
          </label>
          <button className="btn secondary">Registrar ação</button>
        </form>
      ))}
      {!items.length && <p>Nenhuma solicitação.</p>}
    </section>
  );
}
export function OperationsTasks() {
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]),
    [message, setMessage] = useState("");
  async function load() {
    setTasks((await callApi("operation-tasks")).tasks as typeof tasks);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  return (
    <section>
      <h2>Tarefas da operação</h2>
      {message && <p role="status">{message}</p>}
      {[{}, ...tasks].map((t, index) => (
        <form
          className="panel form ticket"
          key={String(t.id || "new")}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = e.currentTarget;
            try {
              await callApi("operation-tasks", {
                ...Object.fromEntries(new FormData(f)),
                id: t.id,
              });
              if (!index) f.reset();
              await load();
              setMessage("Tarefa salva.");
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          <h3>{index ? String(t.title) : "Nova tarefa"}</h3>
          <label>
            Título
            <input
              name="title"
              defaultValue={String(t.title || "")}
              required
              minLength={3}
              maxLength={150}
            />
          </label>
          <div className="form-row">
            <label>
              Responsável
              <input
                name="owner"
                defaultValue={String(t.owner || "")}
                maxLength={100}
              />
            </label>
            <label>
              Prazo
              <input
                type="date"
                name="deadline"
                defaultValue={String(t.deadline || "")}
              />
            </label>
          </div>
          <label>
            Estado
            <select name="status" defaultValue={String(t.status || "open")}>
              <option value="open">A fazer</option>
              <option value="in_progress">Em andamento</option>
              <option value="done">Concluída</option>
            </select>
          </label>
          <label>
            Observações
            <textarea
              name="notes"
              defaultValue={String(t.notes || "")}
              maxLength={5000}
            />
          </label>
          <button className="btn secondary small">Salvar tarefa</button>
        </form>
      ))}
    </section>
  );
}
export function ModerationPanel({
  kind,
  author = false,
}: {
  kind: "questions" | "reports" | "events";
  author?: boolean;
}) {
  const endpoint =
    kind === "questions"
      ? "product-questions"
      : kind === "reports"
        ? "quality-reports"
        : "operation-events";
  const [items, setItems] = useState<Record<string, unknown>[]>([]),
    [message, setMessage] = useState("");
  async function load() {
    const d = await callApi(endpoint + (author ? "?scope=author" : ""));
    setItems((d.questions || d.reports || d.events) as typeof items);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, [kind]);
  return (
    <section>
      <h2>
        {kind === "questions"
          ? "Perguntas antes da compra"
          : kind === "reports"
            ? "Relatos sobre autoria e qualidade"
            : "Alertas da operação"}
      </h2>
      {message && <p role="status">{message}</p>}
      {items.map((r) => (
        <article className="panel ticket" key={String(r.id)}>
          <h3>{String(r.title || r.kind || r.product_id || "Registro")}</h3>
          <p className="pre-line">
            {String(r.question || r.reason || r.message)}
          </p>
          <p>Estado: {statusLabel(r.status)}</p>
          {kind === "events" ? (
            <button
              className="btn secondary small"
              onClick={async () => {
                try {
                  await callApi(endpoint, { id: r.id });
                  await load();
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              Marcar como verificado
            </button>
          ) : (
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await callApi(endpoint, {
                    ...Object.fromEntries(new FormData(e.currentTarget)),
                    id: r.id,
                    action: "respond",
                  });
                  await load();
                  setMessage("Resposta salva.");
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              <label>
                Resposta
                <textarea
                  name={kind === "questions" ? "answer" : "response"}
                  defaultValue={String(r.answer || r.response || "")}
                  minLength={5}
                  required
                  maxLength={3000}
                />
              </label>
              <label>
                Decisão
                <select name="status">
                  {kind === "questions" ? (
                    <>
                      <option value="published">
                        Publicar pergunta e resposta
                      </option>
                      <option value="pending">Manter em análise</option>
                      <option value="hidden">Ocultar</option>
                    </>
                  ) : (
                    <>
                      <option value="reviewing">Em análise</option>
                      <option value="resolved">Resolvido</option>
                      <option value="dismissed">
                        Arquivado com justificativa
                      </option>
                    </>
                  )}
                </select>
              </label>
              <button className="btn secondary small">Salvar resposta</button>
            </form>
          )}
        </article>
      ))}
    </section>
  );
}
