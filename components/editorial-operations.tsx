"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
import { ContextHelp } from "./context-help";
type Schedule = {
  next_review: string;
  pause_sales: number;
  last_review: string;
  reviewer: string;
};
export function ProductOperations({ id }: { id: string }) {
  const [schedule, setSchedule] = useState<Schedule | null>(null),
    [policy, setPolicy] = useState({ watermark: 1, ai_enabled: 0 }),
    [check, setCheck] = useState<Record<string, unknown> | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([
      callApi("review-schedule?id=" + id),
      callApi("product-policy?id=" + id),
      callApi("file-check?id=" + id),
    ])
      .then(([s, p, c]) => {
        if (alive) {
          setSchedule(s.schedule as Schedule);
          setPolicy(p.policy as typeof policy);
          setCheck(c.check as Record<string, unknown>);
        }
      })
      .catch((e) => {
        if (alive) setMessage(e.message);
      });
    return () => {
      alive = false;
    };
  }, [id]);
  async function save(path: string, data: unknown) {
    setBusy(true);
    try {
      await callApi(path, data);
      setMessage("Configuração salva.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="product-operations">
      <summary>Revisão, arquivo e uso do conteúdo</summary>
      <ContextHelp topic="authors" />
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {check && (
        <p className="notice">
          Último arquivo: {Math.ceil(Number(check.size) / 1024)} KB ·{" "}
          {String(check.extension)} · verificação registrada em{" "}
          {new Date(String(check.created)).toLocaleDateString("pt-BR")}. A
          validação estrutural não substitui revisão de conteúdo nem análise
          antivírus.
        </p>
      )}
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          save("review-schedule", {
            product_id: id,
            next_review: f.get("next_review"),
            pause_sales: f.get("pause_sales") === "on",
          });
        }}
      >
        <label>
          Próxima revisão editorial
          <input
            type="date"
            name="next_review"
            required
            defaultValue={schedule?.next_review}
            key={schedule?.next_review || "empty"}
          />
        </label>
        <label className="check-label">
          <input
            name="pause_sales"
            type="checkbox"
            defaultChecked={schedule?.pause_sales === 1}
            key={schedule?.pause_sales || 0}
          />
          Pausar novas vendas se a revisão estiver vencida
        </label>
        {schedule?.last_review && (
          <p>
            Última revisão:{" "}
            {new Date(schedule.last_review).toLocaleDateString("pt-BR")} ·{" "}
            {schedule.reviewer}
          </p>
        )}
        <button className="btn secondary small" disabled={busy}>
          Salvar data
        </button>
      </form>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          save("product-policy", {
            product_id: id,
            watermark: f.get("watermark") === "on",
            ai_enabled: f.get("ai_enabled") === "on",
            accepted: f.get("accepted") === "on",
          });
        }}
        key={policy.watermark + ":" + policy.ai_enabled}
      >
        <label className="check-label">
          <input
            type="checkbox"
            name="watermark"
            defaultChecked={policy.watermark === 1}
          />
          Identificar cópias pagas de PDF com código individual
        </label>
        <p className="muted">
          O código não imprime nome ou e-mail. Arquivos incompatíveis permanecem
          disponíveis sem a marca; ela não impede capturas nem cópias.
        </p>
        <label className="check-label">
          <input
            type="checkbox"
            name="ai_enabled"
            defaultChecked={policy.ai_enabled === 1}
          />
          Permitir explicações por IA baseadas em trechos deste material
        </label>
        <label className="check-label">
          <input type="checkbox" name="accepted" />
          Autorizo o envio de trechos ao provedor configurado, mediante
          consentimento do estudante
        </label>
        <button className="btn secondary small" disabled={busy}>
          Salvar política
        </button>
      </form>
    </details>
  );
}
type ReviewItem = Schedule & {
  product_id: string;
  title: string;
  notes: string;
};
export function ReviewQueue() {
  const [items, setItems] = useState<ReviewItem[]>([]),
    [message, setMessage] = useState("");
  function load() {
    return callApi("review-queue").then((d) =>
      setItems(d.items as ReviewItem[]),
    );
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  return (
    <section>
      <h2>Revisões periódicas</h2>
      <p>
        Os avisos de vencimento são conferidos ao abrir esta fila. O envio por
        e-mail depende do provedor configurado.
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {!items.length && <p>Nenhum material com revisão programada.</p>}
      {items.map((i) => (
        <article className="panel" key={i.product_id}>
          <h3>{i.title}</h3>
          <p>
            Revisão prevista: {i.next_review} ·{" "}
            {i.pause_sales
              ? "Pausa de novas vendas habilitada"
              : "Sem pausa automática"}
          </p>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await callApi("review-queue", {
                  product_id: i.product_id,
                  next_review: f.get("next_review"),
                  notes: f.get("notes"),
                  checked: f.get("checked") === "on",
                });
                await load();
                setMessage("Revisão registrada.");
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            <label>
              O que foi conferido?
              <textarea name="notes" required minLength={20} maxLength={4000} />
            </label>
            <label>
              Próxima revisão
              <input type="date" name="next_review" required />
            </label>
            <label className="check-label">
              <input name="checked" type="checkbox" required />
              Conferi conteúdo, fontes e correções aplicáveis
            </label>
            <button className="btn secondary">Registrar revisão</button>
          </form>
        </article>
      ))}
    </section>
  );
}
export function PermissionReview() {
  const [data, setData] = useState<{
      roles: {
        name: string;
        email: string;
        reviewer: number;
        support: number;
      }[];
      last: { value: string; updated: string } | null;
    } | null>(null),
    [message, setMessage] = useState("");
  async function load() {
    const d = await callApi("permission-review");
    setData(d as typeof data);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  return (
    <section className="panel">
      <h2>Conferência periódica de permissões</h2>
      <p>
        Confira também os administradores definidos na configuração da
        hospedagem.
      </p>
      {data?.last && (
        <p>
          Última conferência:{" "}
          {new Date(data.last.updated).toLocaleDateString("pt-BR")}
        </p>
      )}
      {data?.roles.map((r, i) => (
        <p key={i}>
          {r.name} · {r.email} · {r.reviewer ? "Revisão " : ""}
          {r.support ? "Atendimento" : ""}
        </p>
      ))}
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            await callApi("permission-review", {
              checked: f.get("checked") === "on",
              notes: f.get("notes"),
            });
            await load();
            setMessage("Conferência registrada; nova revisão em noventa dias.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        <label>
          Observações
          <textarea name="notes" minLength={20} maxLength={3000} required />
        </label>
        <label className="check-label">
          <input type="checkbox" name="checked" required />
          Conferi as pessoas e os acessos necessários
        </label>
        <button className="btn secondary">Registrar conferência</button>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
