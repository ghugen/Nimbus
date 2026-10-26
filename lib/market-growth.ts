import {
  body,
  clean,
  fail,
  json,
  now,
  rows,
  run,
  rate,
  audit,
  type FeatureRuntime,
  type FeatureUser,
} from "./feature-db";
import { publicProducts } from "./catalog-services";
import { notify, deliver } from "./notifications";
export const PARTNER_TERMS = "nimbus-indicacoes-v1";
export type PartnerSettings = {
  enabled: boolean;
  discount_percent: number;
  student_reward: number;
  min_total: number;
  affiliate_rate: number;
};
export const defaultPartnerSettings: PartnerSettings = {
  enabled: false,
  discount_percent: 10,
  student_reward: 500,
  min_total: 2000,
  affiliate_rate: 1000,
};
export async function partnerSettings(
  e: FeatureRuntime,
): Promise<PartnerSettings> {
  const r = (
    await rows(e, "SELECT value FROM growth_settings WHERE id='partners'")
  )[0];
  return r
    ? { ...defaultPartnerSettings, ...JSON.parse(String(r.value)) }
    : defaultPartnerSettings;
}
export async function prepareReferral(
  e: FeatureRuntime,
  u: FeatureUser,
  code: string,
  items: { id: string; price: number; owned: number }[],
) {
  const settings = await partnerSettings(e);
  if (!settings.enabled)
    fail("O programa de indicação ainda não foi ativado.", 409);
  const account = (
    await rows(
      e,
      "SELECT p.*,u.email FROM partner_accounts p JOIN users u ON u.id=p.user_id WHERE p.code=? AND p.status='approved'",
      code.toUpperCase(),
    )
  )[0];
  if (!account) fail("Indicação inválida ou indisponível.");
  if (
    account.user_id === u.id ||
    String(account.email).toLowerCase() === u.email.toLowerCase()
  )
    fail("Não é permitido utilizar sua própria indicação.");
  if (
    (
      await rows(
        e,
        "SELECT id FROM orders WHERE user_id=? AND status IN ('paid','refunded') AND total>0",
        u.id,
      )
    ).length
  )
    fail("A indicação é válida somente para a primeira compra paga.");
  await run(
    e,
    "DELETE FROM referral_sales WHERE buyer_id=? AND order_id IN (SELECT id FROM orders WHERE status IN ('failed','expired'))",
    u.id,
  );
  if (
    (
      await rows(
        e,
        "SELECT order_id FROM referral_sales WHERE buyer_id=?",
        u.id,
      )
    ).length
  )
    fail(
      "Já existe uma compra vinculada a uma indicação. Confira seus pedidos.",
      409,
    );
  const eligible = items.filter((x) => x.owned === 1 && x.price > 0),
    gross = eligible.reduce((s, x) => s + x.price, 0);
  const amounts = new Map(items.map((x) => [x.id, x.price]));
  let discount = 0;
  for (const x of eligible) {
    const d = Math.floor((x.price * settings.discount_percent) / 100);
    discount += d;
    amounts.set(x.id, x.price - d);
  }
  if (!eligible.length || gross - discount < settings.min_total)
    fail(
      "A indicação exige pelo menos R$ " +
        (settings.min_total / 100).toFixed(2) +
        " pagos em materiais do acervo próprio, após o desconto.",
    );
  return {
    account,
    settings,
    amounts,
    discount,
    total: items.reduce((s, x) => s + Number(amounts.get(x.id)), 0),
  };
}
export function referralStatement(
  e: FeatureRuntime,
  u: FeatureUser,
  orderId: string,
  r: Awaited<ReturnType<typeof prepareReferral>>,
) {
  return e.DB.prepare(
    "INSERT INTO referral_sales(order_id,referrer_id,buyer_id,code,kind,rate_bps,reward_cents,min_total,discount,created) VALUES(?,?,?,?,?,?,?,?,?,?)",
  ).bind(
    orderId,
    r.account.user_id,
    u.id,
    r.account.code,
    r.account.kind,
    r.account.kind === "affiliate" ? Number(r.account.rate_bps) : 0,
    r.account.kind === "student" ? r.settings.student_reward : 0,
    r.settings.min_total,
    r.discount,
    now(),
  );
}
export async function partnerLedger(e: FeatureRuntime, userId?: string) {
  const sales = await rows(
    e,
    `SELECT r.*,o.status,o.total FROM referral_sales r JOIN orders o ON o.id=r.order_id ${userId ? "WHERE r.referrer_id=?" : ""} ORDER BY r.created DESC`,
    ...(userId ? [userId] : []),
  );
  const result: {
    order_id: string;
    user_id: string;
    kind: string;
    created: string;
    amount: number;
    available: boolean;
    order_status: string;
    discount: number;
    reward: { code: unknown; status: unknown } | null;
  }[] = [];
  for (const s of sales) {
    const items = await rows(
        e,
        "SELECT i.id,i.price,st.gross,st.fee,st.refunded_gross,st.release_at FROM order_items i LEFT JOIN settlements st ON st.id=i.id WHERE i.order_id=? AND i.owned=1 AND i.price>0",
        s.order_id,
      ),
      holds = await rows(
        e,
        "SELECT id FROM finance_events WHERE order_id=? AND type='hold'",
        s.order_id,
      );
    const reconciled =
        items.length > 0 &&
        items.every((i) => i.gross !== null && i.gross !== undefined),
      net = items.reduce(
        (n, i) =>
          n +
          Number(i.gross || 0) -
          Number(i.fee || 0) -
          Number(i.refunded_gross || 0),
        0,
      ),
      refund = items.reduce((n, i) => n + Number(i.refunded_gross || 0), 0);
    const released =
      reconciled &&
      holds.length === 0 &&
      s.status === "paid" &&
      items.every((i) => String(i.release_at) <= now()) &&
      Date.parse(String(s.created)) + 14 * 86400000 <= Date.now();
    const amount =
      s.kind === "affiliate" && reconciled && s.status === "paid"
        ? Math.max(0, Math.floor((net * Number(s.rate_bps)) / 10000))
        : 0;
    await run(
      e,
      "INSERT INTO affiliate_credits(order_id,user_id,amount,available,updated) VALUES(?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET amount=excluded.amount,available=excluded.available,updated=excluded.updated",
      s.order_id,
      s.referrer_id,
      amount,
      released ? 1 : 0,
      now(),
    );
    let reward = (
      await rows(
        e,
        "SELECT * FROM referral_rewards WHERE order_id=?",
        s.order_id,
      )
    )[0];
    if (
      s.kind === "student" &&
      Number(s.reward_cents) > 0 &&
      released &&
      refund === 0 &&
      !reward
    ) {
      const code =
        "NIM" +
        String(s.order_id)
          .replace(/[^a-z0-9]/gi, "")
          .slice(0, 24)
          .toUpperCase();
      await e.DB.batch([
        e.DB.prepare(
          "INSERT OR IGNORE INTO coupons(code,kind,value,min_total,max_uses,starts,ends,active,created) VALUES(?,'fixed',?,0,1,?,?,1,?)",
        ).bind(
          code,
          s.reward_cents,
          now(),
          new Date(Date.now() + 90 * 86400000).toISOString(),
          now(),
        ),
        e.DB.prepare(
          "INSERT OR IGNORE INTO coupon_restrictions(code,user_id) VALUES(?,?)",
        ).bind(code, s.referrer_id),
        e.DB.prepare(
          "INSERT OR IGNORE INTO referral_rewards(order_id,code,status,created) VALUES(?,?,'issued',?)",
        ).bind(s.order_id, code, now()),
      ]);
      reward = (
        await rows(
          e,
          "SELECT * FROM referral_rewards WHERE order_id=?",
          s.order_id,
        )
      )[0];
      const n = "reward:" + s.order_id;
      await notify(
        e,
        n,
        String(s.referrer_id),
        "Seu cupom de indicação foi liberado",
        "Confira seu cupom pessoal de desconto na área Indicações. Ele não tem valor de saque.",
        "/#parcerias",
      );
      await deliver(e, n);
    }
    if (reward && (s.status === "refunded" || refund > 0)) {
      const used =
        (
          await rows(
            e,
            "SELECT order_id FROM coupon_uses WHERE code=?",
            reward.code,
          )
        ).length > 0;
      await run(e, "UPDATE coupons SET active=0 WHERE code=?", reward.code);
      await run(
        e,
        "UPDATE referral_rewards SET status=? WHERE order_id=?",
        used ? "reversed_used" : "reversed",
        s.order_id,
      );
      reward = { ...reward, status: used ? "reversed_used" : "reversed" };
    }
    result.push({
      order_id: String(s.order_id),
      user_id: String(s.referrer_id),
      kind: String(s.kind),
      created: String(s.created),
      amount,
      available: released,
      order_status: String(s.status),
      discount: Number(s.discount),
      reward: reward ? { code: reward.code, status: reward.status } : null,
    });
  }
  const payouts = await rows(
    e,
    `SELECT id,user_id,amount,reference,created FROM affiliate_payouts ${userId ? "WHERE user_id=?" : ""} ORDER BY created DESC`,
    ...(userId ? [userId] : []),
  );
  const users = [
    ...new Set([
      ...result.map((x) => String(x.user_id)),
      ...payouts.map((x) => String(x.user_id)),
    ]),
  ];
  return {
    sales: result,
    payouts,
    balances: users.map((id) => {
      const mine = result.filter((x) => x.user_id === id),
        paid = payouts
          .filter((x) => x.user_id === id)
          .reduce((s, x) => s + Number(x.amount), 0);
      return {
        user_id: id,
        earned: mine.reduce((s, x) => s + x.amount, 0),
        available:
          mine.filter((x) => x.available).reduce((s, x) => s + x.amount, 0) -
          paid,
        paid,
      };
    }),
  };
}
export async function marketGrowth(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  if (path === "referral-info" && method === "GET") {
    const settings = await partnerSettings(e),
      a = (
        await rows(
          e,
          "SELECT code,kind FROM partner_accounts WHERE code=? AND status='approved'",
          clean(url.searchParams.get("code"), 40).toUpperCase(),
        )
      )[0];
    if (!settings.enabled || !a) fail("Indicação indisponível.", 404);
    return json({
      code: a.code,
      kind: a.kind,
      discount_percent: settings.discount_percent,
      min_total: settings.min_total,
      terms: PARTNER_TERMS,
    });
  }
  if (path === "demand-board" && method === "GET")
    return json({
      ideas: await rows(
        e,
        "SELECT d.id,d.title,d.course,d.subject,d.description,d.status,d.response,d.product_id,d.created,(SELECT COUNT(*) FROM demand_votes v WHERE v.idea_id=d.id) votes FROM demand_ideas d WHERE d.status!='pending' AND d.status!='hidden' ORDER BY votes DESC,d.created DESC LIMIT 100",
      ),
    });
  if (
    ![
      "demand-board",
      "demand-mine",
      "demand-admin",
      "partners",
      "partners-admin",
      "partner-settings",
      "referral-quote",
      "partner-payout",
    ].includes(path)
  )
    return null;
  const u = await auth(req);
  if (method !== "GET") await rate(e, u.id, path, 20);
  const b = method === "GET" ? null : await body(req);
  if (path === "demand-mine")
    return json({
      votes: await rows(
        e,
        "SELECT idea_id FROM demand_votes WHERE user_id=?",
        u.id,
      ),
      ideas: await rows(
        e,
        "SELECT id,title,status,response,created FROM demand_ideas WHERE user_id=? ORDER BY created DESC LIMIT 100",
        u.id,
      ),
    });
  if (path === "demand-board") {
    if (b!.action === "vote") {
      const id = clean(b!.id, 100);
      if (
        !(
          await rows(
            e,
            "SELECT id FROM demand_ideas WHERE id=? AND status NOT IN ('pending','hidden')",
            id,
          )
        ).length
      )
        fail("Sugestão não disponível.", 404);
      if (b!.active === false)
        await run(e, "DELETE FROM demand_votes WHERE id=?", u.id + ":" + id);
      else
        await run(
          e,
          "INSERT OR IGNORE INTO demand_votes(id,idea_id,user_id,created) VALUES(?,?,?,?)",
          u.id + ":" + id,
          id,
          u.id,
          now(),
        );
      return json({ ok: true });
    }
    if (
      clean(b!.title).length < 8 ||
      clean(b!.description).length < 20 ||
      clean(b!.course).length < 2 ||
      clean(b!.subject).length < 2
    )
      fail("Preencha título, curso, disciplina e descrição.");
    if (
      (
        await rows(
          e,
          "SELECT id FROM demand_ideas WHERE user_id=? AND created>=?",
          u.id,
          now().slice(0, 10),
        )
      ).length >= 5
    )
      fail("Limite de cinco sugestões por dia.", 429);
    await run(
      e,
      "INSERT INTO demand_ideas(id,user_id,title,course,subject,description,created,updated) VALUES(?,?,?,?,?,?,?,?)",
      crypto.randomUUID(),
      u.id,
      clean(b!.title, 150),
      clean(b!.course, 100),
      clean(b!.subject, 100),
      clean(b!.description, 3000),
      now(),
      now(),
    );
    return json({ ok: true });
  }
  if (path === "demand-admin") {
    if (!u.admin) fail("Acesso restrito.", 403);
    if (method === "GET")
      return json({
        ideas: await rows(
          e,
          "SELECT d.*,(SELECT COUNT(*) FROM demand_votes v WHERE v.idea_id=d.id) votes FROM demand_ideas d ORDER BY d.created DESC LIMIT 200",
        ),
      });
    if (
      !["open", "planned", "producing", "available", "hidden"].includes(
        String(b!.status),
      )
    )
      fail("Estado inválido.");
    const productId = clean(b!.product_id, 100);
    if (productId && !(await publicProducts(e)).some((p) => p.id === productId))
      fail("Vincule um material publicado.");
    await run(
      e,
      "UPDATE demand_ideas SET status=?,response=?,product_id=?,updated=? WHERE id=?",
      b!.status,
      clean(b!.response, 3000),
      productId || null,
      now(),
      clean(b!.id, 100),
    );
    await audit(e, u.id, "demand.moderated", clean(b!.id, 100));
    return json({ ok: true });
  }
  if (path === "partner-settings") {
    if (!u.admin) fail("Acesso restrito.", 403);
    if (method === "GET") return json({ settings: await partnerSettings(e) });
    const s = {
      enabled: b!.enabled === true,
      discount_percent: Number(b!.discount_percent),
      student_reward: Number(b!.student_reward),
      min_total: Number(b!.min_total),
      affiliate_rate: Number(b!.affiliate_rate),
    };
    if (
      ![
        s.discount_percent,
        s.student_reward,
        s.min_total,
        s.affiliate_rate,
      ].every(Number.isSafeInteger) ||
      s.discount_percent < 0 ||
      s.discount_percent > 30 ||
      s.student_reward < 0 ||
      s.student_reward > 5000 ||
      s.min_total < 1000 ||
      s.min_total > 100000 ||
      s.affiliate_rate < 0 ||
      s.affiliate_rate > 3000
    )
      fail(
        "Confira desconto (0–30%), recompensa (0–5000 centavos), mínimo e comissão (0–3000 pontos-base).",
      );
    await run(
      e,
      "INSERT INTO growth_settings(id,value,updated) VALUES('partners',?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated=excluded.updated",
      JSON.stringify(s),
      now(),
    );
    await audit(e, u.id, "partners.settings_changed", "partners");
    return json({ ok: true });
  }
  if (path === "partners") {
    if (method === "GET")
      return json({
        account:
          (
            await rows(
              e,
              "SELECT code,kind,status,rate_bps,terms,accepted FROM partner_accounts WHERE user_id=?",
              u.id,
            )
          )[0] || null,
        settings: await partnerSettings(e),
        ledger: await partnerLedger(e, u.id),
      });
    if (
      b!.accepted !== true ||
      !["student", "affiliate"].includes(String(b!.kind))
    )
      fail("Escolha o programa e aceite as condições.");
    if (
      (
        await rows(
          e,
          "SELECT user_id FROM partner_accounts WHERE user_id=?",
          u.id,
        )
      ).length
    )
      fail("Sua inscrição já existe. Solicite alterações à operação.", 409);
    const s = await partnerSettings(e),
      code = crypto.randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase();
    await e.DB.batch([
      e.DB.prepare(
        "INSERT INTO partner_accounts(user_id,code,kind,status,rate_bps,terms,accepted,updated) VALUES(?,?,?,?,?,?,?,?)",
      ).bind(
        u.id,
        code,
        b!.kind,
        b!.kind === "student" ? "approved" : "pending",
        b!.kind === "affiliate" ? s.affiliate_rate : 0,
        PARTNER_TERMS,
        now(),
        now(),
      ),
      e.DB.prepare(
        "INSERT INTO legal_acceptances(id,user_id,kind,version,details,created) VALUES(?,?,?,?,?,?)",
      ).bind(
        crypto.randomUUID(),
        u.id,
        "partner_program",
        PARTNER_TERMS,
        JSON.stringify({ kind: b!.kind, settings: s }),
        now(),
      ),
    ]);
    return json({ ok: true });
  }
  if (path === "partners-admin") {
    if (!u.admin) fail("Acesso restrito.", 403);
    if (method === "GET")
      return json({
        accounts: await rows(
          e,
          "SELECT p.*,u.name,u.email FROM partner_accounts p JOIN users u ON u.id=p.user_id ORDER BY p.accepted DESC",
        ),
        ledger: await partnerLedger(e),
      });
    if (!["approved", "paused", "rejected"].includes(String(b!.status)))
      fail("Estado inválido.");
    await run(
      e,
      "UPDATE partner_accounts SET status=?,updated=? WHERE user_id=?",
      b!.status,
      now(),
      clean(b!.user_id, 150),
    );
    await audit(e, u.id, "partner.status_changed", clean(b!.user_id, 150));
    return json({ ok: true });
  }
  if (path === "partner-payout") {
    if (!u.admin) fail("Acesso restrito.", 403);
    const id = clean(b!.user_id, 150),
      amount = Number(b!.amount),
      ref = clean(b!.reference, 150);
    if (!Number.isSafeInteger(amount) || amount <= 0 || ref.length < 6)
      fail(
        "Informe valor em centavos e comprovante de transferência já realizada.",
      );
    await partnerLedger(e, id);
    const payoutId = crypto.randomUUID();
    await run(
      e,
      "INSERT INTO affiliate_payouts(id,user_id,amount,reference,actor,created) SELECT ?,?,?,?,?,? WHERE ?<=(SELECT COALESCE(SUM(CASE WHEN available=1 THEN amount ELSE 0 END),0) FROM affiliate_credits WHERE user_id=?)-(SELECT COALESCE(SUM(amount),0) FROM affiliate_payouts WHERE user_id=?)",
      payoutId,
      id,
      amount,
      ref,
      u.id,
      now(),
      amount,
      id,
      id,
    );
    if (
      !(await rows(e, "SELECT id FROM affiliate_payouts WHERE id=?", payoutId))
        .length
    )
      fail("Saldo não liberado ou insuficiente.", 409);
    await audit(e, u.id, "partner.payout_recorded", id);
    return json({ ok: true });
  }
  if (path === "referral-quote") {
    if (b!.coupon)
      fail("Escolha cupom ou indicação; os descontos não se acumulam.");
    const ids = Array.isArray(b!.ids) ? (b!.ids as string[]) : [],
      seats = Number(b!.seats || 1),
      products = await publicProducts(e);
    if (
      !ids.length ||
      ids.length > 30 ||
      new Set(ids).size !== ids.length ||
      !Number.isSafeInteger(seats) ||
      seats < 1 ||
      seats > 100
    )
      fail("Carrinho inválido.");
    const items = ids.map((id) => {
        const p = products.find((p) => p.id === id && !p.demo);
        if (!p) fail("Material indisponível.");
        return { id: p.id, price: p.price * seats, owned: p.owned };
      }),
      r = await prepareReferral(e, u, clean(b!.code, 40), items);
    return json({
      discount: r.discount,
      total: r.total,
      code: r.account.code,
      items: items.map((i) => ({ id: i.id, price: r.amounts.get(i.id) })),
    });
  }
  return null;
}
