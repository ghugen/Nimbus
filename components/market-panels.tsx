"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
import { money, type Product } from "@/lib/catalog";
import { statusLabel } from "@/lib/status-labels";
import { ContextHelp } from "./context-help";
type RecordRow = Record<string, unknown>;
function usePanel<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function reload() {
    const d = await callApi(path);
    setData(d as T);
  }
  useEffect(() => {
    let alive = true;
    setData(null);
    callApi(path)
      .then((d) => {
        if (alive) setData(d as T);
      })
      .catch((e) => {
        if (alive) setMessage(e.message);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  async function act(endpoint: string, body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      await callApi(endpoint, body);
      await reload();
      setMessage("Alteração salva.");
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { data, message, setMessage, busy, reload, act };
}
function Notice({ text }: { text: string }) {
  return text ? (
    <p className="notice" role="status">
      {text}
    </p>
  ) : null;
}
const values = (f: HTMLFormElement) => Object.fromEntries(new FormData(f));
type Idea = {
  id: string;
  title: string;
  course: string;
  subject: string;
  description: string;
  status: string;
  response: string;
  product_id: string | null;
  votes: number;
};
export function DemandBoard({
  signedIn,
  admin = false,
}: {
  signedIn: boolean;
  admin?: boolean;
}) {
  const p = usePanel<{ ideas: Idea[] }>(
      admin ? "demand-admin" : "demand-board",
    ),
    [mine, setMine] = useState<string[]>([]),
    [myIdeas, setMyIdeas] = useState<Idea[]>([]),
    [query, setQuery] = useState("");
  async function loadMine() {
    if (signedIn && !admin) {
      const d = await callApi("demand-mine");
      setMine((d.votes as { idea_id: string }[]).map((x) => x.idea_id));
      setMyIdeas(d.ideas as Idea[]);
    }
  }
  useEffect(() => {
    loadMine().catch((e) => p.setMessage(e.message));
  }, [signedIn, admin]);
  return (
    <section className={admin ? "market-panel" : "container page-section"}>
      <span className="eyebrow">SEU PRÓXIMO MATERIAL COMEÇA AQUI</span>
      <h1>Mural de pedidos.</h1>
      <p className="lead">
        Conte o que faz falta nos seus estudos e apoie ideias de colegas. As
        votações orientam a produção; não são encomendas nem promessa de
        lançamento.
      </p>
      <Notice text={p.message} />
      <label className="form">
        Buscar no mural
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Disciplina, curso ou assunto"
        />
      </label>
      <div className="market-grid">
        {p.data?.ideas
          .filter((i) =>
            [i.title, i.course, i.subject]
              .join(" ")
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((i) => (
            <article className="panel demand-card" key={i.id}>
              <div className="idea-heading">
                <span className="badge">
                  {(
                    {
                      open: "Aberto para apoio",
                      planned: "Planejado",
                      producing: "Em produção",
                      available: "Material disponível",
                      pending: "Aguardando moderação",
                      hidden: "Oculto",
                    } as Record<string, string>
                  )[i.status] || i.status}
                </span>
                <strong>{i.votes} apoio(s)</strong>
              </div>
              <h2>{i.title}</h2>
              <p className="muted">
                {i.course} · {i.subject}
              </p>
              <p className="pre-line">{i.description}</p>
              {i.response && <p className="notice pre-line">{i.response}</p>}
              {i.product_id && (
                <a className="text-link" href={"/materiais/" + i.product_id}>
                  Conhecer o material ↗
                </a>
              )}
              {!admin && (
                <button
                  className={
                    "btn " + (mine.includes(i.id) ? "primary" : "secondary")
                  }
                  disabled={!signedIn || p.busy}
                  aria-pressed={mine.includes(i.id)}
                  onClick={async () => {
                    if (
                      await p.act("demand-board", {
                        action: "vote",
                        id: i.id,
                        active: !mine.includes(i.id),
                      })
                    )
                      await loadMine();
                  }}
                >
                  {mine.includes(i.id)
                    ? "Retirar meu apoio"
                    : "Quero estudar isso"}
                </button>
              )}
              {admin && (
                <form
                  className="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    p.act("demand-admin", {
                      ...values(e.currentTarget),
                      id: i.id,
                    });
                  }}
                >
                  <label>
                    Andamento
                    <select name="status" defaultValue={i.status}>
                      <option value="pending" disabled>
                        Aguardando moderação
                      </option>
                      {[
                        "open",
                        "planned",
                        "producing",
                        "available",
                        "hidden",
                      ].map((x) => (
                        <option key={x} value={x}>
                          {
                            (
                              {
                                open: "Aberto",
                                planned: "Planejado",
                                producing: "Em produção",
                                available: "Disponível",
                                hidden: "Oculto",
                              } as Record<string, string>
                            )[x]
                          }
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Resposta pública
                    <textarea
                      name="response"
                      defaultValue={i.response}
                      maxLength={3000}
                    />
                  </label>
                  <label>
                    Código do material publicado
                    <input
                      name="product_id"
                      defaultValue={i.product_id || ""}
                    />
                  </label>
                  <button className="btn secondary" disabled={p.busy}>
                    Salvar moderação
                  </button>
                </form>
              )}
            </article>
          ))}
      </div>
      {p.data?.ideas.length === 0 && (
        <p className="notice">
          O mural está começando. As primeiras sugestões aparecerão depois da
          moderação.
        </p>
      )}
      {!signedIn ? (
        <a className="btn primary" href="/entrar?destino=mural">
          Entre para sugerir e votar
        </a>
      ) : (
        !admin && (
          <details className="panel">
            <summary>Propor um material</summary>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = e.currentTarget;
                if (await p.act("demand-board", values(f))) {
                  f.reset();
                  await loadMine();
                  p.setMessage("Sugestão enviada para moderação.");
                }
              }}
            >
              <label>
                Título da ideia
                <input name="title" required minLength={8} maxLength={150} />
              </label>
              <div className="form-row">
                <label>
                  Curso
                  <input name="course" required maxLength={100} />
                </label>
                <label>
                  Disciplina
                  <input name="subject" required maxLength={100} />
                </label>
              </div>
              <label>
                Que dificuldade o material ajudaria a resolver?
                <textarea
                  name="description"
                  required
                  minLength={20}
                  maxLength={3000}
                />
              </label>
              <button className="btn primary" disabled={p.busy}>
                Enviar sugestão
              </button>
            </form>
          </details>
        )
      )}
      {myIdeas.some((i) => i.status === "pending") && (
        <p className="notice">
          Você tem {myIdeas.filter((i) => i.status === "pending").length}{" "}
          sugestão(ões) aguardando moderação.
        </p>
      )}
    </section>
  );
}
type Settings = {
  enabled: boolean;
  discount_percent: number;
  student_reward: number;
  min_total: number;
  affiliate_rate: number;
};
type PartnerAccount = {
  user_id?: string;
  code: string;
  kind: string;
  status: string;
  rate_bps: number;
  name?: string;
  email?: string;
};
type Ledger = {
  sales: {
    order_id: string;
    user_id: string;
    kind: string;
    created: string;
    amount: number;
    available: boolean;
    order_status: string;
    discount: number;
    reward: { code: string; status: string } | null;
  }[];
  payouts: {
    id: string;
    user_id: string;
    amount: number;
    reference: string;
    created: string;
  }[];
  balances: {
    user_id: string;
    earned: number;
    available: number;
    paid: number;
  }[];
};
export function PartnerPage() {
  const p = usePanel<{
    account: PartnerAccount | null;
    settings: Settings;
    ledger: Ledger;
  }>("partners");
  return (
    <section className="container page-section">
      <span className="eyebrow">BOAS DESCOBERTAS CIRCULAM</span>
      <h1>Indicações e afiliados.</h1>
      <p className="lead">
        Compartilhe a Nimbus com sua comunidade. Estudantes recebem cupons
        pessoais; afiliados aprovados acompanham comissões.
      </p>
      <Notice text={p.message} />
      <ContextHelp topic="partners" />
      {p.data && (
        <>
          {!p.data.settings.enabled && (
            <p className="notice">
              O programa está em preparação. As inscrições ficam registradas; os
              benefícios dependem da ativação pela operação.
            </p>
          )}
          <div className="market-grid">
            <article className="panel">
              <h2>Indique e ganhe</h2>
              <p>
                Primeira compra paga do colega:{" "}
                {p.data.settings.discount_percent}% de desconto no acervo
                próprio. Valor mínimo após desconto:{" "}
                {money(p.data.settings.min_total)}.
              </p>
              <p>
                Depois da conciliação e do período operacional, você recebe um
                cupom pessoal de {money(p.data.settings.student_reward)}, válido
                por noventa dias e uma compra no acervo próprio. O cupom não
                pode ser sacado.
              </p>
            </article>
            <article className="panel">
              <h2>Parceiro afiliado</h2>
              <p>
                Inscrição sujeita à aprovação. Comissão registrada no aceite:{" "}
                {p.data.settings.affiliate_rate / 100}% sobre o líquido elegível
                da primeira compra indicada no acervo próprio, após taxas e
                estornos.
              </p>
              <p>
                Repasses são realizados pela operação fora da plataforma e
                registrados no histórico. Não há transferência automática.
              </p>
            </article>
          </div>
          {p.data.account ? (
            <article className="panel">
              <h2>
                Sua inscrição ·{" "}
                {p.data.account.kind === "student" ? "Estudante" : "Afiliado"}
              </h2>
              <p>Estado: {statusLabel(p.data.account.status)}</p>
              <label>
                Seu código
                <input readOnly value={p.data.account.code} />
              </label>
              <button
                className="btn secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      location.origin +
                        "/?indicacao=" +
                        p.data!.account!.code +
                        "#catalogo",
                    );
                    p.setMessage("Link de indicação copiado.");
                  } catch {
                    p.setMessage("Use seu código de indicação no carrinho.");
                  }
                }}
              >
                Copiar link de indicação
              </button>
              {p.data.account.kind === "affiliate" && (
                <p>
                  Comissão aceita: {p.data.account.rate_bps / 100}% sobre o
                  líquido elegível.
                </p>
              )}
            </article>
          ) : (
            <form
              className="panel form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = values(e.currentTarget);
                p.act("partners", {
                  kind: f.kind,
                  accepted: f.accepted === "on",
                });
              }}
            >
              <h2>Participar</h2>
              <label>
                Modalidade
                <select name="kind">
                  <option value="student">Estudante · cupom de desconto</option>
                  <option value="affiliate">
                    Afiliado · comissão após aprovação
                  </option>
                </select>
              </label>
              <label className="check-label">
                <input type="checkbox" name="accepted" required />
                <span>
                  Li as condições descritas nesta página e aceito o cálculo
                  sobre vendas elegíveis, as limitações de uso e os ajustes por
                  estorno.
                </span>
              </label>
              <button className="btn primary" disabled={p.busy}>
                Registrar inscrição
              </button>
            </form>
          )}
          <PartnerLedger ledger={p.data.ledger} />
        </>
      )}
    </section>
  );
}
function PartnerLedger({
  ledger,
  admin = false,
}: {
  ledger: Ledger;
  admin?: boolean;
}) {
  return (
    <>
      <div className="overview-metrics">
        {ledger.balances.map((b) => (
          <div className="panel" key={b.user_id}>
            {admin && <small>Conta {b.user_id}</small>}
            <p>Acumulado: {money(b.earned)}</p>
            <strong>Liberado: {money(b.available)}</strong>
            <p>Repasses registrados: {money(b.paid)}</p>
          </div>
        ))}
      </div>
      <h3>Histórico de indicações</h3>
      {!ledger.sales.length && <p>Ainda não há compras atribuídas.</p>}
      {ledger.sales.map((s) => (
        <article className="panel" key={s.order_id}>
          <strong>Pedido {s.order_id.slice(0, 8)}</strong>
          <p>
            {statusLabel(s.order_status)} ·{" "}
            {new Date(s.created).toLocaleDateString("pt-BR")}
          </p>
          {s.kind === "affiliate" ? (
            <p>
              {money(s.amount)} ·{" "}
              {s.available
                ? "Liberado conforme conciliação"
                : "Aguardando conciliação, prazo ou análise"}
            </p>
          ) : (
            <p>
              {s.reward?.status === "issued"
                ? "Cupom pessoal: " + s.reward.code
                : s.reward?.status === "reversed_used"
                  ? "Estorno posterior ao uso do cupom: análise pela operação."
                  : s.reward
                    ? "Benefício cancelado por estorno."
                    : "Aguardando liberação do cupom."}
            </p>
          )}
        </article>
      ))}
      {ledger.payouts.length > 0 && (
        <>
          <h3>Repasses registrados</h3>
          {ledger.payouts.map((x) => (
            <p key={x.id}>
              {money(x.amount)} · {x.reference} ·{" "}
              {new Date(x.created).toLocaleDateString("pt-BR")}
            </p>
          ))}
        </>
      )}
    </>
  );
}
export function PartnerAdmin() {
  const p = usePanel<{ accounts: PartnerAccount[]; ledger: Ledger }>(
      "partners-admin",
    ),
    s = usePanel<{ settings: Settings }>("partner-settings");
  return (
    <section>
      <span className="eyebrow">CRESCIMENTO COM CONTROLE</span>
      <h2>Programa de indicações e afiliados</h2>
      <Notice text={p.message || s.message} />
      {s.data && (
        <form
          className="panel form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = values(e.currentTarget);
            s.act("partner-settings", {
              enabled: f.enabled === "on",
              discount_percent: Number(f.discount_percent),
              student_reward: Number(f.student_reward),
              min_total: Number(f.min_total),
              affiliate_rate: Number(f.affiliate_rate),
            });
          }}
        >
          <p>
            Começa desativado. A ativação aplica os valores abaixo a novas
            inscrições e compras; comissões aceitas anteriormente são
            preservadas. Recompensas e descontos usam apenas o acervo próprio.
          </p>
          <label className="check-label">
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={s.data.settings.enabled}
            />
            Ativar programa
          </label>
          <div className="form-row">
            <label>
              Desconto do comprador (%)
              <input
                name="discount_percent"
                type="number"
                min={0}
                max={30}
                defaultValue={s.data.settings.discount_percent}
              />
            </label>
            <label>
              Comissão padrão (pontos-base: 1000 = 10%)
              <input
                name="affiliate_rate"
                type="number"
                min={0}
                max={3000}
                defaultValue={s.data.settings.affiliate_rate}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Recompensa em cupom (centavos)
              <input
                name="student_reward"
                type="number"
                min={0}
                max={5000}
                defaultValue={s.data.settings.student_reward}
              />
            </label>
            <label>
              Mínimo pago elegível (centavos)
              <input
                name="min_total"
                type="number"
                min={1000}
                max={100000}
                defaultValue={s.data.settings.min_total}
              />
            </label>
          </div>
          <button className="btn secondary" disabled={s.busy}>
            Salvar condições
          </button>
        </form>
      )}
      {p.data?.accounts.map((a) => (
        <form
          className="panel form"
          key={a.code}
          onSubmit={(e) => {
            e.preventDefault();
            p.act("partners-admin", {
              user_id: a.user_id,
              status: values(e.currentTarget).status,
            });
          }}
        >
          <h3>{a.name}</h3>
          <p>
            {a.email} · {a.kind === "student" ? "Estudante" : "Afiliado"} ·{" "}
            {a.code} · {a.rate_bps / 100}%
          </p>
          <label>
            Estado
            <select name="status" defaultValue={a.status}>
              <option value="pending" disabled>
                Aguardando aprovação
              </option>
              <option value="approved">Aprovado</option>
              <option value="paused">Pausado</option>
              <option value="rejected">Não aprovado</option>
            </select>
          </label>
          <button className="btn secondary small" disabled={p.busy}>
            Salvar decisão
          </button>
        </form>
      ))}
      {p.data && (
        <>
          <PartnerLedger ledger={p.data.ledger} admin />
          <form
            className="panel form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = values(e.currentTarget);
              p.act("partner-payout", {
                user_id: f.user_id,
                amount: Number(f.amount),
                reference: f.reference,
              });
            }}
          >
            <h3>Registrar transferência já realizada</h3>
            <p>
              Confira saldo, estornos e comprovante. Este registro não executa
              transferência bancária.
            </p>
            <label>
              Conta do afiliado
              <select name="user_id" required>
                <option value="">Selecione</option>
                {p.data.accounts
                  .filter((a) => a.kind === "affiliate")
                  .map((a) => (
                    <option value={a.user_id} key={a.code}>
                      {a.name} · {a.user_id}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Valor (centavos)
              <input name="amount" type="number" min={1} required />
            </label>
            <label>
              Referência do comprovante
              <input name="reference" minLength={6} maxLength={150} required />
            </label>
            <button className="btn secondary" disabled={p.busy}>
              Registrar repasse externo
            </button>
          </form>
        </>
      )}
    </section>
  );
}
type Institution = {
  id: string;
  organization: string;
  course: string;
  message: string;
  seats: number;
  product_ids: string;
  status: string;
  price: number | null;
  scope: string;
  expires: string;
  items: { product_id: string; title: string; price: number }[];
};
export function InstitutionPanel({ admin = false }: { admin?: boolean }) {
  const p = usePanel<{ requests: Institution[] }>(
      admin ? "institution-admin" : "institutions",
    ),
    [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    callApi("catalog")
      .then((d) =>
        setProducts(
          (d.products as Product[]).filter((x) => x.owned === 1 && !x.demo),
        ),
      )
      .catch((e) => p.setMessage(e.message));
  }, []);
  return (
    <section className={admin ? "market-panel" : "container page-section"}>
      <span className="eyebrow">CONHECIMENTO PARA UMA TURMA INTEIRA</span>
      <h1>Licenciamento institucional.</h1>
      <p className="lead">
        Propostas para professores, cursos e bibliotecas, com materiais
        definidos e de 2 a 100 acessos pessoais por pedido.
      </p>
      <ContextHelp topic="institutions" />
      <Notice text={p.message} />
      {!admin && (
        <details className="panel" open>
          <summary>Solicitar uma proposta</summary>
          {!products.length ? (
            <p className="notice">
              A operação ainda está preparando o acervo próprio. As propostas
              ficarão disponíveis quando os primeiros materiais comerciais forem
              publicados.
            </p>
          ) : (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = e.currentTarget,
                  d = new FormData(f);
                p.act("institutions", {
                  organization: d.get("organization"),
                  course: d.get("course"),
                  message: d.get("message"),
                  seats: Number(d.get("seats")),
                  product_ids: d.getAll("product_ids"),
                });
              }}
            >
              <label>
                Instituição ou curso
                <input
                  name="organization"
                  required
                  minLength={3}
                  maxLength={180}
                />
              </label>
              <label>
                Disciplina ou curso de uso
                <input name="course" maxLength={100} />
              </label>
              <label>
                Participantes
                <input
                  name="seats"
                  type="number"
                  min={2}
                  max={100}
                  defaultValue={20}
                  required
                />
              </label>
              <fieldset>
                <legend>Materiais desejados</legend>
                {products.map((x) => (
                  <label className="check-label" key={x.id}>
                    <input type="checkbox" name="product_ids" value={x.id} />
                    {x.title}
                  </label>
                ))}
              </fieldset>
              <label>
                Objetivo e condições desejadas
                <textarea
                  name="message"
                  required
                  minLength={20}
                  maxLength={5000}
                />
              </label>
              <button className="btn primary" disabled={p.busy}>
                Enviar solicitação sem cobrança
              </button>
            </form>
          )}
        </details>
      )}
      {p.data?.requests.map((r) => (
        <article className="panel institutional-card" key={r.id}>
          <span className="badge">{statusLabel(r.status)}</span>
          <h2>{r.organization}</h2>
          <p>
            {r.course} · {r.seats} licenças
          </p>
          <p className="pre-line">{r.message}</p>
          {r.scope && (
            <>
              <h3>Proposta da operação</h3>
              <p className="pre-line">{r.scope}</p>
              <ul>
                {r.items.map((i) => (
                  <li key={i.product_id}>
                    {i.title} · {money(i.price)} pelo conjunto de licenças
                  </li>
                ))}
              </ul>
              <strong>Total: {money(r.price || 0)}</strong>
              <p>Válida até {new Date(r.expires).toLocaleString("pt-BR")}</p>
            </>
          )}
          {admin && ["requested", "quoted"].includes(r.status) ? (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = values(e.currentTarget);
                p.act("institution-admin", {
                  id: r.id,
                  price: Number(f.price),
                  seats: Number(f.seats),
                  scope: f.scope,
                  expires: new Date(String(f.expires)).toISOString(),
                });
              }}
            >
              <div className="form-row">
                <label>
                  Preço total em centavos
                  <input
                    name="price"
                    type="number"
                    min={0}
                    required
                    defaultValue={r.price || 0}
                  />
                </label>
                <label>
                  Licenças
                  <input
                    name="seats"
                    type="number"
                    min={2}
                    max={100}
                    required
                    defaultValue={r.seats}
                  />
                </label>
              </div>
              <label>
                Validade da proposta
                <input name="expires" type="datetime-local" required />
              </label>
              <label>
                Escopo e condições
                <textarea
                  name="scope"
                  minLength={40}
                  maxLength={10000}
                  required
                  defaultValue={
                    r.scope ||
                    "Acessos pessoais nominativos, vinculados ao e-mail verificado. Inclui os materiais listados, sem direito de revenda ou publicação dos arquivos. A operação entrega o acesso após confirmação do pagamento."
                  }
                />
              </label>
              <button className="btn secondary" disabled={p.busy}>
                Enviar proposta
              </button>
              <button
                type="button"
                className="text-link"
                disabled={p.busy}
                onClick={() =>
                  p.act("institution-admin", {
                    action: "decline",
                    id: r.id,
                    scope:
                      "A solicitação não poderá ser atendida nas condições atuais. Consulte o suporte para esclarecer o escopo.",
                  })
                }
              >
                Não atender solicitação
              </button>
            </form>
          ) : !admin && r.status === "quoted" ? (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                p.act("institutions", {
                  action: "accept",
                  id: r.id,
                  accepted:
                    new FormData(e.currentTarget).get("accepted") === "on",
                });
              }}
            >
              <label className="check-label">
                <input type="checkbox" name="accepted" required />
                Li e aceito os materiais, o escopo, o valor total e a quantidade
                de licenças.
              </label>
              <button className="btn secondary" disabled={p.busy}>
                Aceitar proposta
              </button>
            </form>
          ) : !admin && ["accepted", "paid"].includes(r.status) ? (
            <button
              className="btn primary"
              disabled={p.busy}
              onClick={async () => {
                try {
                  const d = await callApi("institution-checkout", { id: r.id });
                  location.assign(d.url ? String(d.url) : "/#licencas");
                } catch (e) {
                  p.setMessage((e as Error).message);
                }
              }}
            >
              Continuar para pagamento ou licenças
            </button>
          ) : null}
        </article>
      ))}
      {p.data?.requests.length === 0 && (
        <p className="notice">Nenhuma solicitação registrada.</p>
      )}
    </section>
  );
}
export function LaunchPanel() {
  const p = usePanel<{
    templates: {
      id: string;
      title: string;
      subject: string;
      outline: string;
    }[];
    tasks: RecordRow[];
    collection: { published: number } | null;
  }>("launch-plan");
  return (
    <section>
      <span className="eyebrow">PRIMEIRA COLEÇÃO COMERCIAL</span>
      <h2>Lançamento do acervo do Professor Gustavo</h2>
      <p>
        Os roteiros abaixo organizam a produção. Não contêm apostilas clínicas
        prontas, preços finais nem materiais atribuídos ao professor sem envio e
        revisão.
      </p>
      <Notice text={p.message} />
      <div className="studio-actions">
        <button
          className="btn secondary"
          disabled={p.busy}
          onClick={() => p.act("launch-plan", { action: "prepare" })}
        >
          Preparar rascunhos e coleção
        </button>
        <button
          className="btn primary"
          disabled={p.busy || !p.data?.tasks.length}
          onClick={() => p.act("launch-plan", { action: "publish" })}
        >
          Publicar coleção com materiais aprovados
        </button>
        <a href="/experimentar" className="text-link">
          Conhecer experiência gratuita ↗
        </a>
      </div>
      {p.data?.templates.map((t) => {
        const saved = p.data?.tasks.find((x) => x.id === t.id);
        return (
          <article className="panel launch-task" key={t.id}>
            <h3>{t.title}</h3>
            <p>{t.subject}</p>
            <details>
              <summary>Roteiro de produção</summary>
              <p className="pre-line">{t.outline}</p>
            </details>
            {saved ? (
              <>
                <p>
                  Material: {String(saved.title)} ·{" "}
                  {statusLabel(saved.product_status)} ·{" "}
                  {money(Number(saved.price || 0))}
                </p>
                <form
                  className="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    p.act("launch-plan", {
                      ...values(e.currentTarget),
                      id: t.id,
                    });
                  }}
                >
                  <label>
                    Etapa
                    <select name="status" defaultValue={String(saved.status)}>
                      {[
                        ["planned", "Planejado"],
                        ["producing", "Produzindo"],
                        ["review", "Em revisão"],
                        ["ready", "Preparação concluída"],
                      ].map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Pendências e observações
                    <textarea
                      name="notes"
                      defaultValue={String(saved.notes)}
                      maxLength={5000}
                    />
                  </label>
                  <button className="btn secondary small" disabled={p.busy}>
                    Salvar planejamento
                  </button>
                </form>
                <a className="text-link" href="/#autores/materiais">
                  Enviar arquivo e editar no espaço do autor ↗
                </a>
              </>
            ) : (
              <p className="muted">Ainda não foi criado o rascunho.</p>
            )}
          </article>
        );
      })}
    </section>
  );
}
