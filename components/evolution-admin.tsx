"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
type RecordItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  course: string;
  semester: string;
  product_ids: string;
  due: string;
  status: string;
};
const kinds: Record<string, string> = {
  path: "Trilha por disciplina/semestre",
  calendar: "Planejamento editorial",
  errata: "Correção importante",
  incident: "Incidente do serviço",
};
export function EvolutionAdmin() {
  const [records, setRecords] = useState<RecordItem[]>([]),
    [questions, setQuestions] = useState<
      { product_id: string; question: string; count: number }[]
    >([]),
    [products, setProducts] = useState<{ id: string; title: string }[]>([]),
    [selected, setSelected] = useState<RecordItem | null>(null),
    [message, setMessage] = useState(""),
    [settings, setSettings] = useState({ paused: false, message: "" }),
    [busy, setBusy] = useState(false);
  async function load() {
    const [r, q, s, p] = await Promise.all([
      callApi("evolution-admin"),
      callApi("recurring-questions"),
      callApi("sales-maintenance"),
      callApi("catalog"),
    ]);
    setRecords(r.records as RecordItem[]);
    setQuestions(q.questions as typeof questions);
    setSettings(s.settings as typeof settings);
    setProducts(
      (p.products as { id: string; title: string; demo: number }[]).filter(
        (p) => !p.demo,
      ),
    );
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  return (
    <section>
      <h2>Curadoria, calendário e continuidade</h2>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <details className="panel">
        <summary>Pausar ou retomar novas compras</summary>
        <p>
          Preserva biblioteca, downloads e reembolsos. Não cancela sessões de
          pagamento já abertas nem renovações de assinaturas existentes.
        </p>
        <form
          className="form"
          key={String(settings.paused)}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              await callApi("sales-maintenance", {
                paused: f.get("paused") === "on",
                message: f.get("message"),
              });
              await load();
              setMessage("Configuração de novas compras atualizada.");
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="check-label">
            <input
              type="checkbox"
              name="paused"
              defaultChecked={settings.paused}
            />
            Suspender novos checkouts pagos
          </label>
          <label>
            Mensagem pública
            <textarea
              name="message"
              required
              minLength={10}
              maxLength={1000}
              defaultValue={settings.message}
            />
          </label>
          <button className="btn secondary" disabled={busy}>
            Salvar manutenção
          </button>
        </form>
        <a href="/situacao">Ver página de situação</a>
      </details>
      <div className="studio-actions">
        <button
          className="btn secondary"
          onClick={() =>
            setSelected({
              id: "",
              kind: "calendar",
              title: "",
              body: "",
              course: "",
              semester: "",
              product_ids: "[]",
              due: "",
              status: "draft",
            })
          }
        >
          Criar registro editorial
        </button>
      </div>
      {selected && (
        <form
          className="panel form"
          key={selected.id + selected.title}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              await callApi("evolution-admin", {
                ...Object.fromEntries(f),
                id: selected.id || undefined,
                product_ids: String(f.get("ids"))
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              });
              await load();
              setSelected(null);
              setMessage(
                "Registro salvo. Correções publicadas notificam titulares; e-mail depende do provedor.",
              );
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Tipo
            <select
              name="kind"
              defaultValue={selected.kind}
              disabled={!!selected.id}
            >
              {Object.entries(kinds).map(([id, label]) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </select>
            {selected.id && (
              <input name="kind" type="hidden" value={selected.kind} />
            )}
          </label>
          <label>
            Título
            <input
              name="title"
              required
              minLength={5}
              maxLength={150}
              defaultValue={selected.title}
            />
          </label>
          <label>
            Descrição, sequência e orientações
            <textarea
              name="body"
              required
              minLength={20}
              maxLength={6000}
              defaultValue={selected.body}
            />
          </label>
          <div className="form-row">
            <label>
              Curso
              <input
                name="course"
                defaultValue={selected.course}
                maxLength={100}
              />
            </label>
            <label>
              Semestre ou disciplina
              <input
                name="semester"
                defaultValue={selected.semester}
                maxLength={100}
              />
            </label>
          </div>
          <label>
            Data prevista
            <input name="due" type="date" defaultValue={selected.due} />
          </label>
          <label>
            Códigos dos materiais na ordem desejada, separados por vírgulas
            <input
              name="ids"
              defaultValue={(JSON.parse(selected.product_ids) as string[]).join(
                ", ",
              )}
            />
          </label>
          <details>
            <summary>Consultar códigos dos materiais reais publicados</summary>
            {products.map((p) => (
              <p key={p.id}>
                {p.title}: <code>{p.id}</code>
              </p>
            ))}
          </details>
          <label>
            Estado
            <select name="status" defaultValue={selected.status}>
              <option value="draft">Rascunho / planejado</option>
              <option value="published">Publicado / em andamento</option>
              <option value="resolved">Resolvido / concluído</option>
              <option value="archived">Arquivado</option>
            </select>
          </label>
          <p>
            Publicar incidente ou trilha torna o texto visível aos visitantes
            autorizados do site. Publicar correção envia avisos aos titulares. A
            data do calendário é planejamento, sem publicação agendada
            automática.
          </p>
          <button className="btn primary" disabled={busy}>
            Salvar registro
          </button>
          <button
            className="text-link"
            type="button"
            onClick={() => setSelected(null)}
          >
            Cancelar edição
          </button>
        </form>
      )}
      <h3>Calendário e registros</h3>
      {!records.length && <p>Nenhum registro criado.</p>}
      {records.map((r) => (
        <article className="panel" key={r.id}>
          <span className="badge">
            {kinds[r.kind]} · {r.status}
          </span>
          <h4>{r.title}</h4>
          <p>
            {r.due || "Sem data definida"} · {r.course} {r.semester}
          </p>
          <p className="pre-line">{r.body}</p>
          {!(r.kind === "errata" && r.status === "published") && (
            <button
              className="btn secondary small"
              onClick={() => setSelected(r)}
            >
              Editar registro
            </button>
          )}
        </article>
      ))}
      <h3>Dúvidas para melhoria dos materiais</h3>
      <p>
        Agrupamento por texto idêntico e material; perguntas semelhantes com
        outra redação precisam de triagem manual.
      </p>
      {questions.map((q, i) => (
        <article className="source-card" key={i}>
          <strong>{q.count} ocorrência(s)</strong>
          <p>{q.question}</p>
          <button
            className="btn secondary small"
            onClick={() =>
              setSelected({
                id: "",
                kind: "calendar",
                title: "Revisar dúvida recorrente",
                body: q.question,
                course: "",
                semester: "",
                product_ids: JSON.stringify([q.product_id]),
                due: "",
                status: "draft",
              })
            }
          >
            Planejar melhoria
          </button>
        </article>
      ))}
    </section>
  );
}
