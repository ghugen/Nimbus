"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
type Row = Record<string, unknown>;
export function DemandInsights() {
  const [data, setData] = useState<{
      since: string;
      searches: Row[];
      favorites: Row[];
      requests: Row[];
      materials: Row[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    callApi("demand-insights")
      .then((d) => setData(d as typeof data))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section>
      <span className="eyebrow">PRODUZA A PARTIR DA PROCURA</span>
      <h2>Interesse por curso e disciplina</h2>
      <p className="notice">
        Buscas e eventos medidos somente com permissão. Não são pessoas únicas
        nem uma previsão de vendas. O texto das buscas não é armazenado. Buscas
        e eventos consideram trinta dias; favoritos e pedidos mostram o
        acumulado atual.
      </p>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          {[
            [
              "Buscas sem resultado",
              data.searches.filter((r) => r.kind === "empty"),
            ],
            [
              "Buscas com resultados",
              data.searches.filter((r) => r.kind === "results"),
            ],
            ["Materiais nos favoritos", data.favorites],
            ["Pedidos no mural", data.requests],
            ["Visualizações, amostras e carrinhos", data.materials],
          ].map(([title, rows]) => (
            <section className="panel" key={String(title)}>
              <h3>{String(title)}</h3>
              {!(rows as Row[]).length ? (
                <p>Sem registros neste recorte.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Curso</th>
                        <th>Disciplina</th>
                        <th>Indicador</th>
                        <th>Quantidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rows as Row[]).map((r, i) => (
                        <tr key={i}>
                          <td>{String(r.course || "Não informado")}</td>
                          <td>{String(r.subject || "Não informado")}</td>
                          <td>
                            {r.requests
                              ? "Pedidos / apoios"
                              : (
                                  {
                                    view: "Visualizações",
                                    preview: "Amostras",
                                    cart: "Carrinhos",
                                    empty: "Sem resultado",
                                    results: "Com resultados",
                                  } as Record<string, string>
                                )[String(r.kind)] || "Favoritos"}
                          </td>
                          <td>
                            {r.requests
                              ? String(r.requests) +
                                " / " +
                                String(r.votes || 0)
                              : String(r.count)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </section>
  );
}
export function FeedbackReport({ id }: { id?: string }) {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    callApi("feedback-report" + (id ? "?id=" + encodeURIComponent(id) : ""))
      .then((d) => setRows(d.feedback as Row[]))
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <section className="panel">
      <h2>Feedback após o estudo</h2>
      <p>
        Respostas voluntárias e privadas. Não representam avaliações acadêmicas
        nem comprovação de eficácia. A identidade do estudante não é exibida
        neste painel.
      </p>
      {error && <p role="alert">{error}</p>}
      {!rows.length && <p>Ainda não há feedback neste recorte.</p>}
      {rows.map((r, i) => (
        <article className="source-card" key={i}>
          <h3>{String(r.title)}</h3>
          <p>
            Utilidade percebida: {String(r.helpfulness)}/5 ·{" "}
            {
              (
                {
                  too_easy: "Fácil para o objetivo",
                  adequate: "Dificuldade adequada",
                  too_hard: "Difícil para o conhecimento atual",
                } as Record<string, string>
              )[String(r.difficulty)]
            }
          </p>
          <p className="pre-line">
            {String(r.missing || "Sem observação adicional.")}
          </p>
        </article>
      ))}
    </section>
  );
}
const checkTitles: Record<string, string> = {
  payment_test: "Compra e reembolso reais na sandbox",
  support_test: "Atendimento e recuperação de acesso testados",
  backup_restore: "Ensaio de restauração e arquivos conferidos",
  content_review: "Primeira coleção revisada pelo responsável",
  accessibility_test: "Navegação por teclado e leitura assistiva conferidas",
};
export function LaunchReadiness() {
  const [data, setData] = useState<{
      automated: {
        id: string;
        title: string;
        ready: boolean;
        detail: string;
      }[];
      manual: Record<
        string,
        { checked: boolean; notes: string; actor: string; date: string }
      >;
      notice: string;
    } | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setData((await callApi("launch-readiness")) as typeof data);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  return (
    <section>
      <span className="eyebrow">PREPARAÇÃO PARA OS PRIMEIROS COMPRADORES</span>
      <h2>Prontidão para lançamento</h2>
      {message && <p role="status">{message}</p>}
      {data && (
        <>
          <p className="notice">{data.notice}</p>
          <div className="market-grid">
            {data.automated.map((i) => (
              <article className="panel" key={i.id}>
                <span className="badge">
                  {i.ready ? "Configuração presente" : "Pendente"}
                </span>
                <h3>{i.title}</h3>
                <p>{i.detail}</p>
              </article>
            ))}
          </div>
          <h3>Conferências com evidências</h3>
          {Object.entries(checkTitles).map(([id, title]) => (
            <details className="panel" key={id}>
              <summary>
                {data.manual[id]?.checked ? "✓" : "○"} {title}
              </summary>
              {data.manual[id] && (
                <p>
                  Registrado por {data.manual[id].actor} em{" "}
                  {new Date(data.manual[id].date).toLocaleString("pt-BR")}
                </p>
              )}
              <form
                className="form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const f = new FormData(e.currentTarget);
                  try {
                    await callApi("launch-readiness", {
                      id,
                      checked: f.get("checked") === "on",
                      notes: f.get("notes"),
                    });
                    await load();
                    setMessage("Conferência registrada.");
                  } catch (e) {
                    setMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Evidência e limitações
                  <textarea
                    name="notes"
                    required
                    minLength={20}
                    maxLength={2000}
                    defaultValue={data.manual[id]?.notes}
                  />
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    name="checked"
                    defaultChecked={data.manual[id]?.checked}
                  />
                  Conferência concluída conforme a evidência descrita
                </label>
                <button className="btn secondary" disabled={busy}>
                  Registrar
                </button>
              </form>
            </details>
          ))}
          <a className="text-link" href="/#admin/conexoes">
            Ver conexões e dependências ↗
          </a>
        </>
      )}
    </section>
  );
}

export function ProductStudyInsights({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Feedback de estudo deste material</summary>
      {open && <FeedbackReport id={id} />}
    </details>
  );
}
