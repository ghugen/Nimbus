"use client";
import { useState } from "react";
import { money } from "@/lib/catalog";
import type {
  FinanceReport,
  FinanceAccount,
  AuthorPolicy,
} from "@/lib/finance-types";
export function FinancePanel({
  report,
  accounts,
  onAction,
}: {
  report: FinanceReport;
  accounts?: FinanceAccount[];
  onAction?: (data: unknown) => Promise<void>;
}) {
  const [month, setMonth] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const entries = report.entries.filter((x) => {
    const date = new Date(x.created).toLocaleDateString("sv-SE", {
      timeZone: "America/Sao_Paulo",
    });
    return (
      (!month || date.startsWith(month)) &&
      (!from || date >= from) &&
      (!to || date <= to)
    );
  });
  const totals = entries.reduce(
    (s, x) => ({
      gross: s.gross + x.gross,
      fee: s.fee + x.fee,
      platform:
        s.platform + x.platform - (x.refunded_gross - x.refunded_author),
      author: s.author + x.author_net - x.refunded_author,
      refund: s.refund + x.refunded_gross,
    }),
    { gross: 0, fee: 0, platform: 0, author: 0, refund: 0 },
  );
  async function submit(data: unknown) {
    if (!onAction) return;
    setBusy(true);
    setError("");
    try {
      await onAction(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const names = new Map(accounts?.map((a) => [a.id, a.name]) || []);
  return (
    <section className="finance-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">TRANSPARÊNCIA EM CADA VENDA</span>
          <h2>Financeiro e repasses</h2>
        </div>
        <label>
          Mês do demonstrativo
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>
      <div className="metrics-dates">
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
        <button
          className="btn secondary small"
          onClick={() => {
            setMonth("");
            setFrom("");
            setTo("");
          }}
        >
          Limpar filtros
        </button>
      </div>
      <div className="finance-summary">
        {[
          ["Vendas conciliadas", totals.gross],
          ["Processamento", totals.fee],
          ["Reembolsos", totals.refund],
          ["Nimbus após estornos", totals.platform],
          ["Autores após estornos", totals.author],
        ].map(([label, value]) => (
          <div className="panel" key={label}>
            <small>{label}</small>
            <strong>{money(Number(value))}</strong>
          </div>
        ))}
      </div>
      <p className="muted">
        Valores no período da venda; incluem ajustes conhecidos hoje. Pedidos
        sem conciliação ficam na lista de pendências. Não inclui impostos e
        outras despesas da operação.
      </p>
      <p className="notice">
        Comissão padrão: 25% sobre o valor após processamento. Taxas reais são
        conciliadas com o provedor. Repasses mensais contemplam meses
        anteriores, disponibilidade do pagamento e reserva operacional de 14
        dias. Os saldos abaixo são acumulados; o filtro de mês afeta somente o
        demonstrativo de vendas.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="stats">
        <div className="stat">
          <strong>
            {money(report.balances.reduce((s, x) => s + x.balance, 0))}
          </strong>
          <small>Saldo dos autores, após estornos e repasses</small>
        </div>
        <div className="stat">
          <strong>
            {money(report.balances.reduce((s, x) => s + x.payable, 0))}
          </strong>
          <small>Liberado para registro de repasse</small>
        </div>
        <div className="stat">
          <strong>{report.pending.length}</strong>
          <small>Itens aguardando conciliação financeira</small>
        </div>
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data / Material</th>
              {accounts && <th>Autor</th>}
              <th>Venda</th>
              <th>Processamento</th>
              <th>Comissão Nimbus</th>
              <th>Parcela autor</th>
              <th>Estornos autor</th>
              <th>Ajustes Nimbus</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((x) => (
              <tr key={x.id}>
                <td>
                  <strong>{x.title}</strong>
                  <small>
                    {new Date(x.created).toLocaleDateString("pt-BR")} · pedido{" "}
                    {x.order_id.slice(0, 8)}
                  </small>
                </td>
                {accounts && (
                  <td>{names.get(x.author_id) || "Acervo Nimbus"}</td>
                )}
                <td>{money(x.gross)}</td>
                <td>{money(x.fee)}</td>
                <td>
                  {money(x.platform)}
                  <small>
                    {x.rate === 0 && x.author_net === 0 && x.gross > 0
                      ? "Acervo próprio · líquido integral"
                      : `${x.rate / 100}% · sobre o líquido`}
                  </small>
                </td>
                <td>{money(x.author_net)}</td>
                <td>{money(x.refunded_author)}</td>
                <td>{money(x.refunded_gross - x.refunded_author)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!entries.length && (
          <p className="muted">Sem vendas conciliadas neste período.</p>
        )}
      </div>
      {report.pending.length > 0 && (
        <div className="panel table-wrap">
          <h3>Conciliações pendentes</h3>
          <p className="muted">
            Pedidos antigos sem regra registrada não são recalculados
            retroativamente. A ausência da taxa real impede a liberação do
            saldo.
          </p>
          {report.pending.map((p) => (
            <div className="order-line" key={p.id}>
              <span>
                {p.title} · {money(p.price)}
              </span>
              {onAction && (
                <button
                  className="btn secondary small"
                  disabled={busy}
                  onClick={() =>
                    submit({ action: "reconcile", id: p.order_id })
                  }
                >
                  Consultar provedor
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="panel table-wrap">
        <h3>Repasses registrados</h3>
        <p className="muted">
          Registros de transferências realizadas externamente. A Nimbus não
          movimenta dinheiro por este painel.
        </p>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              {accounts && <th>Autor</th>}
              <th>Valor</th>
              <th>Referência</th>
            </tr>
          </thead>
          <tbody>
            {report.payouts.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.created).toLocaleDateString("pt-BR")}</td>
                {accounts && <td>{names.get(p.author_id) || p.author_id}</td>}
                <td>{money(p.amount)}</td>
                <td>{p.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!report.payouts.length && (
          <p className="muted">Nenhum repasse registrado.</p>
        )}
      </div>
      {accounts && onAction && (
        <>
          <h3>Condições por autor</h3>
          <p className="muted">
            Alterar a regra retira materiais incompatíveis de publicação até que
            o autor confirme as novas condições. As vendas anteriores mantêm sua
            regra original.
          </p>
          <div className="author-grid">
            {accounts.map((a) => (
              <PolicyForm
                key={a.id + ":" + a.commission_bps + ":" + a.owned}
                account={a}
                disabled={busy}
                onSave={submit}
              />
            ))}
          </div>
          <form
            className="panel form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              submit({
                action: "payout",
                id: f.get("id"),
                amount: Math.round(Number(f.get("amount")) * 100),
                reference: f.get("reference"),
              });
            }}
          >
            <h3>Registrar transferência já realizada</h3>
            <label>
              Autor
              <select name="id" required>
                <option value="">Selecione</option>
                {accounts
                  .filter((a) => !a.owned)
                  .map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name} · liberado{" "}
                      {money(
                        report.balances.find((b) => b.author_id === a.id)
                          ?.payable || 0,
                      )}
                    </option>
                  ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Valor transferido (R$)
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>
              <label>
                Referência única da transferência
                <input
                  name="reference"
                  minLength={5}
                  maxLength={180}
                  required
                  placeholder="Identificador do comprovante, sem dados bancários"
                />
              </label>
            </div>
            <label className="check-label">
              <input type="checkbox" required />
              <span>
                Confirmo que esta transferência já foi feita fora da Nimbus.
                Este formulário apenas registra o repasse.
              </span>
            </label>
            <button className="btn primary" disabled={busy}>
              Registrar repasse realizado
            </button>
          </form>
        </>
      )}
    </section>
  );
}
function PolicyForm({
  account: a,
  disabled,
  onSave,
}: {
  account: FinanceAccount;
  disabled: boolean;
  onSave: (v: unknown) => void;
}) {
  const [owned, setOwned] = useState(!!a.owned);
  return (
    <form
      className="panel form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({
          action: "policy",
          id: a.id,
          commission_bps: Math.round(Number(f.get("rate")) * 100),
          owned,
        });
      }}
    >
      <strong>{a.name}</strong>
      <small>{a.email}</small>
      <label>
        Comissão Nimbus (%)
        <input
          name="rate"
          type="number"
          min="0"
          max="100"
          step="0.01"
          defaultValue={a.commission_bps / 100}
          required
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={owned}
          onChange={(e) => setOwned(e.target.checked)}
        />
        <span>Acervo próprio: todo o líquido pertence à Nimbus.</span>
      </label>
      <button className="btn secondary" disabled={disabled}>
        Salvar regra para novas vendas
      </button>
    </form>
  );
}
export function EarningsPreview({
  price,
  policy,
}: {
  price: number;
  policy: AuthorPolicy;
}) {
  const [fee, setFee] = useState("0");
  const cost = Math.min(
      price,
      Math.max(0, Math.round((Number(fee) || 0) * 100)),
    ),
    net = price - cost,
    commission = policy.owned
      ? net
      : Math.round((net * policy.commission_bps) / 10000);
  return (
    <div className="notice earnings-preview">
      <strong>
        {policy.owned
          ? "Material do acervo próprio"
          : `Autor parceiro · comissão Nimbus de ${policy.commission_bps / 100}%`}
      </strong>
      <label>
        Custo de processamento para simular (R$)
        <input
          type="number"
          min="0"
          step="0.01"
          max={price / 100}
          value={fee}
          onChange={(e) => setFee(e.target.value)}
        />
      </label>
      <div>
        Preço: {money(price)} · Custo simulado: {money(cost)}
      </div>
      <div>
        Nimbus: <strong>{money(commission)}</strong> · Você, como autor
        parceiro: <strong>{money(policy.owned ? 0 : net - commission)}</strong>
      </div>
      {policy.owned && (
        <div>O líquido de {money(net)} pertence à sua operação Nimbus.</div>
      )}
      <small>
        Simulação, não uma tarifa oferecida pelo provedor. O custo real será
        apurado após a venda. Não inclui impostos, descontos ou serviços
        editoriais adicionais.
      </small>
    </div>
  );
}
