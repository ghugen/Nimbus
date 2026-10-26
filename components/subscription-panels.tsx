"use client";
import { statusLabel } from "@/lib/status-labels";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
import { money, type Product } from "@/lib/catalog";
type Plan = {
  id: string;
  title: string;
  description: string;
  amount: number;
  interval: string;
  status: string;
  stripe_price_id: string;
  product_ids: string;
  available?: boolean;
  materials?: { id: string; title: string }[];
};
export function SubscriptionPage({ signedIn }: { signedIn: boolean }) {
  const [plans, setPlans] = useState<Plan[]>([]),
    [mine, setMine] = useState<
      {
        id: string;
        plan_id: string;
        title: string;
        status: string;
        expires: string;
      }[]
    >([]),
    [message, setMessage] = useState("");
  useEffect(() => {
    callApi("subscription-plans")
      .then((d) => setPlans(d.plans as Plan[]))
      .catch((e) => setMessage(e.message));
    if (signedIn)
      callApi("my-subscriptions")
        .then((d) => setMine(d.subscriptions as typeof mine))
        .catch((e) => setMessage(e.message));
  }, [signedIn]);
  return (
    <section className="container page-section">
      <span className="eyebrow">APRENDA COM CONTINUIDADE</span>
      <h1>Planos e clubes.</h1>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="author-public-grid">
        {plans.map((p) => (
          <form
            className="panel form"
            key={p.id}
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const d = await callApi("subscription-checkout", {
                  plan_id: p.id,
                  accepted:
                    new FormData(e.currentTarget).get("accepted") === "on",
                });
                location.assign(String(d.url));
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            <h2>{p.title}</h2>
            <p className="pre-line">{p.description}</p>
            <details>
              <summary>Materiais incluídos</summary>
              <ul>
                {p.materials?.map((m) => (
                  <li key={m.id}>{m.title}</li>
                ))}
              </ul>
            </details>
            {p.available === false && (
              <p className="notice">
                Este plano está em revisão. Novas assinaturas estão
                temporariamente indisponíveis.
              </p>
            )}
            <strong>
              {money(p.amount)} /{" "}
              {p.interval === "month"
                ? "mês"
                : p.interval === "year"
                  ? "ano"
                  : p.interval}
            </strong>
            <p>
              Acesso aos materiais incluídos enquanto a assinatura estiver
              ativa. A cobrança é recorrente; a gestão e o cancelamento ficam no
              portal do provedor.
            </p>
            {signedIn ? (
              <>
                <label className="check-label">
                  <input type="checkbox" name="accepted" required />
                  <span>
                    Li a descrição e aceito o valor, a periodicidade e as
                    condições de acesso.
                  </span>
                </label>
                <button
                  className="btn primary"
                  disabled={p.available === false}
                >
                  Assinar no checkout seguro
                </button>
              </>
            ) : (
              <a className="btn primary" href="/entrar?destino=assinaturas">
                Entrar para assinar
              </a>
            )}
          </form>
        ))}
      </div>
      {!plans.length && (
        <p className="notice">
          Os planos estão em preparação. Nenhuma cobrança recorrente está
          disponível neste momento.
        </p>
      )}
      {mine.length > 0 && (
        <>
          <h2>Suas assinaturas</h2>
          {mine.map((s) => (
            <article className="panel ticket" key={s.id}>
              <h3>
                {s.title} · {statusLabel(s.status)}
              </h3>
              <p>
                {s.expires
                  ? "Acesso até " + new Date(s.expires).toLocaleString("pt-BR")
                  : "Aguardando confirmação do provedor."}
              </p>
              <button
                className="btn secondary small"
                onClick={async () => {
                  try {
                    const d = await callApi("subscription-portal", {
                      id: s.id,
                    });
                    location.assign(String(d.url));
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                Gerenciar cobrança ou cancelamento
              </button>
              {s.status === "active" && <ClubPosts planId={s.plan_id} />}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
export function SubscriptionAdmin() {
  const [plans, setPlans] = useState<Plan[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [message, setMessage] = useState("");
  async function load() {
    setPlans((await callApi("subscription-admin")).plans as Plan[]);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
    callApi("catalog")
      .then((d) =>
        setProducts(
          (d.products as Product[]).filter((p) => !p.demo && p.owned === 1),
        ),
      )
      .catch(() => {});
  }, []);
  return (
    <section>
      <h2>Planos recorrentes e clubes</h2>
      <p className="notice">
        Primeiro cadastre o preço recorrente BRL no provedor. A ativação
        verifica esse preço pela API e aceita somente materiais do acervo
        próprio. O acesso depende de pagamento confirmado e prazo de vigência.
        Sem credenciais, os planos podem ser preparados como rascunho.
      </p>
      {message && <p role="status">{message}</p>}
      <form
        className="panel form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            await callApi("subscription-admin", {
              ...Object.fromEntries(f),
              product_ids: f.getAll("product_ids"),
            });
            await load();
            setMessage("Plano salvo.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        <label>
          Identificador para editar (deixe vazio para criar)
          <input name="id" maxLength={100} />
        </label>
        <label>
          Título
          <input name="title" required minLength={3} maxLength={150} />
        </label>
        <label>
          Descrição e condições
          <textarea name="description" required maxLength={5000} />
        </label>
        <label>
          Identificador do preço recorrente no provedor
          <input name="stripe_price_id" placeholder="price_…" maxLength={100} />
        </label>
        <fieldset>
          <legend>Materiais do plano</legend>
          {products.map((p) => (
            <label className="check-label" key={p.id}>
              <input type="checkbox" name="product_ids" value={p.id} />
              <span>{p.title}</span>
            </label>
          ))}
        </fieldset>
        <label>
          Estado
          <select name="status">
            <option value="draft">Rascunho</option>
            <option value="active">Ativar após validação</option>
            <option value="archived">Arquivar</option>
          </select>
        </label>
        <button className="btn secondary">Salvar plano</button>
      </form>
      {plans.map((p) => (
        <article className="panel ticket" key={p.id}>
          <h3>
            {p.title} · {statusLabel(p.status)}
          </h3>
          <p>{p.id}</p>
          <p>{p.description}</p>
          <small>
            {money(p.amount)} / {statusLabel(p.interval)}
          </small>
          <ClubPosts planId={p.id} admin />
        </article>
      ))}
    </section>
  );
}
function ClubPosts({
  planId,
  admin = false,
}: {
  planId: string;
  admin?: boolean;
}) {
  const [posts, setPosts] = useState<
      { id: string; title: string; text: string; created: string }[]
    >([]),
    [message, setMessage] = useState("");
  async function load() {
    setPosts(
      (await callApi("club-posts?plan=" + encodeURIComponent(planId)))
        .posts as typeof posts,
    );
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, [planId]);
  return (
    <details className="club-posts">
      <summary>Conteúdos e avisos do clube</summary>
      {message && <p role="status">{message}</p>}
      {admin && (
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = e.currentTarget;
            try {
              await callApi("club-posts", {
                ...Object.fromEntries(new FormData(f)),
                plan_id: planId,
              });
              f.reset();
              await load();
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          <label>
            Título
            <input name="title" required minLength={3} maxLength={150} />
          </label>
          <label>
            Conteúdo
            <textarea name="text" required minLength={10} maxLength={20000} />
          </label>
          <button className="btn secondary small">
            Publicar para assinantes
          </button>
        </form>
      )}
      {posts.map((p) => (
        <article className="notice" key={p.id}>
          <h4>{p.title}</h4>
          <small>{new Date(p.created).toLocaleDateString("pt-BR")}</small>
          <p className="pre-line">{p.text}</p>
        </article>
      ))}
    </details>
  );
}
