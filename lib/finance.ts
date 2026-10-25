export const DEFAULT_COMMISSION_BPS = 2500;
export const POLICY_VERSION = "nimbus-net-25-v1";
export function splitNet(
  gross: number,
  fee: number,
  rate: number,
  owned = false,
) {
  if (
    ![gross, fee, rate].every(Number.isSafeInteger) ||
    gross < 0 ||
    fee < 0 ||
    fee > gross ||
    rate < 0 ||
    rate > 10000
  )
    throw new Error("Valores financeiros inválidos.");
  const net = gross - fee;
  const platform = owned ? net : Math.round((net * rate) / 10000);
  return { gross, fee, platform, author_net: owned ? 0 : net - platform };
}
export function allocate(total: number, weights: number[]) {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    weights.some((w) => !Number.isSafeInteger(w) || w < 0)
  )
    throw new Error("Rateio inválido.");
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!sum) {
    if (total) throw new Error("Rateio inválido.");
    return weights.map(() => 0);
  }
  const shares = weights.map((w) => Math.floor((total * w) / sum));
  const ranks = weights
    .map((w, i) => ({ i, remainder: (total * w) % sum }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (let n = total - shares.reduce((s, w) => s + w, 0), i = 0; i < n; i++)
    shares[ranks[i].i]++;
  return shares;
}
export type FinanceRuntime = {
  DB: D1Database;
  STRIPE_SECRET_KEY?: string;
  ADMIN_EMAILS?: string;
};
const now = () => new Date().toISOString();
async function rows<T = Record<string, unknown>>(
  env: FinanceRuntime,
  sql: string,
  ...args: unknown[]
) {
  return (
    await env.DB.prepare(sql)
      .bind(...args)
      .all<T>()
  ).results;
}
export async function policy(env: FinanceRuntime, id: string) {
  const p = (
    await rows<{ commission_bps: number; owned: number }>(
      env,
      "SELECT * FROM author_accounts WHERE id=?",
      id,
    )
  )[0];
  if (p) return p;
  const user = (
    await rows<{ email: string }>(env, "SELECT email FROM users WHERE id=?", id)
  )[0];
  const owned = (env.ADMIN_EMAILS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .includes(user?.email.toLowerCase() || "!")
    ? 1
    : 0;
  return { commission_bps: DEFAULT_COMMISSION_BPS, owned };
}
export async function reconcile(env: FinanceRuntime, id: string) {
  const order = (
    await rows<{
      id: string;
      status: string;
      total: number;
      payment_intent: string;
      created: string;
    }>(env, "SELECT * FROM orders WHERE id=?", id)
  )[0];
  if (!order || !["paid", "refunded"].includes(order.status))
    throw new Error("Pedido sem pagamento confirmado.");
  const items = await rows<{
    id: string;
    author_id: string | null;
    price: number;
    commission_bps: number | null;
    owned: number | null;
  }>(env, "SELECT * FROM order_items WHERE order_id=? ORDER BY id", id);
  if (
    items.some(
      (i) =>
        i.author_id === null || i.commission_bps === null || i.owned === null,
    )
  )
    throw new Error(
      "Pedido anterior à política de comissões: não pode ser calculado retroativamente.",
    );
  let fee = 0,
    refunded = 0,
    available = Math.floor(Date.now() / 1000),
    chargeId = "free";
  if (order.total) {
    if (!env.STRIPE_SECRET_KEY || !order.payment_intent)
      throw new Error("Aguardando dados financeiros do pagamento.");
    const res = await fetch(
      "https://api.stripe.com/v1/payment_intents/" +
        encodeURIComponent(order.payment_intent) +
        "?expand[]=latest_charge.balance_transaction",
      { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } },
    );
    if (!res.ok)
      throw new Error("Não foi possível consultar a taxa real no provedor.");
    const intent = (await res.json()) as {
      status: string;
      latest_charge?: {
        id: string;
        amount: number;
        amount_refunded: number;
        currency: string;
        disputed?: boolean;
        balance_transaction?: {
          id: string;
          fee: number;
          currency: string;
          amount: number;
          available_on: number;
        };
      };
    };
    const charge = intent.latest_charge,
      tx = charge?.balance_transaction;
    if (
      intent.status !== "succeeded" ||
      !charge ||
      charge.disputed ||
      charge.amount !== order.total ||
      charge.currency !== "brl" ||
      !tx ||
      tx.currency !== "brl" ||
      tx.amount !== order.total ||
      !Number.isSafeInteger(tx.fee) ||
      tx.fee < 0 ||
      tx.fee > order.total ||
      !Number.isSafeInteger(tx.available_on) ||
      !Number.isSafeInteger(charge.amount_refunded) ||
      charge.amount_refunded < 0 ||
      charge.amount_refunded > order.total ||
      (order.status === "refunded" && charge.amount_refunded !== order.total)
    )
      throw new Error(
        "Pagamento sem taxa conciliável, divergente ou em disputa.",
      );
    fee = tx.fee;
    refunded = charge.amount_refunded;
    available = tx.available_on;
    chargeId = charge.id;
  }
  // A janela de revisão operacional de 14 dias não limita direitos do comprador.
  const releaseAt = Math.max(
    available,
    Math.floor(new Date(order.created).getTime() / 1000) + 14 * 86400,
  );
  const fees = allocate(
      fee,
      items.map((i) => i.price),
    ),
    refunds = allocate(
      refunded,
      items.map((i) => i.price),
    );
  const existing = await rows<{ id: string; fee: number }>(
    env,
    "SELECT id,fee FROM settlements WHERE order_id=?",
    id,
  );
  if (
    existing.some((x) => x.fee !== fees[items.findIndex((i) => i.id === x.id)])
  )
    throw new Error(
      "Taxa alterada após conciliação: revisão operacional necessária.",
    );
  await env.DB.batch(
    items.flatMap((item, i) => {
      const split = splitNet(
        item.price,
        fees[i],
        item.commission_bps!,
        !!item.owned,
      );
      const refundAuthor = item.price
        ? Math.round((split.author_net * refunds[i]) / item.price)
        : 0;
      return [
        env.DB.prepare(
          "INSERT OR IGNORE INTO settlements(id,order_id,author_id,gross,fee,rate,platform,author_net,release_at,created) VALUES(?,?,?,?,?,?,?,?,?,?)",
        ).bind(
          item.id,
          id,
          item.author_id,
          item.price,
          fees[i],
          item.commission_bps,
          split.platform,
          split.author_net,
          releaseAt,
          order.created,
        ),
        env.DB.prepare(
          "UPDATE settlements SET refunded_gross=MAX(refunded_gross,?),refunded_author=MAX(refunded_author,?) WHERE id=?",
        ).bind(refunds[i], refundAuthor, item.id),
      ];
    }),
  );
  await env.DB.prepare(
    "INSERT OR IGNORE INTO finance_events(id,order_id,type,detail,created) VALUES(?,?,?,?,?)",
  )
    .bind(
      `${id}:${chargeId}:${refunded}`,
      id,
      "reconciled",
      JSON.stringify({ fee, refunded }),
      now(),
    )
    .run();
  await env.DB.prepare("DELETE FROM finance_events WHERE id=? AND type='hold'")
    .bind(id + ":hold")
    .run();
  return { fee, refunded };
}
export async function financialReport(env: FinanceRuntime, authorId?: string) {
  const entries = await rows(
    env,
    "SELECT s.*,i.title FROM settlements s JOIN order_items i ON i.id=s.id" +
      (authorId ? " WHERE s.author_id=?" : "") +
      " ORDER BY s.created DESC",
    ...(authorId ? [authorId] : []),
  );
  const payments = await rows(
    env,
    "SELECT * FROM payouts" +
      (authorId ? " WHERE author_id=?" : "") +
      " ORDER BY created DESC",
    ...(authorId ? [authorId] : []),
  );
  const pending = await rows(
    env,
    "SELECT i.id,i.title,i.price,i.author_id,i.commission_bps,o.id order_id,o.created FROM order_items i JOIN orders o ON o.id=i.order_id LEFT JOIN settlements s ON s.id=i.id WHERE o.status IN ('paid','refunded') AND s.id IS NULL" +
      (authorId ? " AND i.author_id=?" : ""),
    ...(authorId ? [authorId] : []),
  );
  const ids = [
    ...new Set(
      [...entries, ...payments, ...pending].map((x) => String(x.author_id)),
    ),
  ];
  const holds = await rows(
    env,
    "SELECT * FROM finance_events WHERE type='hold'",
  );
  const balances = ids.map((id) => {
    const mine = entries.filter((x) => x.author_id === id);
    const paid = payments
      .filter((x) => x.author_id === id)
      .reduce((s, x) => s + Number(x.amount), 0);
    const refunded = mine.reduce((s, x) => s + Number(x.refunded_author), 0);
    const earned = mine.reduce((s, x) => s + Number(x.author_net), 0);
    const available =
      mine
        .filter(
          (x) =>
            Number(x.release_at) <= Date.now() / 1000 &&
            String(x.created) < monthBoundary(),
        )
        .reduce((s, x) => s + Number(x.author_net), 0) -
      refunded -
      paid;
    const blocked =
      pending.some((x) => x.author_id === id) ||
      mine.some((x) => holds.some((h) => h.order_id === x.order_id));
    return {
      author_id: id,
      earned,
      refunded,
      paid,
      balance: earned - refunded - paid,
      available,
      payable: blocked ? 0 : Math.max(0, available),
      blocked,
    };
  });
  return { entries, payouts: payments, pending, balances };
}
// É um registro contábil de transferência já feita, nunca uma ordem bancária.
export async function recordPayout(
  env: FinanceRuntime,
  authorId: string,
  amount: number,
  reference: string,
  actor: string,
) {
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    reference.trim().length < 5 ||
    reference.length > 180
  )
    throw new Error("Dados de repasse inválidos.");
  if (
    (
      await rows(
        env,
        "SELECT id FROM payouts WHERE reference=?",
        reference.trim(),
      )
    ).length
  )
    throw new Error("Referência de repasse já registrada.");
  const monthStart = monthBoundary();
  const cutoff = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO payouts(id,author_id,amount,reference,actor,created) SELECT ?,?,?,?,?,? WHERE ? <= (SELECT COALESCE(SUM(CASE WHEN release_at<=? AND created<? THEN author_net ELSE 0 END - refunded_author),0) FROM settlements WHERE author_id=?) - (SELECT COALESCE(SUM(amount),0) FROM payouts WHERE author_id=?) AND NOT EXISTS(SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id LEFT JOIN settlements s ON s.id=i.id WHERE i.author_id=? AND o.status IN ('paid','refunded') AND s.id IS NULL) AND NOT EXISTS(SELECT 1 FROM finance_events WHERE type='hold' AND order_id IN(SELECT order_id FROM order_items WHERE author_id=?))`,
  )
    .bind(
      id,
      authorId,
      amount,
      reference.trim(),
      actor,
      now(),
      amount,
      cutoff,
      monthStart,
      authorId,
      authorId,
      authorId,
      authorId,
    )
    .run();
  const saved = (await rows(env, "SELECT id FROM payouts WHERE id=?", id))[0];
  if (!saved)
    throw new Error(
      "Saldo não liberado, conciliação pendente ou valor acima do disponível.",
    );
  return id;
}

export function monthBoundary() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-01T03:00:00.000Z`;
}
