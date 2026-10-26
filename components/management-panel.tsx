"use client";
import { useState } from "react";
import { callApi } from "./commerce-panels";
import { downloadPrivate } from "@/lib/client-auth";
import { money } from "@/lib/catalog";
type Row = {
  label: string;
  sales: number;
  gross: number;
  fees: number;
  refunds: number;
  nimbus: number;
  authors: number;
};
type Report = {
  products: Row[];
  inventory: Row[];
  months: Row[];
  campaigns: {
    code: string;
    orders: number;
    discount: number;
    revenue: number;
  }[];
  alerts: { kind: string; count: number }[];
};
export function ManagementPanel() {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [data, setData] = useState<Report | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setMessage("");
    try {
      setData(
        (await callApi(
          "management-report?" +
            new URLSearchParams({
              ...(from ? { from } : {}),
              ...(to ? { to } : {}),
            }),
        )) as Report,
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <span className="eyebrow">RESULTADOS DA OPERAÇÃO</span>
      <h2>Relatórios e recuperação</h2>
      <form
        className="metrics-dates"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label>
          De
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button className="btn primary" disabled={busy}>
          Consultar período
        </button>
      </form>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {data && (
        <>
          <p className="notice">
            Valores conciliados dos pedidos criados no período, com os estornos
            registrados até agora. Um pedido pode ter vários itens. O resultado
            por campanha atribui compras ao cupom; não estima lucro nem
            causalidade.
          </p>
          {(
            [
              ["Por material", data.products],
              ["Acervo próprio e parceiros", data.inventory],
              ["Evolução mensal", data.months],
            ] as [string, Row[]][]
          ).map(([label, items]) => (
            <div key={label}>
              <h3>{label}</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Grupo</th>
                      <th>Itens</th>
                      <th>Bruto</th>
                      <th>Estornos</th>
                      <th>Taxas</th>
                      <th>Nimbus líquido</th>
                      <th>Autores líquido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((x) => (
                      <tr key={x.label}>
                        <th>{x.label}</th>
                        <td>{x.sales}</td>
                        <td>{money(x.gross)}</td>
                        <td>{money(x.refunds)}</td>
                        <td>{money(x.fees)}</td>
                        <td>{money(x.nimbus)}</td>
                        <td>{money(x.authors)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!items.length && <p>Sem dados conciliados neste período.</p>}
            </div>
          ))}
          <h3>Campanhas com cupom</h3>
          {data.campaigns.map((c) => (
            <p key={c.code}>
              <strong>{c.code}</strong>: {c.orders} pedidos · {money(c.revenue)}{" "}
              pagos · {money(c.discount)} em descontos.
            </p>
          ))}
          <h3>Pendências atuais</h3>
          {data.alerts.map((a) => (
            <p key={a.kind}>
              {
                (
                  {
                    finance: "Conciliação bloqueada",
                    email: "E-mails pendentes ou falhos",
                    refund: "Reembolso com pendência",
                    operation: "Falhas operacionais abertas",
                  } as Record<string, string>
                )[a.kind]
              }
              : <strong>{a.count}</strong>
            </p>
          ))}
        </>
      )}
      <details className="panel">
        <summary>Exportar dados para recuperação</summary>
        <p>
          O arquivo contém dados pessoais e um manifesto de objetos. Guarde-o em
          local protegido. Os arquivos enviados precisam de uma cópia separada
          do armazenamento R2. A restauração deve ser ensaiada em um banco
          isolado com o script do repositório; esta tela não altera o banco.
        </p>
        <button
          className="btn secondary"
          onClick={async () => {
            try {
              await downloadPrivate("/api/backup-export");
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          Baixar dados e manifesto
        </button>
      </details>
    </section>
  );
}
