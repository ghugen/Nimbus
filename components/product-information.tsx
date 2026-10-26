"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
import { money, type Product } from "@/lib/catalog";
type Info = {
  review_schedule?: {
    next_review: string;
    last_review: string;
    reviewer: string;
    pause_sales: number;
  } | null;
  extra: {
    prerequisites?: string;
    audience?: string;
    exclusions?: string;
    requirements?: string;
    faq?: string;
  };
  versions: { sequence: number; notes: string; released: string }[];
  components: Product[];
  questions: { id: string; question: string; answer: string }[];
};
export function ProductInformation({ product: p }: { product: Product }) {
  const [data, setData] = useState<Info | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    callApi("product-info?id=" + encodeURIComponent(p.id))
      .then((d) => setData(d as unknown as Info))
      .catch((e) => setMessage(e.message));
  }, [p.id]);
  return (
    <section className="product-extra">
      <h3>Antes de escolher</h3>
      {message && <p role="status">{message}</p>}
      {data && (
        <>
          {[
            ["Conhecimentos prévios", data.extra.prerequisites],
            ["Para quem é", data.extra.audience],
            ["O que não está incluído", data.extra.exclusions],
            [
              "Como abrir os arquivos",
              data.extra.requirements ||
                "Verifique o formato anunciado. PDFs podem ser abertos no leitor da Nimbus; outros formatos exigem um aplicativo compatível.",
            ],
            ["Perguntas frequentes", data.extra.faq],
          ].map(([label, text]) =>
            text ? (
              <div key={label}>
                <h4>{label}</h4>
                <p className="pre-line">{text}</p>
              </div>
            ) : null,
          )}
          {!!data.components.length && (
            <div className="panel">
              <h4>Materiais deste kit</h4>
              {data.components.map((c) => (
                <p key={c.id}>
                  <a className="text-link" href={"/materiais/" + c.id}>
                    {c.title}
                  </a>{" "}
                  · {money(c.price)}
                </p>
              ))}
              <p>
                Compra individual:{" "}
                {money(data.components.reduce((s, c) => s + c.price, 0))} · Kit:{" "}
                {money(p.price)}
              </p>
              <strong>
                Diferença:{" "}
                {money(
                  data.components.reduce((s, c) => s + c.price, 0) - p.price,
                )}
              </strong>
            </div>
          )}
          {!!data.versions.length && (
            <details>
              <summary>Histórico de atualizações</summary>
              {data.versions.map((v) => (
                <article key={v.sequence}>
                  <h4>
                    Versão {v.sequence} ·{" "}
                    {new Date(v.released).toLocaleDateString("pt-BR")}
                  </h4>
                  <p className="pre-line">{v.notes}</p>
                </article>
              ))}
            </details>
          )}
          {data.review_schedule && (
            <div className="notice">
              <h4>Revisão editorial programada</h4>
              <p>
                Próxima revisão:{" "}
                {data.review_schedule.next_review
                  .split("-")
                  .reverse()
                  .join("/")}
              </p>
              {data.review_schedule.last_review && (
                <p>
                  Última conferência:{" "}
                  {new Date(
                    data.review_schedule.last_review,
                  ).toLocaleDateString("pt-BR")}{" "}
                  · {data.review_schedule.reviewer}
                </p>
              )}
            </div>
          )}
          <h4>Dúvidas respondidas</h4>
          {data.questions.map((q) => (
            <details key={q.id}>
              <summary>{q.question}</summary>
              <p className="pre-line">{q.answer}</p>
            </details>
          ))}
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              try {
                await callApi("product-questions", {
                  product_id: p.id,
                  question: new FormData(f).get("question"),
                });
                setMessage(
                  "Pergunta enviada. Ela aparecerá publicamente apenas após resposta e moderação.",
                );
                f.reset();
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            <label>
              Pergunte antes de comprar
              <textarea
                name="question"
                required
                minLength={10}
                maxLength={3000}
                placeholder="É necessário entrar na conta para enviar sua pergunta."
              />
            </label>
            <button className="btn secondary small">
              Enviar pergunta para análise
            </button>
          </form>
          <details>
            <summary>Relatar problema de autoria ou qualidade</summary>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await callApi("quality-reports", {
                    product_id: p.id,
                    reason: new FormData(e.currentTarget).get("reason"),
                  });
                  setMessage("Relato encaminhado à administração.");
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              <label>
                Descrição e referência
                <textarea
                  name="reason"
                  required
                  minLength={20}
                  maxLength={5000}
                />
              </label>
              <button className="btn secondary small">
                Encaminhar relato privado
              </button>
            </form>
          </details>
        </>
      )}
    </section>
  );
}
export function FollowAuthor({ slug }: { slug: string }) {
  const [following, setFollowing] = useState(false),
    [notify, setNotify] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    callApi("author-follow")
      .then((d) => {
        const f = (d.follows as { author_slug: string; notify: number }[]).find(
          (x) => x.author_slug === slug,
        );
        setFollowing(!!f);
        setNotify(!!f?.notify);
      })
      .catch(() => {});
  }, [slug]);
  async function save(next: boolean, n: boolean) {
    try {
      await callApi("author-follow", { slug, following: next, notify: n });
      setFollowing(next);
      setNotify(n);
      setMessage(next ? "Autor seguido." : "Você deixou de seguir este autor.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <div className="follow-author">
      <button
        className="btn secondary small"
        onClick={() => save(!following, notify)}
      >
        {following ? "Deixar de seguir" : "Seguir autor"}
      </button>
      {following && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => save(true, e.target.checked)}
          />
          <span>Quero receber avisos de novas publicações deste autor.</span>
        </label>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
export function RelatedMaterials({ productId }: { productId: string }) {
  const [items, setItems] = useState<Product[]>([]);
  useEffect(() => {
    callApi("discover?related=" + encodeURIComponent(productId))
      .then((d) => setItems((d.products as Product[]).slice(0, 4)))
      .catch(() => {});
  }, [productId]);
  return items.length ? (
    <section className="related-materials">
      <h3>Outros materiais sobre temas próximos</h3>
      <div className="author-public-grid">
        {items.map((p) => (
          <a
            className="panel author-product"
            key={p.id}
            href={"/materiais/" + p.id}
          >
            <span>{p.format}</span>
            <h4>{p.title}</h4>
            <strong>
              {p.demo && p.price > 0 ? "Demonstrativo" : money(p.price)}
            </strong>
          </a>
        ))}
      </div>
      <small>
        Seleção por disciplina, curso e autoria. Não representa indicação
        individual de um professor.
      </small>
    </section>
  ) : null;
}
