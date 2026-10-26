"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
export function LicensePanel() {
  const [pools, setPools] = useState<
      { order_id: string; seats: number; gift: number }[]
    >([]),
    [invites, setInvites] = useState<
      { id: string; order_id: string; email: string; claimed: number }[]
    >([]),
    [message, setMessage] = useState("");
  async function load() {
    const d = await callApi("licenses");
    setPools(d.pools as typeof pools);
    setInvites(d.invites as typeof invites);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  return (
    <section className="container page-section">
      <h1>Licenças e presentes.</h1>
      <p>
        Distribua as licenças de uma compra em grupo. A pessoa recebe acesso
        quando entra com o e-mail informado e verificado; não há mesclagem de
        contas entre provedores.
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {pools.map((p) => (
        <article className="panel ticket" key={p.order_id}>
          <h3>
            Pedido {p.order_id.slice(0, 8)} ·{" "}
            {p.gift ? "Presente" : p.seats + " licenças"}
          </h3>
          {invites
            .filter((x) => x.order_id === p.order_id)
            .map((i) => (
              <p key={i.id}>
                {i.email} ·{" "}
                {i.claimed
                  ? "Acesso vinculado"
                  : "Aguardando entrada do destinatário"}
              </p>
            ))}
          {!p.gift &&
            invites.filter((x) => x.order_id === p.order_id).length <
              p.seats - 1 && (
              <form
                className="form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = e.currentTarget;
                  try {
                    const d = await callApi("licenses", {
                      order_id: p.order_id,
                      email: new FormData(f).get("email"),
                    });
                    setMessage(String(d.message));
                    f.reset();
                    await load();
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                <label>
                  E-mail de quem receberá uma licença
                  <input name="email" type="email" required maxLength={200} />
                </label>
                <button className="btn secondary small">
                  Reservar licença para esta pessoa
                </button>
              </form>
            )}
        </article>
      ))}
      {!pools.length && (
        <p className="notice">
          Você ainda não tem presentes ou compras com múltiplas licenças.
        </p>
      )}
    </section>
  );
}
