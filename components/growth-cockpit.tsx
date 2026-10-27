"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
import { acquisition, editorialTemplate } from "@/lib/exam-core";
type Cockpit = {
  coverage: {
    course: string;
    subject: string;
    total: number;
    status: string;
  }[];
  quality: { id: string; title: string; missing: string[] }[];
  overdue: { product_id: string; title: string; next_review: string }[];
  events: { kind: string; total: number }[];
  payments: { status: string; total: number }[];
  tickets: number;
  feedback: { reason: string; total: number }[];
  notice: string;
};
function download(name: string, text: string) {
  const u = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export function GrowthCockpit() {
  const [data, setData] = useState<Cockpit | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ticket, setTicket] = useState("39.90"),
    [cost, setCost] = useState("14.90"),
    [profit, setProfit] = useState("10"),
    [conversion, setConversion] = useState("2");
  async function load() {
    setBusy(true);
    try {
      setData((await callApi("growth-cockpit")) as Cockpit);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let alive = true;
    callApi("growth-cockpit")
      .then((d) => {
        if (alive) setData(d as Cockpit);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  let result: ReturnType<typeof acquisition> | null = null;
  let calcError = "";
  try {
    result = acquisition(
      Number(ticket),
      Number(cost),
      Number(profit),
      Number(conversion),
    );
  } catch (e) {
    calcError = (e as Error).message;
  }
  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <section className="growth-cockpit">
      <span className="eyebrow">DA DESCOBERTA AO ESTUDO</span>
      <h2>Mercado, acervo e operação</h2>
      <p>
        Priorize ofertas que já conseguem atender bem o estudante. Os
        indicadores abaixo vêm da Nimbus; a calculadora é um cenário manual.
      </p>
      <button className="btn secondary" disabled={busy} onClick={load}>
        Atualizar indicadores
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {data && (
        <>
          <p className="notice">{data.notice}</p>
          <div className="exam-metrics">
            <a className="panel" href="#admin/atendimento">
              <strong>{data.tickets}</strong>
              <span>Chamados não encerrados</span>
            </a>
            <a className="panel" href="#admin/revisoes">
              <strong>
                {data.overdue.length}
                {data.overdue.length === 50 ? "+" : ""}
              </strong>
              <span>Revisões vencidas (até 50)</span>
            </a>
            <a className="panel" href="#admin/alertas">
              <strong>{data.events.reduce((n, x) => n + x.total, 0)}</strong>
              <span>Eventos operacionais abertos</span>
            </a>
            <a className="panel" href="#admin/pedidos">
              <strong>{data.payments.reduce((n, x) => n + x.total, 0)}</strong>
              <span>Pedidos pendentes ou com falha</span>
            </a>
          </div>
          <section className="panel">
            <h3>O que os estudantes pedem e ainda falta?</h3>
            <p>
              Correspondência por assunto nas solicitações do mural. Quantidade
              de pedidos não equivale a intenção de compra comprovada.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Curso</th>
                    <th>Assunto</th>
                    <th>Solicitações</th>
                    <th>Cadastro do acervo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.coverage.map((d, i) => (
                    <tr key={i}>
                      <td>{d.course}</td>
                      <td>{d.subject}</td>
                      <td>{d.total}</td>
                      <td>
                        {d.status === "absent"
                          ? "Sem correspondência"
                          : d.status === "partial"
                            ? "Parcial"
                            : "Termos encontrados"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.coverage.length && (
              <p>Ainda não há solicitações nos estados consultados.</p>
            )}
            <a className="text-link" href="#admin/mural">
              Abrir solicitações e respostas
            </a>
          </section>
          <section className="panel">
            <h3>Consistência editorial</h3>
            <p>
              Checklist de preenchimento do catálogo real publicado. Não
              substitui revisão humana.
            </p>
            {data.quality
              .filter((p) => p.missing.length)
              .map((p) => (
                <p key={p.id}>
                  <strong>{p.title}:</strong> {p.missing.join(", ")}
                </p>
              ))}
            {data.quality.every((p) => !p.missing.length) && (
              <p>Os campos conferidos estão preenchidos.</p>
            )}
            <button
              className="btn secondary"
              onClick={() =>
                download("nimbus-modelo-editorial.md", editorialTemplate)
              }
            >
              Baixar modelo editorial editável
            </button>
            <a className="text-link" href="#admin/produtos">
              Revisar materiais
            </a>
          </section>
          <section className="panel">
            <h3>Recomendações que precisam melhorar</h3>
            {data.feedback.map((f) => (
              <p key={f.reason}>
                {
                  (
                    {
                      off_topic: "Fora do tema",
                      too_advanced: "Avançado demais",
                      already_know: "Conteúdo já conhecido",
                    } as Record<string, string>
                  )[f.reason]
                }
                : {f.total}
              </p>
            ))}
            {!data.feedback.length && (
              <p>Nenhum motivo salvo pelos estudantes.</p>
            )}
            <a className="text-link" href="#admin/feedback">
              Ver feedback privado sobre a utilidade dos materiais
            </a>
          </section>
        </>
      )}
      <section className="panel">
        <h3>Até quanto uma venda pode custar?</h3>
        <p>
          Simulação, não previsão de anúncios. Nos materiais parceiros, informe
          em receita somente a parcela que fica para a Nimbus; inclua taxas,
          tributos, atendimento e reserva para estornos nos custos. Os valores
          iniciais são exemplos.
        </p>
        <div className="exam-calculator">
          {[
            ["Receita por pedido (R$)", ticket, setTicket],
            ["Custos variáveis por pedido (R$)", cost, setCost],
            ["Lucro desejado por pedido (R$)", profit, setProfit],
            [
              "Conversão estimada: clique → compra (%)",
              conversion,
              setConversion,
            ],
          ].map(([label, value, set], i) => (
            <label key={i}>
              {label as string}
              <input
                type="number"
                min={i === 3 ? "0.01" : "0"}
                max={i === 3 ? "100" : undefined}
                step="0.01"
                value={value as string}
                onChange={(e) => (set as (v: string) => void)(e.target.value)}
              />
            </label>
          ))}
        </div>
        {calcError && <p role="status">{calcError}</p>}
        {result && (
          <div className="notice">
            <p>
              Margem antes do anúncio:{" "}
              <strong>{brl(result.contribution)}</strong>
            </p>
            <p>
              Custo máximo por cliente adquirido para manter o lucro informado:{" "}
              <strong>{brl(result.maxCac)}</strong>
            </p>
            <p>
              Limite ilustrativo por clique com a conversão informada:{" "}
              <strong>{brl(result.maxCpc)}</strong>
            </p>
            <p>
              Retorno bruto sobre anúncios para cobrir somente os custos
              variáveis:{" "}
              <strong>
                {result.breakEvenRoas === null
                  ? "indefinido"
                  : result.breakEvenRoas.toFixed(2) + "×"}
              </strong>
            </p>
          </div>
        )}
        <p>
          Não considera custos fixos, vendas futuras ou atribuição entre canais.
          Use dados observados antes de aumentar o investimento.
        </p>
      </section>
      <section className="panel">
        <h3>Plano de aquisição e atendimento</h3>
        <ol>
          <li>
            <strong>Escolher um nicho:</strong> um curso e uma dor concreta; por
            exemplo, revisão de Patologia Veterinária.
          </li>
          <li>
            <strong>Preparar uma oferta:</strong> material real, preço, sumário,
            amostra, autoria, referências e limites claros.
          </li>
          <li>
            <strong>Validar a entrada:</strong> conferir acesso de um visitante
            novo e o fluxo no celular, sem mudar o compartilhamento da
            hospedagem automaticamente.
          </li>
          <li>
            <strong>Divulgar conteúdo útil:</strong> exemplos, perguntas e
            amostras em canais próprios e parcerias autorizadas.
          </li>
          <li>
            <strong>Testar anúncios:</strong> uma oferta, objetivo de compra ou
            contato qualificado, orçamento máximo definido e medição validada.
          </li>
          <li>
            <strong>Atender:</strong> orientação antes da compra e chamado
            vinculado ao pedido após a aquisição.
          </li>
          <li>
            <strong>Acompanhar:</strong> custo por cliente, margem após
            anúncios, compra confirmada, acesso ao arquivo e reembolsos.
          </li>
        </ol>
        <p>
          Nenhum anúncio, pixel, envio de marketing ou investimento é ativado
          por este painel. Não há atribuição externa de campanhas implementada
          aqui.
        </p>
        <div className="studio-actions">
          <a className="text-link" href="#admin/prontidao">
            Conferir prontidão
          </a>
          <a className="text-link" href="#admin/indicadores">
            Medição interna
          </a>
          <a className="text-link" href="#admin/conexoes">
            Conexões e configurações
          </a>
        </div>
      </section>
    </section>
  );
}
