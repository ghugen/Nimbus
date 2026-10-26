"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
import { money, type Product } from "@/lib/catalog";
export function GettingStarted() {
  const [products, setProducts] = useState<Product[]>([]),
    [loaded, setLoaded] = useState(false),
    [course, setCourse] = useState(""),
    [subject, setSubject] = useState(""),
    [goal, setGoal] = useState("understand"),
    [message, setMessage] = useState("");
  useEffect(() => {
    callApi("catalog")
      .then((d) =>
        setProducts(
          (d.products as Product[]).filter((p) => !p.demo || p.price === 0),
        ),
      )
      .catch((e) => setMessage(e.message))
      .finally(() => setLoaded(true));
  }, []);
  const result = products
    .filter(
      (p) =>
        (!course || p.course === course) && (!subject || p.subject === subject),
    )
    .map((p) => ({
      p,
      score:
        (goal === "practice" && /Flashcards|Questões|Simulados/i.test(p.format)
          ? 3
          : goal === "organize" && /Modelos|Guias|Mapas/i.test(p.format)
            ? 3
            : goal === "understand" && /Resumos|Apostilas|Guias/i.test(p.format)
              ? 3
              : 0) + (p.price === 0 ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  return (
    <section className="container page-section getting-started">
      <a className="text-link" href="/">
        ← Nimbus
      </a>
      <span className="eyebrow">SEU PRIMEIRO PASSO</span>
      <h1>Comece pelo que você precisa estudar.</h1>
      <p className="lead">
        Escolha seu curso e objetivo. As sugestões usam as informações do
        catálogo, sem avaliação do seu desempenho.
      </p>
      <div className="panel form">
        <div className="form-row">
          <label>
            Curso
            <select
              value={course}
              onChange={(e) => {
                setCourse(e.target.value);
                setSubject("");
              }}
            >
              <option value="">Todos os cursos</option>
              {[...new Set(products.map((p) => p.course).filter(Boolean))].map(
                (c) => (
                  <option key={c}>{c}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Disciplina
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="">Todas as disciplinas</option>
              {[
                ...new Set(
                  products
                    .filter((p) => !course || p.course === course)
                    .map((p) => p.subject),
                ),
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Qual é seu objetivo agora?</legend>
          {[
            ["understand", "Entender os fundamentos"],
            ["practice", "Praticar e revisar"],
            ["organize", "Organizar meus estudos"],
          ].map(([id, label]) => (
            <label className="check-label" key={id}>
              <input
                type="radio"
                name="goal"
                value={id}
                checked={goal === id}
                onChange={() => setGoal(id)}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </div>
      {message && <p role="alert">{message}</p>}
      <h2>Sugestões para começar</h2>
      {!loaded && <p role="status">Carregando materiais disponíveis…</p>}
      {loaded && !result.length && (
        <p className="notice">
          Ainda não há materiais reais neste recorte. Você pode experimentar os
          guias gratuitos e pedir um tema no mural.
        </p>
      )}
      <div className="market-grid">
        {result.map(({ p }) => (
          <article className="panel" key={p.id}>
            <span className="badge">{p.format}</span>
            <h3>{p.title}</h3>
            <p>{p.description}</p>
            <p>
              {p.price === 0 ? "Grátis" : money(p.price)} · {p.subject}
            </p>
            <small>
              Selecionado pelo curso, disciplina e formato informado no
              catálogo.
            </small>
            <a
              className="btn secondary"
              href={"/materiais/" + encodeURIComponent(p.id)}
            >
              Conhecer e conferir a amostra
            </a>
          </article>
        ))}
      </div>
      <div className="studio-actions">
        <a className="btn primary" href="/experimentar">
          Experimentar grátis
        </a>
        <a className="btn secondary" href="/#mural">
          Pedir outro tema
        </a>
        <a className="text-link" href="/#suporte">
          Preciso de ajuda com meu acesso
        </a>
      </div>
    </section>
  );
}
type Transparency = {
  items: { id: string; label: string; status: string }[];
  reviewer: string | null;
  reviewed_at: string | null;
  notice: string;
};
export function MaterialConfidence({ id }: { id: string }) {
  const [data, setData] = useState<{
      update_policy: string;
      transparency: Transparency;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    callApi("material-experience?id=" + encodeURIComponent(id))
      .then((d) => {
        if (alive) setData(d as typeof data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [id]);
  return (
    <section className="panel editorial-transparency">
      <h3>Transparência editorial</h3>
      {error && <p role="status">{error}</p>}
      {data && (
        <>
          <ul className="editorial-status-list">
            {data.transparency.items.map((i) => (
              <li key={i.id}>
                <strong>{i.label}</strong>
                <span>
                  {i.status === "reviewed"
                    ? "Conferência registrada pela revisão"
                    : i.status === "registered"
                      ? "Informação cadastrada"
                      : "Sem conferência específica registrada"}
                </span>
              </li>
            ))}
          </ul>
          {data.transparency.reviewer && (
            <p>
              Revisão: {data.transparency.reviewer} ·{" "}
              {new Date(data.transparency.reviewed_at!).toLocaleDateString(
                "pt-BR",
              )}
            </p>
          )}
          <p className="muted">{data.transparency.notice}</p>
          <h3>Atualizações incluídas</h3>
          <p className="pre-line">{data.update_policy}</p>
          <a className="text-link" href={"/amostras/" + encodeURIComponent(id)}>
            Ler amostra em formato de texto ↗
          </a>
        </>
      )}
    </section>
  );
}
export function AccessibleSample({
  product: p,
  descriptions,
}: {
  product: Product;
  descriptions: string[];
}) {
  const [size, setSize] = useState(20);
  return (
    <main className="container page-section reading-sample">
      <a className="text-link" href={"/materiais/" + p.id}>
        ← Página do material
      </a>
      <span className="eyebrow">AMOSTRA PÚBLICA · LEITURA EM TEXTO</span>
      <h1>{p.title}</h1>
      <p>
        {p.author} · {p.subject}
      </p>
      <p className="notice">
        Esta é a prévia pública cadastrada pelo autor. Ela não concede acesso ao
        arquivo completo. Imagens e textos dependem da revisão do responsável.
      </p>
      <label>
        Tamanho do texto
        <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
          <option value={18}>18 px</option>
          <option value={20}>20 px</option>
          <option value={24}>24 px</option>
          <option value={28}>28 px</option>
        </select>
      </label>
      <article style={{ fontSize: size, lineHeight: 1.8 }}>
        <h2>Amostra do conteúdo</h2>
        <p className="pre-line">
          {p.preview || "O autor ainda não cadastrou uma amostra textual."}
        </p>
        {p.toc && (
          <>
            <h2>Sumário informado</h2>
            <p className="pre-line">{p.toc}</p>
          </>
        )}
        {p.sources && (
          <>
            <h2>Referências informadas</h2>
            <p className="pre-line">{p.sources}</p>
          </>
        )}
        {Array.from({ length: p.preview_count || 0 }, (_, i) => (
          <figure key={i}>
            <img
              src={"/api/asset/" + p.id + "/preview/" + i}
              alt={
                descriptions[i] ||
                "Página de amostra " +
                  (i + 1) +
                  " de " +
                  p.title +
                  ". Descrição detalhada não fornecida."
              }
              loading="lazy"
            />
            <figcaption>
              {descriptions[i] ||
                "Descrição detalhada ainda não fornecida pelo autor."}
            </figcaption>
          </figure>
        ))}
      </article>
      <a className="btn secondary" href="/experimentar">
        Experimentar o leitor com um guia gratuito
      </a>
    </main>
  );
}
export function StudyFeedback({ productId }: { productId: string }) {
  const [saved, setSaved] = useState<{
      helpfulness: number;
      difficulty: string;
      missing: string;
    } | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    callApi("study-feedback?id=" + encodeURIComponent(productId))
      .then((d) => {
        if (alive) setSaved(d.feedback as typeof saved);
      })
      .catch((e) => {
        if (alive) setMessage(e.message);
      });
    return () => {
      alive = false;
    };
  }, [productId]);
  return (
    <details className="panel">
      <summary>Este material ajudou no seu estudo?</summary>
      <p>
        Feedback privado para o autor e a equipe. Não inclui nota da disciplina,
        diagnóstico nem avaliação formal do estudante. Evite dados pessoais de
        terceiros.
      </p>
      <form
        className="form"
        key={JSON.stringify(saved)}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            await callApi("study-feedback", {
              product_id: productId,
              helpfulness: Number(f.get("helpfulness")),
              difficulty: f.get("difficulty"),
              missing: f.get("missing"),
              consent: f.get("consent") === "on",
            });
            setMessage("Obrigado. Seu feedback foi enviado à equipe.");
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Quanto ajudou?
          <select name="helpfulness" defaultValue={saved?.helpfulness || 5}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} —{" "}
                {
                  [
                    "Não ajudou",
                    "Ajudou pouco",
                    "Ajudou em parte",
                    "Ajudou bastante",
                    "Ajudou muito",
                  ][n - 1]
                }
              </option>
            ))}
          </select>
        </label>
        <label>
          Dificuldade percebida
          <select
            name="difficulty"
            defaultValue={saved?.difficulty || "adequate"}
          >
            <option value="too_easy">Fácil demais para meu objetivo</option>
            <option value="adequate">Adequada para meu objetivo</option>
            <option value="too_hard">
              Difícil para meu conhecimento atual
            </option>
          </select>
        </label>
        <label>
          O que faltou ou poderia melhorar?
          <textarea
            name="missing"
            maxLength={1500}
            defaultValue={saved?.missing}
          />
        </label>
        <label className="check-label">
          <input type="checkbox" name="consent" required />
          Quero compartilhar este feedback com o autor e a equipe
        </label>
        <button className="btn secondary" disabled={busy}>
          Enviar feedback
        </button>
      </form>
      <button
        type="button"
        className="text-link"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await callApi("study-feedback", {
              product_id: productId,
              action: "delete",
            });
            setSaved(null);
            setMessage("Feedback removido.");
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Remover meu feedback
      </button>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
export function ExperienceEditor({
  id,
  onSaved,
}: {
  id: string;
  onSaved?: () => void;
}) {
  const [data, setData] = useState<{
      update_policy: string;
      sample_descriptions: string;
    } | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setData(null);
  }, [id]);
  return (
    <details
      className="product-operations"
      onToggle={(e) => {
        if (e.currentTarget.open && !data)
          callApi("experience-editor?id=" + id)
            .then((d) => setData(d.experience as typeof data))
            .catch((e) => setMessage(e.message));
      }}
    >
      <summary>Atualizações e descrições das amostras</summary>
      <p>
        Descreva o que está incluído. Compras anteriores preservam as condições
        registradas. Alterações passam por nova revisão editorial.
      </p>
      {data && (
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              await callApi("experience-editor", {
                product_id: id,
                update_policy: f.get("update_policy"),
                sample_descriptions: Array.from({ length: 6 }, (_, i) =>
                  String(f.get("alt-" + i) || ""),
                ),
                confirmed: f.get("confirmed") === "on",
              });
              setMessage(
                "Salvo. Confira o material e solicite nova aprovação.",
              );
              onSaved?.();
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Atualizações incluídas
            <textarea
              name="update_policy"
              defaultValue={data.update_policy}
              minLength={40}
              maxLength={3000}
              required
            />
          </label>
          <p className="muted">
            O sistema mantém acesso às versões publicadas deste material. Não
            prometa restrições que o sistema não aplica nem produtos que não
            estão incluídos.
          </p>
          {Array.from({ length: 6 }, (_, i) => (
            <label key={i}>
              Descrição da amostra {i + 1}
              <textarea
                name={"alt-" + i}
                maxLength={500}
                defaultValue={
                  (JSON.parse(data.sample_descriptions || "[]") as string[])[
                    i
                  ] || ""
                }
              />
            </label>
          ))}
          <label className="check-label">
            <input type="checkbox" name="confirmed" required />
            Conferi as condições e as descrições das imagens
          </label>
          <button className="btn secondary" disabled={busy}>
            Salvar para revisão
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
export function LaunchChecklist({ id }: { id: string }) {
  const [data, setData] = useState<{
      items: { id: string; label: string; ready: boolean }[];
      notice: string;
    } | null>(null),
    [message, setMessage] = useState("");
  async function load() {
    try {
      setData((await callApi("launch-check?id=" + id)) as typeof data);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <details
      className="product-operations"
      onToggle={(e) => {
        if (e.currentTarget.open && !data) load();
      }}
    >
      <summary>Conferir preparação para publicação</summary>
      {data && (
        <>
          <ul className="launch-checklist">
            {data.items.map((i) => (
              <li key={i.id}>
                <span aria-label={i.ready ? "Conferido" : "Pendente"}>
                  {i.ready ? "✓" : "○"}
                </span>{" "}
                {i.label}
              </li>
            ))}
          </ul>
          <p className="muted">{data.notice}</p>
        </>
      )}
      <button className="btn secondary small" type="button" onClick={load}>
        Atualizar conferência
      </button>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
export function AuthorOnboarding() {
  return (
    <section className="panel author-onboarding">
      <span className="eyebrow">DO ORIGINAL À PUBLICAÇÃO</span>
      <h2>Seu caminho como autor</h2>
      <ol>
        {[
          [
            "Prepare o original",
            "Defina o público, os objetivos e o recorte. Confira os direitos sobre textos e imagens.",
          ],
          [
            "Confira as condições",
            "Veja a comissão, as taxas, o prazo de liberação e como os repasses são registrados. O aceite ocorre no envio do material.",
          ],
          [
            "Envie conteúdo e amostras",
            "Cadastre o sumário, as fontes, o arquivo, uma prévia textual e descrições úteis das imagens.",
          ],
          [
            "Revise antes de enviar",
            "Use o checklist por material e confira legibilidade no celular, preço e política de atualização.",
          ],
          [
            "Acompanhe a curadoria",
            "Responda aos pedidos de ajuste. A publicação e a indicação de revisão dependem da equipe.",
          ],
          [
            "Cuide do que publicou",
            "Acompanhe dúvidas, feedback, correções e datas de revisão. Consulte vendas e repasses no seu painel.",
          ],
        ].map(([title, text]) => (
          <li key={title}>
            <strong>{title}</strong>
            <p>{text}</p>
          </li>
        ))}
      </ol>
      <div className="studio-actions">
        <a className="btn secondary" href="/#autores/publicar">
          Preparar meu primeiro material
        </a>
        <a className="text-link" href="/#autores/vendas">
          Consultar condições e recebimentos
        </a>
      </div>
    </section>
  );
}
