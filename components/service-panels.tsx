"use client";
import { statusLabel } from "@/lib/status-labels";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
import { signedFetch, downloadPrivate } from "@/lib/client-auth";
import { money } from "@/lib/catalog";
type Offer = {
  id: string;
  title: string;
  kind: string;
  description: string;
  price: number;
  duration: number;
  capacity: number;
  terms: string;
  required_plan_id: string;
  status: string;
};
export function ServicesPage({ signedIn }: { signedIn: boolean }) {
  const [offers, setOffers] = useState<Offer[]>([]),
    [slots, setSlots] = useState<
      { id: string; starts: string; ends: string; remaining: number }[]
    >([]),
    [selected, setSelected] = useState<Offer | null>(null),
    [bookings, setBookings] = useState<Record<string, unknown>[]>([]),
    [quotes, setQuotes] = useState<Record<string, unknown>[]>([]),
    [message, setMessage] = useState("");
  async function load() {
    if (!signedIn) return;
    const [a, b] = await Promise.all([
      callApi("service-bookings"),
      callApi("service-quotes"),
    ]);
    setBookings(a.bookings as typeof bookings);
    setQuotes(b.quotes as typeof quotes);
  }
  useEffect(() => {
    callApi("services")
      .then((d) => setOffers(d.offers as Offer[]))
      .catch((e) => setMessage(e.message));
    load().catch((e) => setMessage(e.message));
  }, [signedIn]);
  async function select(o: Offer) {
    setSelected(o);
    setSlots([]);
    if (o.kind !== "editorial")
      try {
        setSlots(
          (await callApi("service-slots?id=" + encodeURIComponent(o.id)))
            .slots as typeof slots,
        );
      } catch (e) {
        setMessage((e as Error).message);
      }
  }
  return (
    <section className="container page-section">
      <span className="eyebrow">APRENDA E CRIE COM ACOMPANHAMENTO</span>
      <h1>Encontros e serviços.</h1>
      <p className="lead">
        Mentorias, oficinas, aulas ao vivo e apoio editorial, conforme as
        ofertas publicadas pela Nimbus.
      </p>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="author-public-grid">
        {offers.map((o) => (
          <article className="panel author-product" key={o.id}>
            <span className="eyebrow">{statusLabel(o.kind)}</span>
            <h2>{o.title}</h2>
            <p>{o.description}</p>
            <strong>
              {o.required_plan_id
                ? "Incluído no plano indicado"
                : o.kind === "editorial"
                  ? "Solicite orçamento"
                  : o.price
                    ? money(o.price)
                    : "Gratuito"}
            </strong>
            <small>
              {o.duration} minutos · até {o.capacity} participantes
            </small>
            <button className="btn secondary" onClick={() => select(o)}>
              {o.kind === "editorial"
                ? "Solicitar orçamento"
                : "Ver horários e condições"}
            </button>
          </article>
        ))}
      </div>
      {!offers.length && (
        <p className="notice">
          As ofertas estão em preparação. Nenhum encontro ou serviço está sendo
          anunciado neste momento.
        </p>
      )}
      {selected && (
        <article className="panel service-selection">
          <h2>{selected.title}</h2>
          <p className="pre-line">{selected.terms}</p>
          {!signedIn ? (
            <a className="btn primary" href="/entrar?destino=servicos">
              Entrar para continuar
            </a>
          ) : selected.kind === "editorial" ? (
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = e.currentTarget;
                try {
                  await callApi("service-quotes", {
                    offer_id: selected.id,
                    brief: new FormData(f).get("brief"),
                  });
                  setMessage("Pedido de orçamento enviado. Acompanhe abaixo.");
                  f.reset();
                  await load();
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              <label>
                O que você precisa?
                <textarea
                  name="brief"
                  required
                  minLength={20}
                  maxLength={10000}
                  placeholder="Objetivo, formato, extensão, prazo desejado e entregáveis."
                />
              </label>
              <button className="btn primary">Solicitar orçamento</button>
            </form>
          ) : (
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  const d = await callApi("service-bookings", {
                    slot_id: f.get("slot"),
                    accepted: f.get("accepted") === "on",
                  });
                  if (!d.free) {
                    const checkout = await callApi("service-checkout", {
                      id: d.id,
                      kind: "booking",
                    });
                    location.assign(String(checkout.url));
                    return;
                  }
                  setMessage(
                    "Agendamento gratuito confirmado. Confira seus encontros abaixo.",
                  );
                  await load();
                } catch (e) {
                  setMessage((e as Error).message);
                  await load();
                }
              }}
            >
              <label>
                Horário
                <select name="slot" required defaultValue="">
                  <option value="" disabled>
                    Escolha um horário disponível
                  </option>
                  {slots
                    .filter((s) => s.remaining > 0)
                    .map((s) => (
                      <option value={s.id} key={s.id}>
                        {new Date(s.starts).toLocaleString("pt-BR")} ·{" "}
                        {s.remaining} vaga(s)
                      </option>
                    ))}
                </select>
              </label>
              {!slots.length && <p>Sem horários disponíveis.</p>}
              <label className="check-label">
                <input name="accepted" type="checkbox" required />
                <span>
                  Li e aceito as condições, o horário e o valor informado.
                </span>
              </label>
              <button
                className="btn primary"
                disabled={!slots.some((s) => s.remaining > 0)}
              >
                {selected.price
                  ? "Reservar e pagar no checkout seguro"
                  : "Confirmar agendamento gratuito"}
              </button>
            </form>
          )}
        </article>
      )}
      {signedIn && (
        <>
          <h2>Seus encontros</h2>
          {bookings.map((b) => (
            <article className="panel ticket" key={String(b.id)}>
              <h3>{String(b.title)}</h3>
              <p>
                {new Date(String(b.starts)).toLocaleString("pt-BR")} ·{" "}
                {statusLabel(b.status)}
              </p>
              {b.meeting_url ? (
                <a
                  className="btn primary"
                  href={String(b.meeting_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir encontro
                </a>
              ) : null}
              {["requested", "pending"].includes(String(b.status)) &&
                Number(b.price) > 0 && (
                  <button
                    className="btn secondary small"
                    onClick={async () => {
                      try {
                        const d = await callApi("service-checkout", {
                          id: b.id,
                          kind: "booking",
                        });
                        location.assign(String(d.url));
                      } catch (e) {
                        setMessage((e as Error).message);
                      }
                    }}
                  >
                    Retomar pagamento
                  </button>
                )}
              {Number(b.price) === 0 && b.status === "confirmed" && (
                <button
                  className="text-link"
                  onClick={async () => {
                    try {
                      await callApi("service-bookings", {
                        id: b.id,
                        action: "cancel",
                      });
                      await load();
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  Cancelar minha participação
                </button>
              )}
            </article>
          ))}
          <h2>Seus orçamentos e entregas</h2>
          {quotes.map((q) => (
            <article className="panel ticket" key={String(q.id)}>
              <h3>
                {String(q.title)} · {statusLabel(q.status)}
              </h3>
              <p className="pre-line">{String(q.brief)}</p>
              <p className="pre-line">{String(q.response)}</p>
              {q.price !== null && <strong>{money(Number(q.price))}</strong>}
              {q.status === "quoted" && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await callApi("service-quotes", {
                        id: q.id,
                        action: "accept",
                        accepted:
                          new FormData(e.currentTarget).get("accepted") ===
                          "on",
                      });
                      await load();
                      setMessage(
                        "Escopo e orçamento aceitos. Continue para pagamento, se houver valor.",
                      );
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  <label className="check-label">
                    <input type="checkbox" name="accepted" required />
                    <span>
                      Concordo com o escopo descrito e o valor deste orçamento.
                    </span>
                  </label>
                  <button className="btn secondary">Aceitar orçamento</button>
                </form>
              )}
              {q.status === "accepted" && q.payment_status !== "paid" && (
                <button
                  className="btn primary"
                  onClick={async () => {
                    try {
                      const d = await callApi("service-checkout", {
                        id: q.id,
                        kind: "quote",
                      });
                      location.assign(String(d.url));
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  Pagar orçamento aceito
                </button>
              )}
              {q.delivery && q.payment_status === "paid" ? (
                <button
                  className="btn primary"
                  onClick={() =>
                    downloadPrivate(
                      "/api/service-download?id=" +
                        encodeURIComponent(String(q.id)),
                    ).catch((e) => setMessage(e.message))
                  }
                >
                  Baixar entrega
                </button>
              ) : null}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
export function ServicesAdmin() {
  const [offers, setOffers] = useState<Offer[]>([]),
    [quotes, setQuotes] = useState<Record<string, unknown>[]>([]),
    [message, setMessage] = useState("");
  async function load() {
    const [a, b] = await Promise.all([
      callApi("service-admin"),
      callApi("service-quotes"),
    ]);
    setOffers(a.offers as Offer[]);
    setQuotes(b.quotes as typeof quotes);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  return (
    <section>
      <h2>Mentorias, encontros e serviços</h2>
      <p className="notice">
        Nesta etapa, os serviços são ofertas do próprio operador Nimbus. O link
        do encontro é informado pela administração e fica visível somente para
        participantes confirmados. Ofertas pagas exigem o provedor de pagamentos
        configurado.
      </p>
      {message && <p role="status">{message}</p>}
      <form
        className="panel form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            await callApi("service-admin", {
              ...Object.fromEntries(f),
              price: Math.round(Number(f.get("price")) * 100),
              duration: Number(f.get("duration")),
              capacity: Number(f.get("capacity")),
            });
            await load();
            setMessage("Oferta salva.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        <label>
          Identificador para editar (vazio cria outra oferta)
          <input name="id" maxLength={100} />
        </label>
        <label>
          Título
          <input name="title" required minLength={5} maxLength={150} />
        </label>
        <label>
          Tipo
          <select name="kind">
            <option value="mentoria_individual">Mentoria individual</option>
            <option value="mentoria_grupo">Mentoria em grupo</option>
            <option value="oficina">Oficina</option>
            <option value="aula_ao_vivo">Aula ao vivo</option>
            <option value="editorial">Serviço editorial</option>
            <option value="clube">Encontro de clube</option>
          </select>
        </label>
        <label>
          Descrição
          <textarea
            name="description"
            required
            minLength={20}
            maxLength={10000}
          />
        </label>
        <label>
          Condições, escopo, cancelamento e participação
          <textarea name="terms" required minLength={30} maxLength={10000} />
        </label>
        <div className="form-row">
          <label>
            Preço (R$)
            <input
              type="number"
              name="price"
              min="0"
              step="0.01"
              defaultValue="0"
              required
            />
          </label>
          <label>
            Duração (minutos)
            <input
              type="number"
              name="duration"
              min="15"
              max="720"
              defaultValue="60"
              required
            />
          </label>
          <label>
            Vagas por horário
            <input
              type="number"
              name="capacity"
              min="1"
              max="500"
              defaultValue="1"
              required
            />
          </label>
        </div>
        <label>
          Plano obrigatório (opcional, identificador do plano)
          <input name="required_plan_id" maxLength={100} />
        </label>
        <label>
          Estado
          <select name="status">
            <option value="draft">Rascunho</option>
            <option value="published">Publicar</option>
            <option value="archived">Arquivar</option>
          </select>
        </label>
        <button className="btn secondary">Salvar oferta</button>
      </form>
      <form
        className="panel form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            await callApi("service-admin", {
              ...Object.fromEntries(f),
              action: "slot",
              starts: new Date(String(f.get("starts"))).toISOString(),
              ends: new Date(String(f.get("ends"))).toISOString(),
            });
            setMessage("Horário cadastrado.");
            await load();
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        <h3>Adicionar horário</h3>
        <label>
          Oferta
          <select name="offer_id" required>
            {offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Início
          <input type="datetime-local" name="starts" required />
        </label>
        <label>
          Fim
          <input type="datetime-local" name="ends" required />
        </label>
        <label>
          Link HTTPS do encontro
          <input type="url" name="meeting_url" maxLength={1000} />
        </label>
        <button className="btn secondary">Cadastrar horário</button>
      </form>
      {offers.map((o) => (
        <p className="notice" key={o.id}>
          {o.title} · {statusLabel(o.status)} · código {o.id}
        </p>
      ))}
      <h3>Pedidos de orçamento</h3>
      {quotes.map((q) => (
        <article className="panel ticket" key={String(q.id)}>
          <h4>
            {String(q.title)} · {statusLabel(q.status)} ·{" "}
            {statusLabel(q.payment_status)}
          </h4>
          <p className="pre-line">{String(q.brief)}</p>
          {["requested", "quoted"].includes(String(q.status)) && (
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  await callApi("service-quotes", {
                    id: q.id,
                    action: "respond",
                    price: Math.round(Number(f.get("price")) * 100),
                    response: f.get("response"),
                  });
                  await load();
                  setMessage("Orçamento enviado para aceite do solicitante.");
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              <label>
                Escopo, entregáveis e prazo
                <textarea
                  name="response"
                  required
                  minLength={20}
                  maxLength={10000}
                  defaultValue={String(q.response || "")}
                />
              </label>
              <label>
                Valor (R$)
                <input
                  type="number"
                  name="price"
                  required
                  min="0"
                  step="0.01"
                  defaultValue={(Number(q.price || 0) / 100).toFixed(2)}
                />
              </label>
              <button className="btn secondary small">Enviar orçamento</button>
            </form>
          )}
          {q.payment_status === "paid" && (
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.set("id", String(q.id));
                try {
                  const r = await signedFetch("/api/service-delivery", {
                    method: "POST",
                    body: fd,
                  });
                  const d = (await r.json()) as { error?: string };
                  if (!r.ok) throw Error(d.error || "Falha no envio.");
                  setMessage("Entrega salva para o contratante.");
                  await load();
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              <label>
                Entrega final (PDF, TXT ou ZIP, até 20 MB)
                <input
                  type="file"
                  name="file"
                  required
                  accept=".pdf,.txt,.zip"
                />
              </label>
              <button className="btn primary small">
                Disponibilizar entrega privada
              </button>
            </form>
          )}
        </article>
      ))}
    </section>
  );
}
