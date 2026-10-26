"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
type Doc = {
  id: string;
  user_id: string;
  kind: string;
  order_id: string;
  reference: string;
  status: string;
  url: string;
  notes: string;
};
const labels: Record<string, string> = {
  requested: "Solicitado",
  processing: "Em processamento",
  issued: "Emitido externamente",
  canceled: "Cancelado",
  preparing: "Em preparação",
  awaiting_signature: "Aguardando assinatura",
  signed: "Assinatura externa conferida",
};
export function DocumentPanel({ admin = false }: { admin?: boolean }) {
  const [documents, setDocuments] = useState<Doc[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const d = await callApi(admin ? "documents-admin" : "documents");
    setDocuments(d.documents as Doc[]);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, [admin]);
  async function save(body: unknown) {
    setBusy(true);
    try {
      await callApi("documents-admin", body);
      await load();
      setMessage("Registro atualizado.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={admin ? "market-panel" : "container page-section"}>
      <h2>Contratos e documentos fiscais</h2>
      <p className="notice">
        Esta área acompanha solicitações e documentos emitidos ou assinados fora
        da Nimbus. Não executa emissão fiscal nem assinatura eletrônica. Links
        devem apontar para o serviço de consulta autorizado, com proteção
        adequada dos dados.
      </p>
      {message && <p role="status">{message}</p>}
      {admin && (
        <details className="panel">
          <summary>Preparar registro de contrato</summary>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              save({
                ...Object.fromEntries(new FormData(e.currentTarget)),
                action: "create-contract",
              });
            }}
          >
            <label>
              ID da conta do autor ou representante
              <input name="user_id" required maxLength={150} />
            </label>
            <label>
              Referência do contrato
              <input name="reference" minLength={5} maxLength={150} required />
            </label>
            <label>
              Observações visíveis ao titular
              <textarea name="notes" maxLength={3000} />
            </label>
            <button className="btn secondary" disabled={busy}>
              Criar registro
            </button>
          </form>
        </details>
      )}
      {!documents.length && <p>Nenhum documento registrado.</p>}
      {documents.map((d) => (
        <article className="panel" key={d.id}>
          <span className="badge">
            {d.kind === "invoice" ? "Documento fiscal" : "Contrato"}
          </span>
          <h3>{d.reference || "Pedido " + d.order_id?.slice(0, 8)}</h3>
          <p>{labels[d.status] || d.status}</p>
          <p className="pre-line">{d.notes}</p>
          {d.url && (
            <a
              className="text-link"
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Consultar documento externo ↗
            </a>
          )}
          {admin && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                save({
                  ...Object.fromEntries(f),
                  id: d.id,
                  verified: f.get("verified") === "on",
                });
              }}
            >
              <label>
                Estado
                <select name="status" defaultValue={d.status}>
                  {(d.kind === "invoice"
                    ? ["requested", "processing", "issued", "canceled"]
                    : ["preparing", "awaiting_signature", "signed", "canceled"]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {labels[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Referência externa
                <input
                  name="reference"
                  defaultValue={d.reference}
                  maxLength={150}
                />
              </label>
              <label>
                Link de consulta HTTPS
                <input
                  name="url"
                  type="url"
                  defaultValue={d.url}
                  maxLength={2000}
                />
              </label>
              <label>
                Observações visíveis ao titular
                <textarea
                  name="notes"
                  defaultValue={d.notes}
                  maxLength={3000}
                />
              </label>
              <label className="check-label">
                <input name="verified" type="checkbox" />
                Conferi o documento e a situação no serviço externo
              </label>
              <button className="btn secondary" disabled={busy}>
                Salvar acompanhamento
              </button>
            </form>
          )}
        </article>
      ))}
    </section>
  );
}
export function IntegrationReadiness() {
  const [data, setData] = useState<Record<
      string,
      Record<string, unknown>
    > | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    callApi("integration-readiness")
      .then((d) => setData(d as typeof data))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="panel">
      <h2>Conexões e prontidão</h2>
      {error && <p role="alert">{error}</p>}
      {data && (
        <ul>
          <li>
            Pagamentos:{" "}
            {data.payments.ready
              ? "configuração habilitada"
              : "aguardando configuração e teste de webhook"}{" "}
            · ambiente{" "}
            {data.payments.mode === "test" ? "de testes" : "não confirmado"}.
          </li>
          <li>
            E-mails:{" "}
            {data.email.ready
              ? "provedor e remetente configurados; conferir entregabilidade"
              : "aguardando provedor e remetente verificado"}
            .
          </li>
          <li>
            Explicações por IA:{" "}
            {data.assistant.configured
              ? "provedor configurado; exige autorização por material e consentimento"
              : "aguardando configuração; busca de trechos disponível"}
            .
          </li>
          <li>
            Assinatura eletrônica: conexão externa pendente; acompanhamento
            manual disponível.
          </li>
          <li>
            Emissão fiscal: definição contábil e conexão externa pendentes;
            solicitações disponíveis.
          </li>
        </ul>
      )}
      <p>
        Configuração presente não substitui um teste completo de funcionamento.
      </p>
    </section>
  );
}
export function InvoiceRequest({ orderId }: { orderId: string }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        className="text-link"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await callApi("documents", { kind: "invoice", order_id: orderId });
            setMessage("Solicitação registrada. Acompanhe em Documentos.");
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Solicitar documento fiscal
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
