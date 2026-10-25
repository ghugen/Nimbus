"use client";
import { CommunityPanel } from "./growth-panels";
import { useEffect, useState } from "react";
import { areas, levels, languages } from "@/lib/taxonomy";
import { formats, money, type Product } from "@/lib/catalog";
import { signedFetch } from "@/lib/client-auth";
import { callApi, AnalyticsPanel } from "./commerce-panels";
import { EarningsPreview, FinancePanel } from "./finance-panel";
import type { AuthorPolicy, FinanceReport } from "@/lib/finance-types";
type Data = {
  products: Product[];
  policy: AuthorPolicy;
  finance: FinanceReport;
  editorial: {
    product_id: string;
    action: string;
    feedback: string;
    created: string;
    reviewer: string;
  }[];
};
const blank = {
  id: "",
  title: "",
  category: "Saúde",
  course: "Medicina Veterinária",
  subject: "",
  topic: "",
  format: "Resumos e apostilas",
  level: "Graduação",
  language: "Português",
  description: "",
  preview: "",
  price: "",
  pages: "",
  objectives: "",
  toc: "",
  sources: "",
  revision_notes: "",
  bundle_ids: [] as string[],
  rights: false,
  commercial_accepted: false,
};
export function AuthorStudio() {
  const [data, setData] = useState<Data | null>(null),
    [tab, setTab] = useState("materiais"),
    [step, setStep] = useState(0),
    [form, setForm] = useState(blank),
    [file, setFile] = useState<File | null>(null),
    [cover, setCover] = useState<File | null>(null),
    [previews, setPreviews] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    setData((await callApi("author")) as unknown as Data);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(p?: Product) {
    setForm(
      p
        ? {
            ...blank,
            id: p.id,
            title: p.title,
            category: p.category,
            course: p.course || "",
            subject: p.subject,
            topic: p.topic || "",
            format: p.format,
            level: p.level || "Graduação",
            language: p.language || "Português",
            description: p.description,
            preview: p.preview,
            price: (p.price / 100).toFixed(2),
            pages: String(p.pages),
            objectives: p.objectives || "",
            toc: p.toc || "",
            sources: p.sources || "",
            revision_notes: p.revision_notes || "",
            bundle_ids: JSON.parse(p.bundle_ids || "[]"),
          }
        : { ...blank },
    );
    setFile(null);
    setCover(null);
    setPreviews([]);
    setStep(0);
    setTab("publicar");
  }
  async function upload(id: string, kind: string, f: File) {
    const body = new FormData();
    body.set("id", id);
    body.set("file", f);
    body.set("kind", kind);
    body.set("notes", form.revision_notes || "Publicação inicial.");
    const r = await signedFetch(
      "/api/" + (kind === "file" ? "upload" : "asset-upload"),
      { method: "POST", body },
    );
    const result = (await r.json()) as { error?: string };
    if (!r.ok) throw new Error(result.error || "Falha no envio.");
  }
  async function save(submit: boolean) {
    if (!data) return;
    await action(async () => {
      const result = await callApi("author", {
        ...form,
        price: Math.round(Number(form.price) * 100),
        pages: Number(form.pages),
        accepted_rate: data.policy.owned ? 0 : data.policy.commission_bps,
        accepted_owned: data.policy.owned,
      });
      const id = String(result.id);
      setForm((f) => ({ ...f, id }));
      await callApi("author-meta", { ...form, id });
      if (file) await upload(id, "file", file);
      if (cover) await upload(id, "cover", cover);
      for (const image of previews) await upload(id, "preview", image);
      if (submit) await callApi("submit", { id });
      else await callApi("author-meta", { ...form, id });
      setMessage(submit ? "Material enviado para análise." : "Rascunho salvo.");
      setTab("materiais");
      setFile(null);
      setCover(null);
      setPreviews([]);
    });
  }
  const field = (
    name: keyof typeof blank,
    label: string,
    extra: Record<string, unknown> = {},
  ) => (
    <label>
      {label}
      <input
        value={String(form[name])}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        {...extra}
      />
    </label>
  );
  const text = (
    name:
      | "description"
      | "preview"
      | "objectives"
      | "toc"
      | "sources"
      | "revision_notes",
    label: string,
    min = 0,
  ) => (
    <label>
      {label}
      <textarea
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        required={min > 0}
        minLength={min}
        maxLength={name === "preview" ? 20000 : 6000}
      />
    </label>
  );
  return (
    <div className="author-studio">
      <div className="tabs">
        {[
          ["materiais", "Meus materiais"],
          ["publicar", "Publicar"],
          ["perfil", "Minha página"],
          ["vendas", "Vendas e recebimentos"],
          ["indicadores", "Indicadores"],
          ["correcoes", "Correções"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
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
      {!data ? (
        <p>Carregando sua área…</p>
      ) : (
        <>
          {tab === "materiais" && (
            <>
              <button className="btn primary" onClick={() => edit()}>
                Publicar novo material
              </button>
              <div className="studio-materials">
                {data.products.map((p) => (
                  <article className="panel" key={p.id}>
                    <span className="badge">{p.status}</span>
                    <h3>{p.title}</h3>
                    <p>
                      {money(p.price)} · {p.format}
                    </p>
                    <small>
                      {p.file_name ||
                        ((JSON.parse(p.bundle_ids || "[]") as string[]).length
                          ? "Kit com materiais cadastrados"
                          : "Arquivo pendente")}
                    </small>
                    <div className="studio-actions">
                      <button
                        className="btn secondary small"
                        onClick={() => edit(p)}
                      >
                        Editar / atualizar
                      </button>
                      {p.status === "published" && (
                        <a
                          className="btn secondary small"
                          href={"/materiais/" + p.id}
                        >
                          Página pública
                        </a>
                      )}
                      <button
                        className="text-link"
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            await callApi("submit", { id: p.id });
                            setMessage("Enviado para análise.");
                          })
                        }
                      >
                        Enviar para análise
                      </button>
                    </div>
                    {data.editorial
                      ?.filter((e) => e.product_id === p.id)
                      .slice(0, 3)
                      .map((r, i) => (
                        <div className="notice" key={i}>
                          <strong>Devolutiva · {r.action}</strong>
                          <p className="pre-line">{r.feedback}</p>
                          <small>
                            {new Date(r.created).toLocaleDateString("pt-BR")} ·{" "}
                            {r.reviewer}
                          </small>
                        </div>
                      ))}
                  </article>
                ))}
              </div>
              {!data.products.length && (
                <p className="notice">
                  Seu primeiro material começa em Publicar. Você pode preparar
                  um arquivo individual ou um kit de materiais já publicados.
                </p>
              )}
            </>
          )}
          {tab === "perfil" && <AuthorProfile />}
          {tab === "vendas" && <FinancePanel report={data.finance} />}{" "}
          {tab === "indicadores" && <AnalyticsPanel />}
          {tab === "correcoes" && <CommunityPanel kind="issues" author />}
          {tab === "publicar" && (
            <form
              className="panel form studio-wizard"
              onSubmit={(e) => {
                e.preventDefault();
                if (step < 3) setStep(step + 1);
                else save(true);
              }}
            >
              <div className="wizard-steps" aria-label="Etapas da publicação">
                {[
                  "Identificação",
                  "Conteúdo",
                  "Comercial",
                  "Arquivos e revisão",
                ].map((t, i) => (
                  <span className={i === step ? "active" : ""} key={t}>
                    {i + 1}. {t}
                  </span>
                ))}
              </div>
              <h2>{form.id ? "Atualizar material" : "Publicar material"}</h2>
              {step === 0 && (
                <>
                  {field("title", "Título", {
                    required: true,
                    minLength: 5,
                    maxLength: 150,
                  })}
                  <div className="form-row">
                    <label>
                      Área
                      <select
                        value={form.category}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            category: e.target.value,
                            course: areas[e.target.value][0],
                          })
                        }
                      >
                        {Object.keys(areas).map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Curso
                      <select
                        value={form.course}
                        onChange={(e) =>
                          setForm({ ...form, course: e.target.value })
                        }
                      >
                        {(areas[form.category] || []).map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {field("subject", "Disciplina", {
                    required: true,
                    maxLength: 100,
                  })}
                  {field("topic", "Assunto específico", { maxLength: 120 })}
                  <div className="form-row">
                    <label>
                      Tipo
                      <select
                        value={form.format}
                        onChange={(e) =>
                          setForm({ ...form, format: e.target.value })
                        }
                      >
                        {formats.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Nível
                      <select
                        value={form.level}
                        onChange={(e) =>
                          setForm({ ...form, level: e.target.value })
                        }
                      >
                        {levels.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Idioma
                    <select
                      value={form.language}
                      onChange={(e) =>
                        setForm({ ...form, language: e.target.value })
                      }
                    >
                      {languages.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  {text("description", "Descrição para o comprador", 30)}
                </>
              )}
              {step === 1 && (
                <>
                  {text("objectives", "Objetivos de aprendizagem")}
                  {text("toc", "Sumário / assuntos abordados")}
                  {text("sources", "Referências e fontes")}
                  {text("preview", "Trecho público representativo", 50)}
                  {text("revision_notes", "O que mudou nesta versão?")}
                </>
              )}
              {step === 2 && (
                <>
                  <div className="form-row">
                    {field("price", "Preço (R$)", {
                      type: "number",
                      min: 0,
                      max: 10000,
                      step: 0.01,
                      required: true,
                    })}
                    {field("pages", "Páginas / páginas equivalentes", {
                      type: "number",
                      min: 1,
                      max: 5000,
                      required: true,
                    })}
                  </div>
                  <details open={form.format === "Kits e coleções"}>
                    <summary>Montar um kit de materiais publicados</summary>
                    <p className="muted">
                      Escolha pelo menos dois materiais seus, sem outros kits. O
                      preço do kit não pode superar a soma individual. Todos os
                      arquivos serão entregues separadamente na biblioteca.
                    </p>
                    {data.products
                      .filter(
                        (p) =>
                          p.id !== form.id &&
                          p.status === "published" &&
                          !JSON.parse(p.bundle_ids || "[]").length &&
                          p.file_key,
                      )
                      .map((p) => (
                        <label className="check-label" key={p.id}>
                          <input
                            type="checkbox"
                            checked={form.bundle_ids.includes(p.id)}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                bundle_ids: e.target.checked
                                  ? [...form.bundle_ids, p.id]
                                  : form.bundle_ids.filter((id) => id !== p.id),
                              })
                            }
                          />
                          <span>
                            {p.title} · {money(p.price)}
                          </span>
                        </label>
                      ))}
                  </details>
                  <EarningsPreview
                    price={Math.max(
                      0,
                      Math.round((Number(form.price) || 0) * 100),
                    )}
                    policy={data.policy}
                  />
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={form.rights}
                      onChange={(e) =>
                        setForm({ ...form, rights: e.target.checked })
                      }
                      required
                    />
                    <span>
                      Sou autor ou tenho autorização para comercializar os
                      conteúdos e imagens.
                    </span>
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={form.commercial_accepted}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          commercial_accepted: e.target.checked,
                        })
                      }
                      required
                    />
                    <span>
                      Aceito a regra comercial exibida, com custos reais de
                      processamento antes da divisão. Descontos e serviços
                      editoriais adicionais dependem de acordo específico.
                    </span>
                  </label>
                </>
              )}
              {step === 3 && (
                <>
                  <p className="notice">
                    O material ficará em análise. O selo de revisão só aparece
                    quando um revisor registra explicitamente sua avaliação.
                    Alterações em arquivos, capa ou conteúdo exigem nova
                    aprovação.
                  </p>
                  {!form.bundle_ids.length && (
                    <label>
                      Arquivo do material · até 20 MB
                      <input
                        type="file"
                        accept=".pdf,.txt,.docx,.xlsx,.pptx,.png,.jpg,.zip,.mp4,.mp3"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                      <small>
                        {file?.name ||
                          data.products.find((p) => p.id === form.id)
                            ?.file_name ||
                          "Nenhum arquivo selecionado"}
                      </small>
                    </label>
                  )}
                  <label>
                    Capa · PNG/JPG até 5 MB
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(e) => setCover(e.target.files?.[0] || null)}
                    />
                  </label>
                  <label>
                    Páginas de prévia · até 6 imagens, 5 MB cada
                    <input
                      type="file"
                      multiple
                      accept="image/png,image/jpeg"
                      onChange={(e) =>
                        setPreviews(
                          Array.from(e.target.files || []).slice(0, 6),
                        )
                      }
                    />
                  </label>
                  <p className="muted">
                    Envie apenas as páginas liberadas como amostra. Não envie o
                    PDF completo no campo de imagens públicas.
                  </p>
                  {form.id && (
                    <div className="studio-actions">
                      <button
                        className="text-link"
                        type="button"
                        onClick={() =>
                          action(async () => {
                            await callApi("asset-remove", {
                              id: form.id,
                              kind: "cover",
                            });
                            setMessage("Capa removida.");
                          })
                        }
                      >
                        Remover capa existente
                      </button>
                      <button
                        className="text-link"
                        type="button"
                        onClick={() =>
                          action(async () => {
                            const p = data.products.find(
                              (p) => p.id === form.id,
                            );
                            const keys = JSON.parse(
                              p?.preview_keys || "[]",
                            ) as string[];
                            for (let i = keys.length - 1; i >= 0; i--)
                              await callApi("asset-remove", {
                                id: form.id,
                                kind: "preview",
                                index: i,
                              });
                            setMessage("Prévias removidas.");
                          })
                        }
                      >
                        Remover prévias existentes
                      </button>
                    </div>
                  )}
                  <div className="publication-summary">
                    <strong>{form.title}</strong>
                    <p>
                      {form.course} · {form.subject} ·{" "}
                      {money(Math.round(Number(form.price) * 100))}
                    </p>
                    <p>
                      {form.bundle_ids.length
                        ? `Kit com ${form.bundle_ids.length} materiais`
                        : "Material individual"}
                    </p>
                  </div>
                </>
              )}
              <div className="studio-actions">
                {step > 0 && (
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => setStep(step - 1)}
                  >
                    Voltar
                  </button>
                )}
                {step === 3 && (
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => save(false)}
                  >
                    Salvar rascunho
                  </button>
                )}
                <button className="btn primary" disabled={busy}>
                  {busy
                    ? "Salvando…"
                    : step === 3
                      ? "Enviar para análise"
                      : "Continuar"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
function AuthorProfile() {
  const [profile, setProfile] = useState<{
      author_slug: string;
      public_name: string;
      bio: string;
      credentials: string;
      profile_public: number;
    } | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    callApi("author-profile")
      .then((d) => setProfile(d.profile as typeof profile))
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <form
      className="panel form"
      key={profile?.author_slug || "new"}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          await callApi("author-profile", {
            ...Object.fromEntries(f),
            public: f.get("public") === "on",
          });
          setMessage("Página de autor atualizada.");
        } catch (e) {
          setMessage((e as Error).message);
        }
      }}
    >
      <h2>Sua página de autor</h2>
      <p className="muted">
        Nome público, biografia e formação aparecem na página somente quando
        você autorizar. E-mail, instituição privada e dados de recebimento não
        são publicados.
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <label>
        Nome público
        <input
          name="public_name"
          defaultValue={profile?.public_name}
          minLength={2}
          maxLength={100}
          required
        />
      </label>
      <label>
        Endereço da página
        <input
          name="slug"
          defaultValue={profile?.author_slug}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          minLength={3}
          maxLength={60}
          required
        />
      </label>
      <label>
        Biografia
        <textarea name="bio" defaultValue={profile?.bio} maxLength={4000} />
      </label>
      <label>
        Formação e experiência declaradas
        <textarea
          name="credentials"
          defaultValue={profile?.credentials}
          maxLength={2000}
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          name="public"
          defaultChecked={!!profile?.profile_public}
        />
        <span>
          Autorizo a exibição dessas informações no meu perfil público.
        </span>
      </label>
      <button className="btn primary">Salvar página</button>
      {profile?.author_slug && (
        <a className="text-link" href={"/autores/" + profile.author_slug}>
          Ver página pública
        </a>
      )}
    </form>
  );
}
