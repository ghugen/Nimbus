"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
import { signedFetch } from "@/lib/client-auth";
import { money } from "@/lib/catalog";
export function PublicationPreview({
  data,
  cover,
}: {
  data: {
    title: string;
    description: string;
    course: string;
    subject: string;
    format: string;
    price: string;
    preview: string;
    objectives: string;
  };
  cover: File | null;
}) {
  const [image, setImage] = useState("");
  useEffect(() => {
    if (!cover) {
      setImage("");
      return;
    }
    const url = URL.createObjectURL(cover);
    setImage(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);
  return (
    <details className="panel publication-preview">
      <summary>Conferir a prévia da publicação</summary>
      <p className="notice">
        Prévia interna. Nenhuma compra ou publicação é feita nesta tela.
      </p>
      <div className="public-product-grid">
        {image ? (
          <img
            className="public-cover"
            src={image}
            alt="Capa selecionada para esta publicação"
          />
        ) : (
          <div className="public-cover fallback-cover">
            <strong>nimbus.</strong>
            <span>{data.format}</span>
            <strong>{data.title || "Título do material"}</strong>
            <small>{data.subject}</small>
          </div>
        )}
        <div>
          <span className="eyebrow">
            {data.course} · {data.format}
          </span>
          <h2>{data.title || "Título do material"}</h2>
          <p className="pre-line">{data.description}</p>
          <strong className="detail-price">
            {money(Math.round((Number(data.price) || 0) * 100))}
          </strong>
          <h3>Objetivos</h3>
          <p className="pre-line">
            {data.objectives || "Ainda não informados."}
          </p>
          <h3>Amostra</h3>
          <p className="pre-line">{data.preview || "Ainda não informada."}</p>
        </div>
      </div>
    </details>
  );
}
export function PublicationChecklist({
  id,
  checked,
  onChange,
}: {
  id?: string;
  checked: Record<string, boolean>;
  onChange: (c: Record<string, boolean>) => void;
}) {
  return (
    <fieldset className="publication-checklist">
      <legend>Checklist de qualidade</legend>
      {[
        [
          "original",
          "Tenho os direitos de comercialização dos textos e imagens.",
        ],
        ["objectives", "Objetivos e público estão claros."],
        ["references", "Conferi referências, citações e fontes."],
        ["examples", "Os exemplos e exercícios foram revisados."],
        ["file", "Abri o arquivo e conferi páginas e legibilidade."],
        ["preview", "A prévia representa o material completo."],
      ].map(([key, label]) => (
        <label key={key} className="check-label">
          <input
            type="checkbox"
            checked={!!checked[key]}
            onChange={(e) => onChange({ ...checked, [key]: e.target.checked })}
          />
          <span>{label}</span>
        </label>
      ))}
      <small>
        {id ? "Checklist do material " + id.slice(0, 8) + ". " : ""}As
        declarações do autor não substituem a análise editorial.
      </small>
    </fieldset>
  );
}
export function CoverTemplates({
  id,
  title,
  subject,
  onSaved,
}: {
  id: string;
  title: string;
  subject: string;
  onSaved: () => void;
}) {
  const [tone, setTone] = useState("#B9A3F5"),
    [message, setMessage] = useState("");
  async function create() {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 1200;
      const c = canvas.getContext("2d");
      if (!c) throw Error("Seu navegador não suporta o gerador.");
      c.fillStyle = tone;
      c.fillRect(0, 0, 900, 1200);
      c.strokeStyle = "#24212B";
      c.lineWidth = 8;
      c.strokeRect(45, 45, 810, 1110);
      c.fillStyle = "#24212B";
      c.font = "bold 40px sans-serif";
      c.fillText("nimbus.", 85, 125);
      c.font = "bold 64px sans-serif";
      let y = 370,
        line = "";
      for (const word of title.split(" ")) {
        const next = (line + " " + word).trim();
        if (c.measureText(next).width > 710) {
          c.fillText(line, 85, y);
          line = word;
          y += 83;
        } else line = next;
        if (y > 870) break;
      }
      c.fillText(line, 85, y);
      c.font = "24px sans-serif";
      c.fillText(subject.slice(0, 45), 85, 1050);
      c.font = "18px sans-serif";
      c.fillText("CONHECIMENTO QUE FICA", 85, 1095);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(Error("Falha ao gerar capa."))),
          "image/png",
        ),
      );
      const f = new FormData();
      f.set("id", id);
      f.set("kind", "cover");
      f.set("file", new File([blob], "capa-nimbus.png", { type: "image/png" }));
      const r = await signedFetch("/api/asset-upload", {
        method: "POST",
        body: f,
      });
      const result = (await r.json()) as { error?: string };
      if (!r.ok) throw Error(result.error || "Falha no envio.");
      setMessage(
        "Capa gerada e salva. O material voltou a rascunho para revisão.",
      );
      onSaved();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <details className="panel">
      <summary>Gerar capa com a identidade Nimbus</summary>
      <label>
        Paleta
        <select value={tone} onChange={(e) => setTone(e.target.value)}>
          <option value="#B9A3F5">Lavanda</option>
          <option value="#F4D76E">Amarelo</option>
          <option value="#BFD5BC">Sálvia</option>
          <option value="#EFA394">Coral</option>
        </select>
      </label>
      <p>
        A capa utiliza título e disciplina cadastrados. Confira o resultado
        antes de submeter novamente.
      </p>
      <button type="button" className="btn secondary small" onClick={create}>
        Gerar e salvar capa
      </button>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
export function PublicationChanges({ id }: { id: string }) {
  const [items, setItems] = useState<
      { id: string; snapshot: string; created: string }[]
    >([]),
    [left, setLeft] = useState(0),
    [right, setRight] = useState(1);
  useEffect(() => {
    let active = true;
    callApi("product-changes?id=" + encodeURIComponent(id))
      .then((d) => {
        if (active) setItems(d.changes as typeof items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);
  const parse = (i: number): Record<string, unknown> => {
      try {
        return JSON.parse(items[i]?.snapshot || "{}");
      } catch {
        return {};
      }
    },
    a = parse(left),
    b = parse(right);
  const labels: Record<string, string> = {
    title: "Título",
    description: "Descrição",
    price: "Preço em centavos",
    subject: "Disciplina",
    course: "Curso",
    topic: "Assunto",
    objectives: "Objetivos",
    toc: "Sumário",
    sources: "Referências",
    format: "Formato",
    pages: "Páginas",
    preview: "Amostra textual",
  };
  return (
    <details className="panel">
      <summary>
        Comparar versões anteriores do cadastro ({items.length})
      </summary>
      <p>
        As versões são registradas antes de salvar alterações do cadastro. As
        versões dos arquivos ficam no histórico da biblioteca.
      </p>
      {items.length > 0 && (
        <>
          <div className="form-row">
            {(
              [
                ["Primeira versão", left, setLeft],
                ["Segunda versão", right, setRight],
              ] as [string, number, (n: number) => void][]
            ).map(([label, index, set]) => (
              <label key={label}>
                {label}
                <select
                  value={index}
                  onChange={(e) => set(Number(e.target.value))}
                >
                  {items.map((x, i) => (
                    <option key={x.id} value={i}>
                      {new Date(x.created).toLocaleString("pt-BR")} · {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Campo alterado</th>
                  <th>Primeira versão</th>
                  <th>Segunda versão</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(labels)
                  .filter((k) => a[k] !== b[k])
                  .map((k) => (
                    <tr key={k}>
                      <th>{labels[k]}</th>
                      <td className="pre-line">{String(a[k] ?? "—")}</td>
                      <td className="pre-line">{String(b[k] ?? "—")}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!Object.keys(labels).some((k) => a[k] !== b[k]) && (
            <p>Nenhuma diferença entre os campos comparados.</p>
          )}
        </>
      )}
    </details>
  );
}

export function PublicationSchedule({ id }: { id: string }) {
  const [schedule, setSchedule] = useState<{
      release_at: string;
      approved: number;
    } | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    callApi("publication-schedule?id=" + encodeURIComponent(id))
      .then((d) => setSchedule(d.schedule as typeof schedule))
      .catch(() => {});
  }, [id]);
  return (
    <details className="panel">
      <summary>Programar lançamento após aprovação</summary>
      <p>
        A liberação ocorre na primeira consulta ao catálogo a partir da data
        escolhida. Avisos pontuais sem visitas exigem um serviço de agendamento
        configurado. Alterar a data exige nova aprovação.
      </p>
      {schedule && (
        <p>
          {new Date(schedule.release_at).toLocaleString("pt-BR")} ·{" "}
          {schedule.approved
            ? "Aprovado para agendamento"
            : "Aguardando revisão"}
        </p>
      )}
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const value = new FormData(e.currentTarget).get("release_at");
            await callApi("publication-schedule", {
              id,
              release_at: new Date(String(value)).toISOString(),
            });
            setMessage("Data salva. Submeta novamente para revisão.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        <label>
          Data e hora
          <input type="datetime-local" name="release_at" required />
        </label>
        <button className="btn secondary small">Salvar programação</button>
        <button
          type="button"
          className="text-link"
          onClick={async () => {
            try {
              await callApi("publication-schedule", { id, action: "remove" });
              setSchedule(null);
              setMessage("Programação removida.");
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          Remover programação
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </details>
  );
}

export function ReferenceBuilder({
  onInsert,
}: {
  onInsert: (text: string) => void;
}) {
  const [message, setMessage] = useState("");
  return (
    <details className="reference-builder">
      <summary>Montar uma referência com campos</summary>
      <p>
        Organize os dados conhecidos da fonte. Confira a norma exigida pela
        instituição e não complete informações que você não verificou.
      </p>
      <div className="form">
        <label>
          Autoria
          <input id="reference-author" maxLength={300} />
        </label>
        <label>
          Título
          <input id="reference-title" maxLength={500} />
        </label>
        <label>
          Fonte, periódico ou editora
          <input id="reference-source" maxLength={300} />
        </label>
        <label>
          Ano
          <input id="reference-year" maxLength={20} />
        </label>
        <label>
          DOI ou URL
          <input id="reference-link" maxLength={500} />
        </label>
        <button
          type="button"
          className="btn secondary small"
          onClick={(e) => {
            const form = e.currentTarget.closest(".reference-builder");
            if (!form) return;
            const value = (id: string) =>
              (
                form.querySelector("#reference-" + id) as HTMLInputElement
              )?.value.trim() || "";
            if (!value("title")) {
              setMessage("Informe ao menos o título da fonte.");
              return;
            }
            onInsert(
              [
                value("author"),
                value("title"),
                value("source"),
                value("year"),
                value("link"),
              ]
                .filter(Boolean)
                .join(". ") + ".",
            );
            setMessage("Referência adicionada ao campo de fontes.");
          }}
        >
          Adicionar à lista de referências
        </button>
        {message && <p role="status">{message}</p>}
      </div>
    </details>
  );
}
