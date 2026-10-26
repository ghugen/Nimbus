"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
import { editorialCriteria, reviewChecks } from "@/lib/editorial-criteria";
export function ReviewCriteria({ format }: { format: string }) {
  return (
    <div className="review-criteria">
      <h4>Critérios para este formato</h4>
      <ul>
        {(editorialCriteria[format] || editorialCriteria.default).map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <fieldset>
        <legend>Aspectos efetivamente revisados</legend>
        {reviewChecks.map(([id, label]) => (
          <label className="check-label" key={id}>
            <input type="checkbox" name="review_checks" value={id} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
export function LearningReview({ id }: { id: string }) {
  const [data, setData] = useState<Record<string, unknown[]> | null>(null),
    [error, setError] = useState("");
  return (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open && !data)
          callApi("learning-review?id=" + encodeURIComponent(id))
            .then((d) => setData(d.package as typeof data))
            .catch((e) => setError(e.message));
      }}
    >
      <summary>Conferir atividades e aulas interativas</summary>
      {error && <p>{error}</p>}
      {data ? (
        Object.entries(data).map(([kind, items]) => (
          <div key={kind}>
            <h4>
              {kind === "cards"
                ? "Flashcards"
                : kind === "questions"
                  ? "Questões e gabaritos"
                  : "Aulas"}
            </h4>
            {items.map((item, i) => (
              <article className="notice" key={i}>
                {Object.entries(item as Record<string, unknown>)
                  .filter(([key]) => key !== "id")
                  .map(([key, value]) => (
                    <p className="pre-line" key={key}>
                      <strong>
                        {{
                          front: "Frente",
                          back: "Verso",
                          title: "Título",
                          text: "Conteúdo",
                          prompt: "Enunciado",
                          options: "Alternativas",
                          correct: "Gabarito (índice a partir de zero)",
                          explanation: "Justificativa",
                          video_url: "Vídeo",
                        }[key] || key}
                        :
                      </strong>{" "}
                      {Array.isArray(value) ? value.join(" | ") : String(value)}
                    </p>
                  ))}
              </article>
            ))}
          </div>
        ))
      ) : (
        <p>Sem atividades carregadas.</p>
      )}
    </details>
  );
}
export function ReviewModeration({ admin = false }: { admin?: boolean }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]),
    [message, setMessage] = useState("");
  async function load() {
    setItems((await callApi("review-moderation")).reviews as typeof items);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  return (
    <section>
      <h2>Avaliações e respostas</h2>
      {message && <p role="status">{message}</p>}
      {items.map((r) => (
        <article className="panel ticket" key={String(r.id)}>
          <h3>
            {String(r.title)} · {String(r.rating)}/5
          </h3>
          <p>{String(r.comment)}</p>
          <small>
            {String(r.name)} · {String(r.status)}
          </small>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await callApi("review-moderation", {
                  id: r.id,
                  response: new FormData(e.currentTarget).get("response"),
                });
                await load();
                setMessage("Resposta publicada.");
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            <label>
              Resposta da autoria ou operação
              <textarea
                name="response"
                defaultValue={String(r.response || "")}
                required
                minLength={5}
                maxLength={3000}
              />
            </label>
            <button className="btn secondary small">Responder avaliação</button>
          </form>
          {admin && (
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await callApi("review-moderation", {
                    id: r.id,
                    action: "visibility",
                    ...Object.fromEntries(new FormData(e.currentTarget)),
                  });
                  await load();
                  setMessage(
                    "Visibilidade atualizada com registro no histórico.",
                  );
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              <label>
                Visibilidade
                <select name="status" defaultValue={String(r.status)}>
                  <option value="visible">Visível</option>
                  <option value="hidden">Oculta</option>
                </select>
              </label>
              <label>
                Justificativa da moderação
                <textarea
                  name="reason"
                  required
                  minLength={10}
                  maxLength={3000}
                />
              </label>
              <button className="btn secondary small">
                Registrar moderação
              </button>
            </form>
          )}
        </article>
      ))}
    </section>
  );
}
export function VerificationPanel() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]),
    [message, setMessage] = useState("");
  async function load() {
    setItems((await callApi("profile-verification")).users as typeof items);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  return (
    <section>
      <h2>Credenciais declaradas e verificadas</h2>
      <p className="notice">
        Registre apenas verificações realmente realizadas pela operação. O texto
        da verificação pode aparecer no perfil público; a evidência de
        conferência permanece restrita à administração. Atualizações de perfil
        invalidam a verificação anterior.
      </p>
      {message && <p role="status">{message}</p>}
      {items.map((u) => (
        <form
          className="panel form ticket"
          key={String(u.id)}
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await callApi("profile-verification", {
                ...Object.fromEntries(new FormData(e.currentTarget)),
                user_id: u.id,
              });
              await load();
              setMessage("Verificação registrada.");
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          <h3>{String(u.public_name || u.name)}</h3>
          <p className="pre-line">
            Declarado: {String(u.credentials || "Não informado")}
          </p>
          <label>
            Estado
            <select
              name="status"
              defaultValue={String(u.status || "unverified")}
            >
              <option value="unverified">Não verificado</option>
              <option value="verified">Verificado pela operação</option>
            </select>
          </label>
          <label>
            O que pode ser anunciado como verificado
            <input
              name="label"
              defaultValue={String(u.label || "")}
              maxLength={500}
            />
          </label>
          <label>
            Evidência de conferência (restrita)
            <textarea
              name="evidence"
              defaultValue={String(u.evidence || "")}
              maxLength={3000}
            />
          </label>
          <button className="btn secondary small">Salvar verificação</button>
        </form>
      ))}
    </section>
  );
}
