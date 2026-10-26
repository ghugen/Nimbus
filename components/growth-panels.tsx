"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
import { money, type Product } from "@/lib/catalog";
type Row = {
  id: string;
  course: string;
  subject: string;
  description: string;
  status: string;
  response: string;
  created: string;
  product_id: string;
  title: string;
  page: string;
  message: string;
};
export function CommunityPanel({
  kind,
  manage = false,
  author = false,
  productId,
}: {
  kind: "requests" | "issues";
  manage?: boolean;
  author?: boolean;
  productId?: string;
}) {
  const [items, setItems] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const endpoint = kind === "requests" ? "material-requests" : "content-issues";
  async function load() {
    const d = await callApi(endpoint + (author ? "?scope=author" : ""));
    setItems((d.requests || d.issues) as Row[]);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [kind, author]);
  async function submit(body: unknown, form?: HTMLFormElement) {
    setBusy(true);
    setError("");
    try {
      await callApi(endpoint, body);
      setMessage("Enviado e salvo.");
      form?.reset();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = productId
    ? items.filter((x) => x.product_id === productId)
    : items;
  return (
    <section className="community-panel">
      <h2>
        {kind === "requests"
          ? "Que material você gostaria de encontrar?"
          : "Correções dos materiais"}
      </h2>
      <p className="muted">
        {kind === "requests"
          ? "Sugira uma disciplina, tema ou formato. A sugestão não é uma encomenda nem garantia de publicação."
          : "Indique a página e o problema. O autor pode responder e publicar uma versão corrigida, disponível na biblioteca."}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {!manage && !author && (kind === "requests" || productId) && (
        <form
          className="panel form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget;
            submit(
              { ...Object.fromEntries(new FormData(f)), product_id: productId },
              f,
            );
          }}
        >
          {kind === "requests" ? (
            <>
              <label>
                Curso
                <input name="course" required maxLength={100} />
              </label>
              <label>
                Disciplina
                <input name="subject" required maxLength={100} />
              </label>
              <label>
                Qual material você procura?
                <textarea
                  name="description"
                  required
                  minLength={15}
                  maxLength={3000}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Página, questão ou seção
                <input name="page" required maxLength={100} />
              </label>
              <label>
                Descreva o possível erro
                <textarea
                  name="message"
                  required
                  minLength={15}
                  maxLength={3000}
                />
              </label>
              <p className="muted">
                Evite incluir dados pessoais ou informações de casos
                identificáveis.
              </p>
            </>
          )}
          <button className="btn primary" disabled={busy}>
            Enviar {kind === "requests" ? "sugestão" : "relato"}
          </button>
        </form>
      )}
      {visible.map((r) => (
        <article className="panel ticket" key={r.id}>
          <span className="badge">{r.status}</span>
          <h3>
            {kind === "requests"
              ? r.course + " · " + r.subject
              : r.title + " · " + r.page}
          </h3>
          <p className="pre-line">{r.description || r.message}</p>
          <small>{new Date(r.created).toLocaleDateString("pt-BR")}</small>
          {r.response && <p className="notice pre-line">{r.response}</p>}
          {(manage || author) && kind === "issues" && (
            <CorrectionVersion
              issueId={r.id}
              productId={r.product_id}
              onSaved={load}
            />
          )}
          {(manage || author) && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                submit({
                  ...Object.fromEntries(new FormData(e.currentTarget)),
                  action: "respond",
                  id: r.id,
                });
              }}
            >
              <label>
                Andamento
                <select name="status" defaultValue={r.status}>
                  <option value="open">Recebido</option>
                  {kind === "requests" ? (
                    <>
                      <option value="planned">Planejado</option>
                      <option value="completed">Disponível</option>
                    </>
                  ) : (
                    <>
                      <option value="in_progress">Em análise</option>
                      <option value="resolved">Resolvido</option>
                    </>
                  )}
                  <option value="declined">Não será atendido</option>
                </select>
              </label>
              <label>
                Resposta
                <textarea
                  name="response"
                  defaultValue={r.response}
                  required
                  minLength={5}
                  maxLength={3000}
                />
              </label>
              <button className="btn secondary small" disabled={busy}>
                Responder
              </button>
            </form>
          )}
        </article>
      ))}
      {!visible.length && (
        <p className="notice">Nenhum registro por aqui ainda.</p>
      )}
    </section>
  );
}
export type Collection = {
  slug: string;
  title: string;
  description: string;
  course: string;
  subject: string;
  products: Product[];
};
export function CollectionsPanel() {
  const [items, setItems] = useState<Collection[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    callApi("collections")
      .then((d) => setItems(d.collections as Collection[]))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="container page-section">
      <span className="eyebrow">ESTUDE POR DISCIPLINA</span>
      <h1>Coleções Nimbus.</h1>
      <p className="lead">
        Seu próximo tema, organizado em um só lugar. Começamos pela Medicina
        Veterinária.
      </p>
      {error && <p className="error">{error}</p>}
      <div className="author-public-grid">
        {items.map((c) => (
          <a
            className="panel author-product"
            key={c.slug}
            href={"/colecoes/" + c.slug}
          >
            <span className="eyebrow">{c.course}</span>
            <h2>{c.title}</h2>
            <p>{c.description}</p>
            <strong>
              {c.products.filter((p) => !p.demo || p.price === 0).length}{" "}
              materiais disponíveis
            </strong>
            <span className="text-link">Conhecer coleção ↗</span>
          </a>
        ))}
      </div>
    </section>
  );
}
export function CollectionsAdmin() {
  const [products, setProducts] = useState<Product[]>([]),
    [items, setItems] = useState<
      { slug: string; title: string; published: number }[]
    >([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    const d = await callApi("collections-admin");
    setItems(d.collections as typeof items);
  }
  useEffect(() => {
    Promise.all([
      callApi("catalog").then((d) => setProducts(d.products as Product[])),
      load(),
    ]).catch((e) => setError(e.message));
  }, []);
  return (
    <section>
      <h2>Coleções por disciplina</h2>
      <p className="muted">
        Crie páginas de lançamento por curso e disciplina. Se selecionar
        materiais, a coleção utiliza essa seleção; caso contrário, busca por
        curso e disciplina. Repita o endereço para atualizar uma coleção
        existente.
      </p>
      {error && <p className="error">{error}</p>}
      {message && <p className="notice">{message}</p>}
      <form
        className="panel form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            await callApi("collections-admin", {
              ...Object.fromEntries(f),
              published: f.get("published") === "on",
              product_ids: f.getAll("product_ids"),
            });
            setMessage("Coleção salva.");
            await load();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <label>
          Endereço
          <input
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="patologia-veterinaria"
          />
        </label>
        <label>
          Título
          <input name="title" required minLength={4} maxLength={100} />
        </label>
        <label>
          Descrição
          <textarea name="description" maxLength={2000} />
        </label>
        <label>
          Curso
          <input
            name="course"
            defaultValue="Medicina Veterinária"
            maxLength={100}
          />
        </label>
        <label>
          Disciplina
          <input name="subject" maxLength={100} />
        </label>
        <fieldset>
          <legend>Seleção de materiais (opcional)</legend>
          {products.map((p) => (
            <label className="check-label" key={p.id}>
              <input type="checkbox" name="product_ids" value={p.id} />
              <span>
                {p.title}
                {p.demo ? " · demonstrativo" : ""}
              </span>
            </label>
          ))}
        </fieldset>
        <label className="check-label">
          <input type="checkbox" name="published" />
          <span>Publicar coleção</span>
        </label>
        <button className="btn primary">Salvar coleção</button>
      </form>
      <div className="panel">
        {items.map((c) => (
          <p key={c.slug}>
            <a className="text-link" href={"/colecoes/" + c.slug}>
              {c.title}
            </a>{" "}
            · {c.published ? "Publicada" : "Rascunho"} · {c.slug}
          </p>
        ))}
      </div>
    </section>
  );
}
export function CouponsAdmin() {
  const [items, setItems] = useState<
      {
        code: string;
        kind: string;
        value: number;
        starts: string;
        ends: string;
        active: number;
        uses: number;
        max_uses: number;
      }[]
    >([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    setItems((await callApi("coupons")).coupons as typeof items);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  return (
    <section>
      <h2>Cupons de lançamento</h2>
      <p className="notice">
        Aplicáveis somente ao acervo próprio Nimbus. Um uso por conta, com
        limite global. Pedidos pendentes reservam uso até falha ou expiração
        confirmada. As condições do código são imutáveis; desative e crie outro
        para mudar a campanha.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p className="notice">{message}</p>}
      <form
        className="panel form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = e.currentTarget,
            d = new FormData(f);
          try {
            await callApi("coupons", {
              ...Object.fromEntries(d),
              value:
                d.get("kind") === "fixed"
                  ? Math.round(Number(d.get("value")) * 100)
                  : Number(d.get("value")),
              min_total: Math.round(Number(d.get("min_total")) * 100),
              max_uses: Number(d.get("max_uses")),
              starts: new Date(String(d.get("starts"))).toISOString(),
              ends: new Date(String(d.get("ends"))).toISOString(),
            });
            f.reset();
            setMessage("Cupom criado.");
            await load();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <label>
          Código
          <input name="code" pattern="[A-Za-z0-9_-]{3,40}" required />
        </label>
        <div className="form-row">
          <label>
            Tipo
            <select name="kind">
              <option value="percent">Porcentagem</option>
              <option value="fixed">Valor em reais</option>
            </select>
          </label>
          <label>
            Desconto
            <input type="number" name="value" min="0.01" step="0.01" required />
          </label>
        </div>
        <div className="form-row">
          <label>
            Compra mínima do acervo próprio (R$)
            <input
              name="min_total"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              required
            />
          </label>
          <label>
            Limite de usos
            <input name="max_uses" type="number" min="1" step="1" required />
          </label>
        </div>
        <div className="form-row">
          <label>
            Início
            <input type="datetime-local" name="starts" required />
          </label>
          <label>
            Fim
            <input type="datetime-local" name="ends" required />
          </label>
        </div>
        <button className="btn primary">Criar cupom</button>
      </form>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Desconto</th>
              <th>Validade</th>
              <th>Usos</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.code}>
                <td>{c.code}</td>
                <td>{c.kind === "percent" ? c.value + "%" : money(c.value)}</td>
                <td>{new Date(c.ends).toLocaleString("pt-BR")}</td>
                <td>
                  {c.uses}/{c.max_uses}
                </td>
                <td>
                  <button
                    className="btn secondary small"
                    onClick={async () => {
                      try {
                        await callApi("coupons", {
                          action: "toggle",
                          code: c.code,
                          active: !c.active,
                        });
                        await load();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    {c.active ? "Desativar" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
export function CouponInput({
  ids,
  onApplied,
  seats = 1,
}: {
  seats?: number;
  ids: string[];
  onApplied: (
    q: { code: string; discount: number; total: number } | null,
  ) => void;
}) {
  const [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const key = ids.toSorted().join(",") + ":" + seats;
  useEffect(() => {
    onApplied(null);
    setError("");
  }, [key]);
  return (
    <div className="coupon-entry">
      <label htmlFor="coupon-code">Cupom de desconto</label>
      <div>
        <input
          id="coupon-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            onApplied(null);
          }}
          maxLength={40}
          placeholder="Código de lançamento"
        />
        <button
          className="btn secondary small"
          disabled={busy || !code}
          onClick={async () => {
            setBusy(true);
            try {
              const q = await callApi("coupon-quote", { ids, code, seats });
              onApplied(q as { code: string; discount: number; total: number });
              setError("");
            } catch (e) {
              setError((e as Error).message);
              onApplied(null);
            } finally {
              setBusy(false);
            }
          }}
        >
          Aplicar
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <small>
        Válido para materiais do acervo próprio, conforme condições.
      </small>
    </div>
  );
}

function CorrectionVersion({
  issueId,
  productId,
  onSaved,
}: {
  issueId: string;
  productId: string;
  onSaved: () => Promise<void>;
}) {
  const [versions, setVersions] = useState<
      { id: string; sequence: number; notes: string }[]
    >([]),
    [message, setMessage] = useState("");
  return (
    <details
      className="panel"
      onToggle={async (e) => {
        if (e.currentTarget.open) {
          try {
            setVersions(
              (
                await callApi(
                  "editorial-versions?id=" + encodeURIComponent(productId),
                )
              ).versions as typeof versions,
            );
          } catch (e) {
            setMessage((e as Error).message);
          }
        }
      }}
    >
      <summary>Vincular resolução a uma versão publicada</summary>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            await callApi("correction-version", {
              id: issueId,
              version_id: f.get("version_id"),
              response: f.get("response"),
            });
            setMessage("Correção vinculada e estudante avisado.");
            await onSaved();
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        <label>
          Versão corrigida
          <select name="version_id" required>
            <option value="">Escolha uma versão aprovada</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                Versão {v.sequence} · {v.notes.slice(0, 100)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Orientação ao estudante
          <textarea name="response" maxLength={3000} />
        </label>
        <button className="btn secondary small" disabled={!versions.length}>
          Registrar resolução
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
