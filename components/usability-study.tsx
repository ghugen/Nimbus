"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
type Task = { id: string; title: string; href: string };
const results: Record<string, string> = {
  easy: "Consegui facilmente",
  difficult: "Consegui com dificuldade",
  blocked: "Não consegui concluir",
  not_tested: "Não testei esta tarefa",
};
export function UsabilityStudy({ admin = false }: { admin?: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([]),
    [sessions, setSessions] = useState<
      {
        id: string;
        tasks: string;
        device: string;
        notes: string;
        created: string;
      }[]
    >([]),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    callApi("usability-tasks")
      .then((d) => setTasks(d.tasks as Task[]))
      .catch((e) => setMessage(e.message));
    if (admin)
      callApi("usability-feedback")
        .then((d) => setSessions(d.sessions as typeof sessions))
        .catch((e) => setMessage(e.message));
  }, [admin]);
  return (
    <section className={admin ? "market-panel" : "container page-section"}>
      {!admin && (
        <a href="/" className="text-link">
          ← Nimbus
        </a>
      )}
      <span className="eyebrow">MENOS ATRITO, MAIS ESTUDO</span>
      <h1>
        {admin ? "Avaliações de usabilidade" : "Ajude a melhorar a Nimbus."}
      </h1>
      <p className="lead">
        Cinco tarefas para descobrir onde a navegação pode melhorar. Não é
        necessário realizar pagamento. Não gravamos sua tela, cliques ou tempo
        de navegação.
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {admin ? (
        <>
          <p>
            Relatos voluntários enviados por contas autenticadas. A identidade
            não é exibida aqui; a operação mantém o vínculo para atender
            solicitações de privacidade.
          </p>
          {!sessions.length && (
            <p>
              Ainda não há relatos de participantes. A existência do roteiro não
              significa teste com estudantes realizado.
            </p>
          )}
          {sessions.map((s) => (
            <article className="panel" key={s.id}>
              <h3>
                {s.device} · {new Date(s.created).toLocaleDateString("pt-BR")}
              </h3>
              <ul>
                {(JSON.parse(s.tasks) as { id: string; result: string }[]).map(
                  (t) => (
                    <li key={t.id}>
                      {tasks.find((x) => x.id === t.id)?.title || t.id}:{" "}
                      {results[t.result]}
                    </li>
                  ),
                )}
              </ul>
              <p className="pre-line">{s.notes}</p>
            </article>
          ))}
          <a className="btn secondary" href="/avaliar">
            Abrir roteiro para participantes
          </a>
        </>
      ) : (
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              await callApi("usability-feedback", {
                tasks: tasks.map((t) => ({
                  id: t.id,
                  result: answers[t.id] || "not_tested",
                })),
                device: f.get("device"),
                notes: f.get("notes"),
                consent: f.get("consent") === "on",
              });
              setMessage("Obrigado. Sua avaliação foi registrada.");
            } catch (e) {
              setMessage(
                (e as Error).message +
                  " Para enviar, entre na sua conta Nimbus.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {tasks.map((t, i) => (
            <article className="panel" key={t.id}>
              <h2>
                {i + 1}. {t.title}
              </h2>
              <a
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
              >
                Abrir tarefa em outra aba ↗
              </a>
              <label>
                Como foi esta tarefa?
                <select
                  value={answers[t.id] || "not_tested"}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [t.id]: e.target.value }))
                  }
                >
                  {Object.entries(results).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </article>
          ))}
          <label>
            Dispositivo utilizado
            <select name="device">
              <option value="mobile">Celular</option>
              <option value="desktop">Computador</option>
              <option value="tablet">Tablet</option>
              <option value="other">Outro</option>
            </select>
          </label>
          <label>
            O que dificultou? Não inclua senhas, dados de pagamento ou
            informações pessoais.
            <textarea name="notes" maxLength={2000} />
          </label>
          <label className="check-label">
            <input name="consent" type="checkbox" required />
            Quero enviar minhas respostas à equipe, vinculadas à minha conta,
            para melhorar a navegação
          </label>
          <button className="btn primary" disabled={busy || !tasks.length}>
            Enviar avaliação
          </button>
          <a className="text-link" href="/entrar?destino=inicio">
            Entrar na Nimbus
          </a>
        </form>
      )}
    </section>
  );
}
