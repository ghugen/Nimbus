"use client";
import {signedFetch} from "@/lib/client-auth";
import { useEffect, useState } from "react";
type Settings = {
  controller: string;
  contact: string;
  retention: string;
  updated?: string;
};
type PrivacyRequest = {
  id: string;
  kind: string;
  message: string;
  status: string;
  response: string;
  created: string;
  updated: string;
  name?: string;
  email?: string;
};
async function request(path: string, body?: unknown) {
  const res = await signedFetch(
    "/api/" + path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const d = (await res.json()) as {
    settings: Settings;
    requests: PrivacyRequest[];
    error?: string;
  };
  if (!res.ok) throw new Error(d.error || "Não foi possível concluir.");
  return d;
}
export function PrivacyCenter({
  admin = false,
  signedIn = false,
}: {
  admin?: boolean;
  signedIn?: boolean;
}) {
  const [settings, setSettings] = useState<Settings>({
      controller: "",
      contact: "",
      retention: "",
    }),
    [requests, setRequests] = useState<PrivacyRequest[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    if (admin) {
      const d = await request("privacy-admin");
      setSettings(d.settings);
      setRequests(d.requests);
    } else {
      const d = await request("privacy-info");
      setSettings(d.settings);
      if (signedIn) setRequests((await request("privacy")).requests);
    }
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [admin, signedIn]);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await load();
      setMessage("Registro atualizado.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="privacy-center">
      <span className="eyebrow">SEUS DADOS, COM TRANSPARÊNCIA</span>
      <h2>
        {admin ? "Administração de privacidade" : "Central de privacidade"}
      </h2>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="panel">
        <h3>Responsável e contato</h3>
        {settings.controller && settings.contact ? (
          <>
            <p>
              <strong>{settings.controller}</strong>
            </p>
            <p>
              Contato de privacidade:{" "}
              <a className="inline-link" href={"mailto:" + settings.contact}>
                {settings.contact}
              </a>
            </p>
            <p className="pre-line">{settings.retention}</p>
          </>
        ) : (
          <p className="notice">
            Identificação do responsável, contato público e regras finais de
            retenção ainda precisam ser preenchidos pela operação antes do
            lançamento comercial. Usuários autenticados já podem registrar
            solicitações abaixo.
          </p>
        )}
      </div>
      {admin ? (
        <form
          className="panel form"
          key={settings.updated || "empty"}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            act(async () => {
              await request("privacy-admin", {
                action: "settings",
                ...Object.fromEntries(f),
              });
            });
          }}
        >
          <h3>Informações públicas da operação</h3>
          <label>
            Nome ou razão social do controlador
            <input
              name="controller"
              defaultValue={settings.controller}
              required
              minLength={3}
              maxLength={200}
            />
          </label>
          <label>
            E-mail público para privacidade
            <input
              name="contact"
              type="email"
              defaultValue={settings.contact}
              required
              maxLength={200}
            />
          </label>
          <label>
            Critérios e prazos de retenção aprovados pela operação
            <textarea
              name="retention"
              defaultValue={settings.retention}
              minLength={50}
              maxLength={4000}
              required
              placeholder="Descreva o que é mantido, por quanto tempo, para qual finalidade e quais exceções legais foram validadas."
            />
          </label>
          <button className="btn primary" disabled={busy}>
            Salvar informações públicas
          </button>
        </form>
      ) : signedIn ? (
        <>
          <a className="btn primary" href="/api/privacy-export">
            Baixar meus dados (JSON)
          </a>
          <p className="muted">
            Inclui cadastro, pedidos, anotações, favoritos, publicações,
            registros comerciais e solicitações vinculados à sua conta. Não
            inclui dados de outras pessoas nem credenciais internas.
          </p>
          <form
            className="panel form"
            onSubmit={(e) => {
              e.preventDefault();
              const target = e.currentTarget;
              const f = new FormData(target);
              act(async () => {
                await request("privacy", Object.fromEntries(f));
                target.reset();
              });
            }}
          >
            <h3>Solicitar atendimento sobre meus dados</h3>
            <label>
              Tipo
              <select name="kind">
                <option value="acesso">Acesso aos dados</option>
                <option value="correção">Correção</option>
                <option value="exclusão">Exclusão</option>
                <option value="oposição">Oposição ao tratamento</option>
                <option value="informações">
                  Informações sobre uso e compartilhamento
                </option>
              </select>
            </label>
            <label>
              Descreva sua solicitação
              <textarea
                name="message"
                minLength={10}
                maxLength={4000}
                required
                placeholder="Não envie documentos, senhas ou dados bancários neste formulário."
              />
            </label>
            <p className="notice">
              Pedidos de exclusão são analisados pela operação. Registros
              sujeitos a retenção legal, exercício de direitos ou conciliação
              podem precisar ser preservados, com justificativa na resposta. O
              envio não apaga dados automaticamente.
            </p>
            <button className="btn primary" disabled={busy}>
              Registrar solicitação
            </button>
          </form>
        </>
      ) : (
        <p>
          <a
            className="btn secondary"
            href="/signin-with-chatgpt?return_to=%2F%23privacidade"
            target="_top"
          >
            Entrar para acessar meus dados e solicitações
          </a>
        </p>
      )}
      <h3>{admin ? "Solicitações dos titulares" : "Minhas solicitações"}</h3>
      {requests.map((r) =>
        admin ? (
          <form
            className="panel form"
            key={r.id + ":" + r.updated}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              act(async () => {
                await request("privacy-admin", {
                  action: "respond",
                  id: r.id,
                  ...Object.fromEntries(f),
                });
              });
            }}
          >
            <h3>
              {r.kind} · {r.name}
            </h3>
            <small>
              {r.email} · {new Date(r.created).toLocaleString("pt-BR")} ·
              protocolo {r.id}
            </small>
            <p className="pre-line">{r.message}</p>
            <label>
              Status
              <select
                name="status"
                defaultValue={r.status === "open" ? "in_progress" : r.status}
              >
                <option value="in_progress">Em atendimento</option>
                <option value="responded">Respondido</option>
              </select>
            </label>
            <label>
              Resposta e justificativa
              <textarea
                name="response"
                defaultValue={r.response}
                minLength={10}
                maxLength={5000}
                required
              />
            </label>
            <p className="muted">
              Marcar como respondido registra o atendimento. Não executa
              exclusão, anonimização ou comunicação externa.
            </p>
            <button className="btn secondary" disabled={busy}>
              Registrar atendimento
            </button>
          </form>
        ) : (
          <article className="panel" key={r.id}>
            <h3>
              {r.kind} ·{" "}
              {r.status === "open"
                ? "Recebido"
                : r.status === "in_progress"
                  ? "Em atendimento"
                  : "Respondido"}
            </h3>
            <small>
              Protocolo: {r.id} ·{" "}
              {new Date(r.created).toLocaleDateString("pt-BR")}
            </small>
            <p className="pre-line">{r.message}</p>
            {r.response && <p className="notice pre-line">{r.response}</p>}
          </article>
        ),
      )}
      {!requests.length && (
        <p className="muted">
          Sem solicitações registradas nesta visualização.
        </p>
      )}
    </section>
  );
}
