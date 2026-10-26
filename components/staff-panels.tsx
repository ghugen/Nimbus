"use client";
import { useEffect, useState } from "react";
import { callApi, EditorialPanel } from "./commerce-panels";
import type { Product } from "@/lib/catalog";
export function StaffRolesPanel() {
  const [users, setUsers] = useState<
      {
        id: string;
        name: string;
        email: string;
        reviewer: number;
        support: number;
        updated: string;
      }[]
    >([]),
    [message, setMessage] = useState("");
  async function load() {
    setUsers((await callApi("staff-roles")).users as typeof users);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  return (
    <section>
      <h2>Equipe e permissões</h2>
      <p className="notice">
        Revisores acessam a fila editorial e seus arquivos. Atendimento acessa
        solicitações de suporte. Essas funções não concedem acesso a finanças,
        gestão de usuários ou configurações. Administradores continuam definidos
        na configuração segura da hospedagem.
      </p>
      {message && <p role="status">{message}</p>}
      {users.map((u) => (
        <form
          className="panel form ticket"
          key={u.id}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await callApi("staff-roles", {
                user_id: u.id,
                reviewer: f.get("reviewer") === "on",
                support: f.get("support") === "on",
              });
              await load();
              setMessage("Permissões atualizadas e registradas no histórico.");
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          <h3>{u.name}</h3>
          <small>{u.email}</small>
          <label className="check-label">
            <input
              type="checkbox"
              name="reviewer"
              defaultChecked={!!u.reviewer}
            />
            <span>Revisão editorial</span>
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              name="support"
              defaultChecked={!!u.support}
            />
            <span>Atendimento</span>
          </label>
          <button className="btn secondary small">Salvar permissões</button>
          {u.updated && (
            <small>
              Revisadas em {new Date(u.updated).toLocaleString("pt-BR")}
            </small>
          )}
        </form>
      ))}
    </section>
  );
}
export function StaffWorkspace({
  roles,
}: {
  roles: { reviewer?: number; support?: number };
}) {
  const [tab, setTab] = useState(roles.reviewer ? "review" : "support"),
    [products, setProducts] = useState<Product[]>([]),
    [tickets, setTickets] = useState<
      {
        id: string;
        subject: string;
        message: string;
        response: string;
        status: string;
      }[]
    >([]),
    [message, setMessage] = useState("");
  async function load() {
    if (tab === "review")
      setProducts((await callApi("staff-review")).products as Product[]);
    else setTickets((await callApi("staff-support")).tickets as typeof tickets);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, [tab]);
  return (
    <section className="container page-section">
      <span className="eyebrow">ESPAÇO DA EQUIPE</span>
      <h1>Seu trabalho na Nimbus.</h1>
      {message && <p className="error">{message}</p>}
      <div className="tabs">
        {!!roles.reviewer && (
          <button onClick={() => setTab("review")}>Revisão editorial</button>
        )}
        {!!roles.support && (
          <button onClick={() => setTab("support")}>Atendimento</button>
        )}
      </div>
      {tab === "review" && roles.reviewer ? (
        <EditorialPanel
          products={products}
          endpoint="staff-review"
          fileEndpoint="review-file"
          onRefresh={load}
        />
      ) : tab === "support" && roles.support ? (
        tickets.map((t) => (
          <form
            className="panel form ticket"
            key={t.id}
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await callApi("staff-support", {
                  id: t.id,
                  response: new FormData(e.currentTarget).get("response"),
                });
                await load();
                setMessage("Atendimento respondido.");
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            <h3>
              {t.subject} · {t.status}
            </h3>
            <p className="pre-line">{t.message}</p>
            <label>
              Resposta
              <textarea
                name="response"
                defaultValue={t.response}
                required
                minLength={5}
                maxLength={5000}
              />
            </label>
            <button className="btn secondary">Responder</button>
          </form>
        ))
      ) : (
        <p className="notice">
          Sua conta não possui uma função de equipe atribuída.
        </p>
      )}
    </section>
  );
}
