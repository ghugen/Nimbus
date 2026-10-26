import { STRIPE_API_VERSION, CHECKOUT_INTEGRATION } from "./stripe-config";
import { requirePayments } from "./payment-readiness";
import { assertSaleAvailable } from "./editorial-operations";
import { hasPackage } from "./learning-products";
import { publicProducts } from "./catalog-services";
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
const ref = (v: unknown) =>
  typeof v === "string"
    ? v
    : v && typeof v === "object"
      ? String((v as { id?: string }).id || "")
      : "";
export async function syncSubscriptionEvent(
  e: FeatureRuntime,
  event: { type: string; data?: { object?: Record<string, unknown> } },
) {
  const s = event.data?.object;
  if (!s) return;
  const isCheckout =
    event.type === "checkout.session.completed" && s.mode === "subscription";
  const isSub = event.type.startsWith("customer.subscription.");
  const isInvoice = ["invoice.paid", "invoice.payment_failed"].includes(
    event.type,
  );
  if (!isCheckout && !isSub && !isInvoice) return;
  const metadata = s.metadata as Record<string, string> | undefined;
  const parent = s.parent as
    { subscription_details?: { subscription?: unknown } } | undefined;
  const providerId = isCheckout
    ? ref(s.subscription)
    : isSub
      ? ref(s.id)
      : ref(s.subscription) || ref(parent?.subscription_details?.subscription);
  if (!providerId) return;
  const row = (
    await rows(
      e,
      "SELECT s.*,p.stripe_price_id FROM subscriptions s JOIN subscription_plans p ON p.id=s.plan_id WHERE s.provider_id=? OR s.id=?",
      providerId,
      metadata?.nimbus_subscription_id || "",
    )
  )[0];
  if (!row) return;
  if (isCheckout && row.session_id !== s.id) return;
  if (!e.STRIPE_SECRET_KEY)
    fail("Provedor indisponível para confirmar assinatura.", 503);
  const response = await fetch(
    "https://api.stripe.com/v1/subscriptions/" +
      encodeURIComponent(providerId) +
      "?expand[]=latest_invoice",
    { headers: { Authorization: "Bearer " + e.STRIPE_SECRET_KEY } },
  );
  if (!response.ok) fail("Não foi possível conferir a assinatura.", 502);
  const actual = (await response.json()) as {
    id: string;
    status: string;
    customer: unknown;
    current_period_end?: number;
    items: { data: { price: { id: string }; current_period_end?: number }[] };
    latest_invoice?: { paid?: boolean; status?: string } | string;
  };
  const item = actual.items?.data.find(
    (x) => x.price?.id === row.stripe_price_id,
  );
  if (actual.id !== providerId || !item)
    fail("Assinatura não corresponde ao plano cadastrado.", 409);
  const invoice = actual.latest_invoice,
    paid =
      typeof invoice === "object" &&
      !!(invoice.paid || invoice.status === "paid"),
    end = Number(item.current_period_end || actual.current_period_end || 0);
  const active = actual.status === "active" && paid && end * 1000 > Date.now();
  await run(
    e,
    "UPDATE subscriptions SET provider_id=?,customer_id=?,status=?,expires=? WHERE id=?",
    providerId,
    ref(actual.customer),
    active
      ? "active"
      : actual.status === "canceled"
        ? "canceled"
        : actual.status === "past_due"
          ? "past_due"
          : "pending",
    end ? new Date(end * 1000).toISOString() : "",
    row.id,
  );
}
export async function subscriptionRoutes(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  if (path === "subscription-plans" && method === "GET") {
    const plans = await rows(
        e,
        "SELECT id,title,description,amount,interval,product_ids FROM subscription_plans WHERE status='active'",
      ),
      products = await publicProducts(e);
    return json({
      plans: plans.map((p) => {
        const ids = JSON.parse(String(p.product_ids)) as string[];
        return {
          ...p,
          available:
            ids.length > 0 &&
            ids.every((id) => products.some((x) => x.id === id)),
          materials: ids.map((id) => ({
            id,
            title:
              products.find((x) => x.id === id)?.title ||
              "Material temporariamente indisponível",
          })),
        };
      }),
    });
  }
  if (
    ![
      "subscription-admin",
      "subscription-checkout",
      "my-subscriptions",
      "subscription-portal",
      "club-posts",
    ].includes(path)
  )
    return null;
  const u = await auth(req);
  if (method !== "GET") await rate(e, u.id, path, 20);
  const b = method === "GET" ? null : await body(req);
  if (path === "subscription-admin") {
    if (!u.admin) fail("Acesso restrito.", 403);
    if (method === "GET")
      return json({
        plans: await rows(
          e,
          "SELECT * FROM subscription_plans ORDER BY created DESC",
        ),
      });
    const id = clean(b!.id, 100) || crypto.randomUUID(),
      ids = b!.product_ids,
      status = String(b!.status),
      priceId = clean(b!.stripe_price_id, 100);
    if (
      clean(b!.title).length < 3 ||
      !Array.isArray(ids) ||
      ids.length > 100 ||
      ids.some((x) => typeof x !== "string") ||
      !["draft", "active", "archived"].includes(status)
    )
      fail("Plano inválido.");
    const old = (
      await rows(e, "SELECT * FROM subscription_plans WHERE id=?", id)
    )[0];
    if (
      old &&
      (
        await rows(
          e,
          "SELECT id FROM subscriptions WHERE plan_id=? AND status='active'",
          id,
        )
      ).length &&
      (JSON.stringify(ids) !== String(old.product_ids) ||
        priceId !== old.stripe_price_id)
    )
      fail(
        "Um plano com assinaturas ativas preserva o catálogo contratado. Crie outro plano para alterar a composição.",
        409,
      );
    const products = await publicProducts(e);
    if (
      ids.some(
        (id) => !products.some((p) => p.id === id && p.owned === 1 && !p.demo),
      )
    )
      fail("Planos aceitam apenas materiais publicados do acervo próprio.");
    let amount = Number(old?.amount || 0),
      interval = String(old?.interval || "month");
    if (status === "active") {
      requirePayments(e);
      if (e.STRIPE_SUBSCRIPTIONS_READY !== "1")
        fail(
          "Assinaturas aguardam homologação do ciclo de cobrança, cancelamento e eventos de risco.",
          503,
        );
      if (!e.STRIPE_SECRET_KEY)
        fail("Configure pagamentos antes de ativar um plano.", 503);
      if (!/^price_[A-Za-z0-9]+$/.test(priceId) || !ids.length)
        fail("Informe o preço recorrente e os materiais.");
      const response = await fetch(
        "https://api.stripe.com/v1/prices/" + encodeURIComponent(priceId),
        { headers: { Authorization: "Bearer " + e.STRIPE_SECRET_KEY } },
      );
      const price = (await response.json()) as {
        active: boolean;
        currency: string;
        unit_amount: number;
        recurring?: { interval: string };
      };
      if (
        !response.ok ||
        !price.active ||
        price.currency !== "brl" ||
        !price.recurring ||
        !Number.isSafeInteger(price.unit_amount) ||
        price.unit_amount <= 0
      )
        fail("Preço recorrente BRL não confirmado no provedor.");
      amount = price.unit_amount;
      interval = price.recurring.interval;
    }
    await run(
      e,
      "INSERT INTO subscription_plans(id,title,description,stripe_price_id,product_ids,status,amount,interval,created) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,stripe_price_id=excluded.stripe_price_id,product_ids=excluded.product_ids,status=excluded.status,amount=excluded.amount,interval=excluded.interval",
      id,
      clean(b!.title, 150),
      clean(b!.description, 5000),
      priceId,
      JSON.stringify(ids),
      status,
      amount,
      interval,
      now(),
    );
    await audit(e, u.id, "subscription.plan_saved", id);
    return json({ ok: true, id });
  }
  if (path === "my-subscriptions")
    return json({
      subscriptions: await rows(
        e,
        "SELECT s.id,s.plan_id,s.status,s.expires,p.title,p.amount,p.interval FROM subscriptions s JOIN subscription_plans p ON p.id=s.plan_id WHERE s.user_id=? ORDER BY s.created DESC",
        u.id,
      ),
    });
  if (path === "subscription-checkout" && method === "POST") {
    requirePayments(e);
    if (e.STRIPE_SUBSCRIPTIONS_READY !== "1")
      fail("Assinaturas aguardam homologação do ciclo completo.", 503);
    if (!e.STRIPE_SECRET_KEY)
      fail("Assinaturas ainda não foram ativadas.", 503);
    if (b!.accepted !== true) fail("Confirme as condições da assinatura.");
    const plan = (
      await rows(
        e,
        "SELECT * FROM subscription_plans WHERE id=? AND status='active'",
        clean(b!.plan_id, 100),
      )
    )[0];
    if (!plan) fail("Plano não disponível.", 404);
    if (
      (
        await rows(
          e,
          "SELECT id FROM subscriptions WHERE plan_id=? AND user_id=? AND status='active' AND expires>?",
          plan.id,
          u.id,
          now(),
        )
      ).length
    )
      fail("Você já possui este plano ativo.", 409);
    const ids = JSON.parse(String(plan.product_ids)) as string[],
      products = await publicProducts(e);
    const assets = [];
    for (const productId of ids) {
      const p = products.find(
        (x) => x.id === productId && x.owned === 1 && !x.demo,
      );
      if (!p || (!p.file_key && !(await hasPackage(e, p.id))))
        fail(
          "Um material do plano está indisponível. Aguarde a revisão do catálogo antes de assinar.",
          409,
        );
      if (p.file_key && !(await e.BUCKET.head(p.file_key)))
        fail("Um arquivo do plano está indisponível.", 409);
      await assertSaleAvailable(e, p.id);
      assets.push({
        product_id: p.id,
        title: p.title,
        file_key: p.file_key,
        file_name: p.file_name,
        content: p.preview,
      });
    }
    if (!assets.length) fail("O plano está sem materiais disponíveis.", 409);
    const id = crypto.randomUUID();
    await run(
      e,
      "INSERT INTO subscriptions(id,user_id,plan_id,product_ids,assets,created) VALUES(?,?,?,?,?,?)",
      id,
      u.id,
      plan.id,
      plan.product_ids,
      JSON.stringify(assets),
      now(),
    );
    const response = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + e.STRIPE_SECRET_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
          "Stripe-Version": STRIPE_API_VERSION,
          "Idempotency-Key": "nimbus-subscription:" + id,
        },
        body: new URLSearchParams({
          mode: "subscription",
          integration_identifier: CHECKOUT_INTEGRATION,
          "line_items[0][price]": String(plan.stripe_price_id),
          "line_items[0][quantity]": "1",
          customer_email: u.email,
          success_url: url.origin + "/#assinaturas",
          cancel_url: url.origin + "/#assinaturas",
          "metadata[nimbus_subscription_id]": id,
          "subscription_data[metadata][nimbus_subscription_id]": id,
        }),
      },
    );
    const d = (await response.json()) as { id?: string; url?: string };
    if (!response.ok || !d.id || !d.url)
      fail("Não foi possível iniciar a assinatura.", 502);
    await run(
      e,
      "UPDATE subscriptions SET session_id=?,checkout_url=? WHERE id=?",
      d.id,
      d.url,
      id,
    );
    await run(
      e,
      "INSERT INTO legal_acceptances(id,user_id,kind,version,details,created) VALUES(?,?,?,?,?,?)",
      id,
      u.id,
      "subscription_terms",
      "v1",
      JSON.stringify({
        plan: plan.id,
        amount: plan.amount,
        interval: plan.interval,
        products: JSON.parse(String(plan.product_ids)),
      }),
      now(),
    );
    return json({ url: d.url });
  }
  if (path === "subscription-portal" && method === "POST") {
    const s = (
      await rows(
        e,
        "SELECT customer_id FROM subscriptions WHERE id=? AND user_id=?",
        clean(b!.id, 100),
        u.id,
      )
    )[0];
    if (!s?.customer_id || !e.STRIPE_SECRET_KEY)
      fail("Gestão da assinatura indisponível. Contate o suporte.", 503);
    const r = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + e.STRIPE_SECRET_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": STRIPE_API_VERSION,
      },
      body: new URLSearchParams({
        customer: String(s.customer_id),
        return_url: url.origin + "/#assinaturas",
      }),
    });
    const d = (await r.json()) as { url?: string };
    if (!r.ok || !d.url)
      fail("O portal precisa ser configurado no provedor.", 502);
    return json({ url: d.url });
  }
  if (path === "club-posts") {
    const plan = clean(b?.plan_id || url.searchParams.get("plan"), 100);
    if (
      !u.admin &&
      !(
        await rows(
          e,
          "SELECT id FROM subscriptions WHERE plan_id=? AND user_id=? AND status='active' AND expires>?",
          plan,
          u.id,
          now(),
        )
      ).length
    )
      fail("Clube disponível aos assinantes ativos.", 403);
    if (method === "GET")
      return json({
        posts: await rows(
          e,
          "SELECT id,title,text,created FROM club_posts WHERE plan_id=? ORDER BY created DESC LIMIT 100",
          plan,
        ),
      });
    if (!u.admin) fail("Publicação restrita à administração.", 403);
    if (clean(b!.title).length < 3 || clean(b!.text).length < 10)
      fail("Informe título e conteúdo.");
    await run(
      e,
      "INSERT INTO club_posts(id,plan_id,title,text,created) VALUES(?,?,?,?,?)",
      crypto.randomUUID(),
      plan,
      clean(b!.title, 150),
      clean(b!.text, 20000),
      now(),
    );
    return json({ ok: true });
  }
  return null;
}
