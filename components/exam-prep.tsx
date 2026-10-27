"use client";
import { useState } from "react";
import { callApi } from "./commerce-panels";
import { overlap } from "@/lib/exam-core";
import { money } from "@/lib/catalog";
import { type SofiaProfile, type SofiaMaterial } from "@/lib/sofia-core";
type Material = SofiaMaterial & {
  objectives: string;
  toc: string;
  sources: string;
  author: string;
  reviewed_at: string;
  revision_notes: string;
  questions: number;
  cards: number;
};
type Match = {
  topic: string;
  status: string;
  items: {
    id: string;
    title: string;
    format: string;
    price: number;
    matched: string[];
    ratio: number;
  }[];
};
type Review = {
  product_id: string;
  title: string;
  topic: string;
  page: number | null;
  misses: number;
};
export function ExamPrep({
  profile,
  ownedIds,
  personal,
  signedIn,
  onPlan,
  onMaterial,
  onStudy,
  onNavigate,
}: {
  profile: SofiaProfile;
  ownedIds: string[];
  personal: boolean;
  signedIn: boolean;
  onPlan: (p: SofiaProfile) => void;
  onMaterial: (id: string) => void;
  onStudy: (id: string, mode: "read" | "practice") => Promise<void>;
  onNavigate: (view: string) => void;
}) {
  const [text, setText] = useState(""),
    [data, setData] = useState<{
      coverage: Match[];
      catalog: Material[];
      notice: string;
    } | null>(null),
    [reviews, setReviews] = useState<Review[] | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [analyzed, setAnalyzed] = useState("");
  const selectedMaterials =
    data?.catalog.filter((p) => selected.includes(p.id)) || [];
  async function open(id: string, mode: "read" | "practice") {
    try {
      await onStudy(id, mode);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <section className="exam-prep">
      <div className="exam-hero">
        <span className="eyebrow">UM OBJETIVO, UM CAMINHO</span>
        <h2>Prepare minha prova</h2>
        <p>
          Cole os tópicos, confira o que temos e transforme sua lista em um
          plano possível.
        </p>
      </div>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            const d = await callApi("exam-coverage", {
              syllabus: text,
              course: profile.course,
            });
            setData(d as typeof data);
            setAnalyzed(text);
            setSelected([]);
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="exam-syllabus">Conteúdo da prova ou ementa</label>
        <textarea
          id="exam-syllabus"
          rows={6}
          maxLength={6000}
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            "Um tema por linha. Exemplo:\nLesão celular\nInflamação\nReparação"
          }
        />
        <p className="muted">
          Até 20 temas; use linhas ou ponto e vírgula. Não inclua nomes, notas
          ou dados de terceiros. O texto é usado na consulta e não é salvo.
          Curso: {profile.course || "todos"} (ajuste em Preferências).
        </p>
        <button className="btn primary" disabled={busy}>
          {busy ? "Conferindo…" : "Conferir temas e materiais"}
        </button>
      </form>
      <p role="status" className="sofia-status">
        {message}
      </p>
      {data && (
        <>
          <p className="notice">{data.notice}</p>
          {text !== analyzed && (
            <p className="notice">
              Você alterou os temas. Confira novamente para atualizar os
              resultados e o plano.
            </p>
          )}
          <div className="studio-actions">
            <button
              className="btn primary"
              disabled={text !== analyzed}
              onClick={() =>
                onPlan({
                  ...profile,
                  topics: data.coverage.map((c) => c.topic).join("\n"),
                })
              }
            >
              Montar plano com estes temas
            </button>
            <button
              className="btn secondary"
              onClick={() => onNavigate("trilhas")}
            >
              Ver trilhas editoriais
            </button>
          </div>
          <div className="exam-topics">
            {data.coverage.map((c) => (
              <article className="panel" key={c.topic}>
                <span
                  className={
                    "status " +
                    (c.status === "absent" ? "status-pending" : "status-paid")
                  }
                >
                  {c.status === "absent"
                    ? "Sem correspondência"
                    : c.status === "partial"
                      ? "Correspondência parcial"
                      : "Termos encontrados"}
                </span>
                <h3>{c.topic}</h3>
                {!c.items.length && (
                  <>
                    <p>
                      Ainda não encontramos esse tema nos cadastros consultados.
                      O plano continua disponível sem compras.
                    </p>
                    <button
                      className="text-link"
                      onClick={() => onNavigate("mural")}
                    >
                      Solicitar um material
                    </button>
                  </>
                )}
                {[...c.items]
                  .sort((a, b) =>
                    personal
                      ? Number(ownedIds.includes(b.id)) -
                        Number(ownedIds.includes(a.id))
                      : 0,
                  )
                  .map((i) => {
                    const p = data.catalog.find((p) => p.id === i.id)!;
                    const owned = personal && ownedIds.includes(i.id);
                    return (
                      <div className="exam-material" key={i.id}>
                        <h4>{i.title}</h4>
                        <p>
                          {i.format} ·{" "}
                          {i.price === 0 ? "Gratuito" : money(i.price)}
                          {owned ? " · Na sua biblioteca" : ""}
                        </p>
                        <p className="muted">
                          Termos encontrados: {i.matched.join(", ")}.{" "}
                          {p.questions} questão(ões) e {p.cards} cartão(ões)
                          publicados.
                        </p>
                        <div className="studio-actions">
                          <button
                            className="btn secondary small"
                            onClick={() => onMaterial(i.id)}
                          >
                            Sumário e detalhes
                          </button>
                          <a
                            className="text-link"
                            href={"/amostras/" + encodeURIComponent(i.id)}
                          >
                            Ler amostra
                          </a>
                          {owned && (
                            <>
                              <button
                                className="btn secondary small"
                                onClick={() => open(i.id, "read")}
                              >
                                1. Ler
                              </button>
                              <button
                                className="btn secondary small"
                                disabled={!p.questions && !p.cards}
                                onClick={() => open(i.id, "practice")}
                              >
                                2. Praticar e revisar
                              </button>
                            </>
                          )}
                        </div>
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={selected.includes(i.id)}
                            disabled={
                              !selected.includes(i.id) && selected.length >= 3
                            }
                            onChange={(e) =>
                              setSelected((old) =>
                                e.target.checked
                                  ? [...old, i.id]
                                  : old.filter((x) => x !== i.id),
                              )
                            }
                          />
                          Comparar (até 3)
                        </label>
                      </div>
                    );
                  })}
              </article>
            ))}
          </div>
          {selectedMaterials.length > 0 && (
            <section className="panel">
              <h3>Escolha com mais informação</h3>
              <div className="exam-compare">
                {selectedMaterials.map((p) => (
                  <article key={p.id}>
                    <h4>{p.title}</h4>
                    <p>
                      {p.author} · {p.format} · {p.pages} página(s)
                    </p>
                    <p>{p.objectives || "Objetivos ainda não cadastrados."}</p>
                    <details>
                      <summary>Sumário e referências</summary>
                      <p className="pre-line">
                        {p.toc || "Sem sumário cadastrado."}
                      </p>
                      <p className="pre-line">
                        {p.sources || "Sem referências cadastradas."}
                      </p>
                    </details>
                    <p>
                      Revisão:{" "}
                      {p.reviewed_at
                        ? new Date(p.reviewed_at).toLocaleDateString("pt-BR")
                        : "data não informada"}
                    </p>
                    <p>
                      Últimas alterações: {p.revision_notes || "não informadas"}
                    </p>
                    <button
                      className="text-link"
                      onClick={() => onMaterial(p.id)}
                    >
                      Conferir público, pré-requisitos e amostras
                    </button>
                  </article>
                ))}
              </div>
              {selectedMaterials.flatMap((a, i) =>
                selectedMaterials.slice(i + 1).map((b) => {
                  const o = overlap(a, b);
                  return (
                    <p key={a.id + b.id}>
                      <strong>
                        {a.title} × {b.title}:
                      </strong>{" "}
                      {o.shared.length
                        ? "termos em comum: " + o.shared.join(", ")
                        : "sem termos específicos em comum"}
                      . {o.notice}
                    </p>
                  );
                }),
              )}
            </section>
          )}
        </>
      )}
      <section className="panel">
        <h3>Por onde começar? Um diagnóstico opcional</h3>
        <p>
          Nos materiais da sua biblioteca com questões publicadas, escolha
          “Praticar e revisar” e inicie um simulado curto. A correção mostra
          comentários e páginas quando cadastrados. Você pode pular essa etapa e
          montar o plano diretamente.
        </p>
        <button
          className="btn secondary"
          onClick={() => onNavigate("biblioteca")}
        >
          Abrir minha biblioteca
        </button>
      </section>
      <section className="panel">
        <h3>Revisar a partir dos meus erros</h3>
        <p>
          Com sua escolha, consultamos seus últimos simulados concluídos. Não
          usamos esses resultados para vender materiais.
        </p>
        <button
          className="btn secondary"
          disabled={!signedIn || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const d = await callApi("exam-reviews");
              setReviews(d.reviews as Review[]);
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Consultar sugestões de revisão
        </button>
        {!signedIn && <p>Entre na conta para consultar seu histórico.</p>}
        {reviews?.length === 0 && (
          <p>
            Ainda não há erros nos simulados concluídos consultados com acesso
            atual.
          </p>
        )}
        {reviews?.map((r, i) => (
          <article
            className="exam-material"
            key={r.product_id + r.topic + String(r.page) + i}
          >
            <strong>{r.topic}</strong>
            <p>
              {r.title} · {r.misses} resposta(s) a revisar
              {r.page ? " · confira a página " + r.page : ""}
            </p>
            <button
              className="text-link"
              onClick={() => open(r.product_id, "read")}
            >
              Abrir material para conferir a seção
            </button>
            <button
              className="text-link"
              onClick={() => onPlan({ ...profile, topics: r.topic })}
            >
              Planejar retomada deste tema
            </button>
          </article>
        ))}
      </section>
    </section>
  );
}
