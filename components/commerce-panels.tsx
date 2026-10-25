"use client";
import { useEffect, useState } from "react";
import { signedFetch, downloadPrivate } from "@/lib/client-auth";
import { money, type Product } from "@/lib/catalog";
export async function callApi(path: string, body?: unknown) {
  const r = await signedFetch(
    "/api/" + path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const d = (await r.json()) as Record<string, unknown>;
  if (!r.ok) throw new Error(String(d.error || "Não foi possível concluir."));
  return d;
}
export function NotificationCenter() {
  const [items, setItems] = useState<
      {
        id: string;
        title: string;
        message: string;
        href: string;
        read: number;
        created: string;
      }[]
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    callApi("notifications")
      .then((d) => setItems(d.notifications as typeof items))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="container page-section">
      <span className="eyebrow">ACOMPANHE AS NOVIDADES</span>
      <h1>Notificações.</h1>
      {error && <p className="error">{error}</p>}
      {!items.length && <p className="notice">Sem notificações por aqui.</p>}
      {items.map((n) => (
        <article className="panel ticket" key={n.id}>
          <span className="badge">{n.read ? "Lida" : "Nova"}</span>
          <h3>{n.title}</h3>
          <small>{new Date(n.created).toLocaleString("pt-BR")}</small>
          <p>{n.message}</p>
          <a
            className="btn secondary small"
            href={n.href}
            onClick={() => {
              callApi("notifications", { id: n.id }).catch(() => {});
            }}
          >
            Abrir
          </a>
        </article>
      ))}
    </section>
  );
}
export function VersionList({ productId }: { productId: string }) {
  const [versions, setVersions] = useState<
      {
        id: string;
        sequence: number;
        file_name: string;
        notes: string;
        released: string;
      }[]
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    callApi("versions?id=" + encodeURIComponent(productId))
      .then((d) => setVersions(d.versions as typeof versions))
      .catch((e) => setError(e.message));
  }, [productId]);
  return (
    <div className="panel version-list">
      <h3>Versões e atualizações</h3>
      <p className="muted">
        O arquivo original da compra permanece disponível. Você também pode
        baixar as versões publicadas abaixo.
      </p>
      {error && <p className="error">{error}</p>}
      {versions.map((v) => (
        <div className="version-item" key={v.id}>
          <strong>
            Versão {v.sequence} ·{" "}
            {new Date(v.released).toLocaleDateString("pt-BR")}
          </strong>
          <p className="pre-line">{v.notes}</p>
          <button
            className="btn secondary small"
            onClick={() =>
              downloadPrivate("/api/version-download/" + v.id).catch((e) =>
                setError(e.message),
              )
            }
          >
            Baixar {v.file_name}
          </button>
        </div>
      ))}
      {!versions.length && !error && (
        <p className="muted">Sem versões adicionais publicadas.</p>
      )}
    </div>
  );
}
export function AnalyticsPanel() {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [items, setItems] = useState<
      {
        id: string;
        title: string;
        views: number;
        previews: number;
        carts: number;
        purchases: number;
      }[]
    >([]),
    [error, setError] = useState("");
  async function load() {
    try {
      const q = new URLSearchParams();
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      const d = await callApi("analytics?" + q);
      setItems(d.metrics as typeof items);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="panel table-wrap">
      <h3>Indicadores dos materiais</h3>
      <form
        className="metrics-dates"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label>
          De
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button className="btn secondary small">Filtrar</button>
      </form>
      <p className="muted">
        Visualizações, prévias e carrinhos consideram somente medição
        autorizada. Eventos são deduplicados por material, sessão e dia; não
        representam todo o tráfego nem visitantes únicos. Compras vêm de pedidos
        confirmados.
      </p>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Material</th>
            <th>Visualizações</th>
            <th>Prévias</th>
            <th>Carrinhos</th>
            <th>Compras</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td>{p.title}</td>
              <td>{p.views}</td>
              <td>{p.previews}</td>
              <td>{p.carts}</td>
              <td>{p.purchases}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && <p className="muted">Sem materiais neste painel.</p>}
    </div>
  );
}
export function OperationsPanel() {
  const [data, setData] = useState<{
      readiness: Record<string, unknown>;
      outbox: {
        id: string;
        subject: string;
        name: string;
        status: string;
        last_error: string;
      }[];
    } | null>(null),
    [error, setError] = useState("");
  async function load() {
    try {
      setData((await callApi("operations")) as typeof data);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="panel">
      <h2>Operação e notificações</h2>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <div className="readiness-grid">
            {[
              ["payments", "Conta de pagamentos"],
              ["webhook", "Segredo do webhook"],
              ["test_mode", "Chave Stripe em modo de teste"],
              ["email", "E-mail transacional"],
              ["email_login", "Login por e-mail"],
              ["privacy", "Responsável e privacidade"],
            ].map(([k, label]) => (
              <div key={k}>
                <strong>{label}</strong>
                <span
                  className={
                    "status " +
                    (data.readiness[k] ? "status-paid" : "status-pending")
                  }
                >
                  {data.readiness[k] ? "Configurado" : "Pendente"}
                </span>
              </div>
            ))}
          </div>
          <p className="notice">
            Configuração não significa validação de uma cobrança real. O teste
            completo com Stripe deve ser feito com chaves de teste, webhook
            acessível, compra aprovada, confirmação, download e reembolso. A
            Nimbus não cria contas nem preenche credenciais automaticamente.
          </p>
          <h3>Fila de e-mails</h3>
          <p className="muted">
            Os avisos ficam disponíveis dentro da Nimbus mesmo sem provedor de
            e-mail. Respostas aceitas pela API do provedor não comprovam leitura
            ou entrega na caixa de entrada.
          </p>
          {data.outbox.map((n) => (
            <div className="order-line" key={n.id}>
              <div>
                <strong>{n.subject}</strong>
                <small>
                  {n.name} · {n.status}
                </small>
                {n.last_error && <p>{n.last_error}</p>}
              </div>
              {n.status !== "sent" && (
                <button
                  className="btn secondary small"
                  onClick={async () => {
                    try {
                      const r = await callApi("operations", {
                        action: "retry_email",
                        id: n.id,
                      });
                      if (r.status === "pending")
                        setError(
                          "Configure o provedor e o remetente antes do envio.",
                        );
                      else await load();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Tentar envio
                </button>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
export function EditorialPanel({
  products,
  onRefresh,
}: {
  products: Product[];
  onRefresh: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div>
      <h2>Aprovações e revisão</h2>
      <p className="muted">
        O selo de revisão depende da declaração explícita do revisor, com
        objetivos e referências cadastrados. A aprovação comercial pode ocorrer
        sem esse selo.
      </p>
      {error && <p className="error">{error}</p>}
      {products
        .filter(
          (p) =>
            !p.demo &&
            ["pending", "changes_requested", "draft"].includes(p.status),
        )
        .map((p) => (
          <form
            className="panel form ticket"
            key={p.id}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await callApi("admin", {
                  action: "product",
                  id: p.id,
                  status: f.get("status"),
                  feedback: f.get("feedback"),
                  reviewed: f.get("reviewed") === "on",
                });
                await onRefresh();
                setError("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>{p.title}</h3>
            <p>
              {p.author} · {money(p.price)} · {p.status}
            </p>
            <p className="pre-line">{p.description}</p>
            <p className="pre-line">
              <strong>Objetivos:</strong> {p.objectives || "Não informados"}
            </p>
            <p className="pre-line">
              <strong>Referências:</strong> {p.sources || "Não informadas"}
            </p>
            {p.file_key && (
              <button
                type="button"
                className="btn secondary small"
                onClick={() =>
                  downloadPrivate("/api/admin-file/" + p.id).catch((e) =>
                    setError(e.message),
                  )
                }
              >
                Baixar arquivo para revisão
              </button>
            )}
            <label>
              Decisão
              <select name="status">
                <option value="changes_requested">Solicitar ajustes</option>
                <option value="published">Aprovar publicação</option>
                <option value="rejected">Rejeitar</option>
              </select>
            </label>
            <label>
              Devolutiva ao autor
              <textarea
                name="feedback"
                minLength={10}
                maxLength={5000}
                required
              />
            </label>
            <label className="check-label">
              <input name="reviewed" type="checkbox" />
              <span>
                Revisei o conteúdo e as referências e desejo registrar meu nome
                como revisor nesta publicação.
              </span>
            </label>
            <button className="btn primary" disabled={busy}>
              Registrar decisão
            </button>
          </form>
        ))}
    </div>
  );
}
