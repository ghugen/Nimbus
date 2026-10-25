import { DatabaseSync } from "node:sqlite";
import { readFile, mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { build } from "esbuild";
const db = new DatabaseSync(":memory:");
for (const name of (await readdir("drizzle"))
  .filter((n) => n.endsWith(".sql"))
  .sort())
  db.exec(await readFile(join("drizzle", name), "utf8"));
class Statement {
  constructor(sql, args = []) {
    this.sql = sql;
    this.args = args;
  }
  bind(...args) {
    return new Statement(this.sql, args);
  }
  async all() {
    return { results: db.prepare(this.sql).all(...this.args) };
  }
  async first() {
    return db.prepare(this.sql).get(...this.args) || null;
  }
  async run() {
    return db.prepare(this.sql).run(...this.args);
  }
}
const objects = new Map();
globalThis.__NIMBUS_TEST_ENV__ = {
  DB: {
    prepare: (sql) => new Statement(sql),
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const r = [];
        for (const s of statements) r.push(await s.run());
        db.exec("COMMIT");
        return r;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  },
  BUCKET: {
    async put(key, value) {
      objects.set(key, value);
    },
    async head(key) {
      return objects.has(key) ? {} : null;
    },
    async get(key) {
      return objects.has(key) ? { body: objects.get(key) } : null;
    },
  },
  ADMIN_EMAILS: "admin@nimbus.test",
  STRIPE_SECRET_KEY: "sk_test_fake",
  STRIPE_WEBHOOK_SECRET: "whsec_fake",
};
const temp = await mkdtemp(join(tmpdir(), "nimbus-test-"));
let checks = 0;
try {
  await build({
    entryPoints: ["app/api/[...path]/route.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: join(temp, "api.mjs"),
    plugins: [
      {
        name: "test-cloudflare",
        setup(b) {
          b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({
            path: "test-env",
            namespace: "test",
          }));
          b.onLoad({ filter: /.*/, namespace: "test" }, () => ({
            contents: "export const env=globalThis.__NIMBUS_TEST_ENV__",
            loader: "js",
          }));
        },
      },
    ],
  });
  const { GET, POST } = await import(pathToFileURL(join(temp, "api.mjs")));
  async function call(
    path,
    {
      user = "alice",
      body,
      method = body ? "POST" : "GET",
      headers = {},
      raw,
    } = {},
  ) {
    const h = { origin: "https://nimbus.test", ...headers };
    if (user) {
      h["oai-authenticated-user-id"] = user;
      h["oai-authenticated-user-email"] = user + "@nimbus.test";
    }
    if (body) h["Content-Type"] = "application/json";
    const req = new Request("https://nimbus.test/api/" + path, {
      method,
      headers: h,
      body: raw ?? (body ? JSON.stringify(body) : undefined),
    });
    return (method === "GET" ? GET : POST)(req);
  }
  async function expectStatus(path, options, status) {
    const r = await call(path, options);
    assert.equal(r.status, status, await r.clone().text());
    checks++;
    return r;
  }
  const catalog = await (
    await expectStatus("catalog", { user: null }, 200)
  ).json();
  assert.equal(catalog.products.length, 8);
  assert(!("file_key" in catalog.products[0]));
  checks++;
  await expectStatus("library", { user: null }, 401);
  await expectStatus("download/metodo", {}, 403);
  await expectStatus("admin", {}, 403);
  await expectStatus(
    "checkout",
    { body: { ids: ["metodo"], accepted: false } },
    400,
  );
  await expectStatus(
    "checkout",
    { body: { ids: ["missing"], accepted: true } },
    409,
  );
  await expectStatus(
    "checkout",
    { body: { ids: ["patologia-geral"], accepted: true } },
    409,
  );
  await expectStatus(
    "checkout",
    {
      body: { ids: ["metodo"], accepted: true },
      headers: { origin: "https://evil.test" },
    },
    403,
  );
  const request_id = "12345678-1234-1234-1234-123456789abc";
  const freeOrder = await (
    await expectStatus(
      "checkout",
      { body: { ids: ["metodo", "metodo"], accepted: true, request_id } },
      200,
    )
  ).json();
  const repeated = await (
    await expectStatus(
      "checkout",
      { body: { ids: ["metodo"], accepted: true, request_id } },
      200,
    )
  ).json();
  assert.equal(freeOrder.order, repeated.order);
  checks++;
  const lib = await (await expectStatus("library", {}, 200)).json();
  assert.equal(lib.items.length, 1);
  checks++;
  const download = await expectStatus("download/metodo", {}, 200);
  assert((await download.text()).includes("ESTUDAR COM INTENÇÃO"));
  checks++;
  await expectStatus("download/metodo", { user: "bob" }, 403);
  await expectStatus(
    "checkout",
    { body: { ids: ["metodo"], accepted: true } },
    409,
  );
  await expectStatus(
    "study",
    { body: { id: "metodo", notes: "Anotação persistente", progress: 75 } },
    200,
  );
  const study = await (await call("library")).json();
  assert.equal(study.items[0].notes, "Anotação persistente");
  assert.equal(study.items[0].progress, 75);
  checks++;
  await expectStatus(
    "study",
    { user: "bob", body: { id: "metodo", notes: "Ataque", progress: 100 } },
    403,
  );
  await expectStatus(
    "reviews",
    {
      user: "bob",
      body: { id: "metodo", rating: 5, comment: "Tentativa sem aquisição" },
    },
    403,
  );
  await expectStatus(
    "reviews",
    {
      body: {
        id: "metodo",
        rating: 5,
        comment: "Guia organizado para estudar.",
      },
    },
    200,
  );
  await expectStatus(
    "favorites",
    { body: { id: "metodo", active: true } },
    200,
  );
  const me = await (await call("me")).json();
  assert.deepEqual(me.favorites, ["metodo"]);
  checks++;
  await expectStatus(
    "tickets",
    {
      body: {
        subject: "Ajuda no estudo",
        message: "Solicitação de teste do atendimento.",
      },
    },
    200,
  );
  const ticket = (await (await call("tickets")).json()).tickets[0];
  await expectStatus(
    "admin",
    {
      user: "admin",
      body: { action: "ticket", id: ticket.id, response: "Resposta de teste." },
    },
    200,
  );
  assert.equal(
    (await (await call("tickets")).json()).tickets[0].status,
    "closed",
  );
  checks++;
  const material = {
    title: "Material original de teste",
    description: "Descrição original suficientemente detalhada para submissão.",
    category: "Medicina Veterinária",
    subject: "Patologia",
    format: "Resumo",
    price: 1990,
    pages: 10,
    preview:
      "Prévia de teste com conteúdo original e informações suficientes para conhecer o material.",
    rights: true,
    commercial_accepted: true,
    accepted_rate: 2500,
    accepted_owned: 0,
  };
  await expectStatus(
    "author",
    {
      body: {
        ...material,
        category: "Saúde",
        course: "Direito",
        format: "Resumos e apostilas",
      },
    },
    400,
  );
  for (const kind of [
    "Resumos e apostilas",
    "Mapas mentais e esquemas",
    "Questões e simulados",
    "Flashcards",
    "Atlas e materiais ilustrados",
    "Guias práticos",
    "Casos para estudo",
    "Modelos e ferramentas",
    "Revisões para provas",
    "Kits e coleções",
  ])
    await expectStatus(
      "author",
      {
        body: {
          ...material,
          category: "Saúde",
          course: "Medicina Veterinária",
          format: kind,
          topic: "Sistema respiratório",
          level: "Pós-graduação",
          language: "Português",
        },
      },
      200,
    );
  const authorMetadata = (await (await call("author")).json()).products.find(
    (p) => p.topic === "Sistema respiratório",
  );
  assert.equal(authorMetadata.category, "Saúde");
  assert.equal(authorMetadata.course, "Medicina Veterinária");
  assert.equal(authorMetadata.level, "Pós-graduação");
  checks++;
  const saved = await (
    await expectStatus("author", { body: material }, 200)
  ).json();
  await expectStatus(
    "author",
    { user: "bob", body: { ...material, id: saved.id } },
    403,
  );
  await expectStatus(
    "admin",
    {
      user: "admin",
      body: { action: "product", id: saved.id, status: "published" },
    },
    400,
  );
  const form = new FormData();
  form.set("id", saved.id);
  form.set(
    "file",
    new File(["%PDF-1.4\nTest fixture only."], "test.pdf", {
      type: "application/pdf",
    }),
  );
  const upload = await POST(
    new Request("https://nimbus.test/api/upload", {
      method: "POST",
      headers: {
        origin: "https://nimbus.test",
        "oai-authenticated-user-id": "alice",
        "oai-authenticated-user-email": "alice@nimbus.test",
      },
      body: form,
    }),
  );
  assert.equal(upload.status, 200, await upload.text());
  checks++;
  await expectStatus("admin-file/" + saved.id, {}, 403);
  await expectStatus("admin-file/" + saved.id, { user: "admin" }, 200);
  await expectStatus(
    "admin",
    {
      user: "admin",
      body: { action: "product", id: saved.id, status: "published" },
    },
    200,
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    assert.equal(url, "https://api.stripe.com/v1/checkout/sessions");
    const fields = opts.body;
    assert.equal(fields.get("line_items[0][price_data][unit_amount]"), "1990");
    assert.equal(fields.get("line_items[0][quantity]"), "1");
    checks++;
    return Response.json({
      id: "cs_test_verified",
      url: "https://checkout.stripe.com/test",
    });
  };
  const checkout = await (
    await expectStatus(
      "checkout",
      { body: { ids: [saved.id], accepted: true, total: 1, price: 1 } },
      200,
    )
  ).json();
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("/payment_intents/"))
      return Response.json({
        status: "succeeded",
        latest_charge: {
          id: "ch_test",
          amount: 1990,
          amount_refunded: 0,
          currency: "brl",
          balance_transaction: {
            id: "txn_test",
            fee: 190,
            amount: 1990,
            currency: "brl",
            available_on: Math.floor(Date.now() / 1000) - 1,
          },
        },
      });
    throw new Error("Unexpected external request");
  };
  await expectStatus("download/" + saved.id, {}, 403);
  await expectStatus(
    "finance",
    {
      body: {
        action: "policy",
        id: "alice",
        commission_bps: 3000,
        owned: false,
      },
    },
    403,
  );
  await expectStatus(
    "finance",
    {
      user: "admin",
      body: {
        action: "policy",
        id: "alice",
        commission_bps: 3000,
        owned: false,
      },
    },
    200,
  );
  async function webhook(amount = 1990, valid = true) {
    const event = {
      id: "evt_test",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_verified",
          metadata: { order_id: checkout.order },
          payment_status: "paid",
          amount_total: amount,
          currency: "brl",
          payment_intent: "pi_test",
        },
      },
    };
    const raw = JSON.stringify(event),
      t = String(Math.floor(Date.now() / 1000)),
      sig = createHmac("sha256", valid ? "whsec_fake" : "invalid")
        .update(t + "." + raw)
        .digest("hex");
    return expectStatus(
      "webhook",
      {
        user: null,
        method: "POST",
        raw,
        headers: { "stripe-signature": `t=${t},v1=${sig}` },
      },
      valid ? 200 : 400,
    );
  }
  await webhook(1990, false);
  await expectStatus("download/" + saved.id, {}, 403);
  await webhook(1);
  await expectStatus("download/" + saved.id, {}, 403);
  await webhook();
  await webhook();
  await expectStatus("download/" + saved.id, {}, 200);
  const authorFinance = (await (await call("author")).json()).finance;
  const sale = authorFinance.entries.find((x) => x.order_id === checkout.order);
  assert.equal(sale.rate, 2500);
  assert.equal(sale.fee, 190);
  assert.equal(sale.author_net, 1350);
  assert.equal(sale.platform, 450);
  assert.equal(
    authorFinance.entries.filter((x) => x.order_id === checkout.order).length,
    1,
  );
  checks++;
  await expectStatus(
    "finance",
    {
      user: "admin",
      body: {
        action: "payout",
        id: "alice",
        amount: 1350,
        reference: "TEST-RESERVE",
      },
    },
    400,
  );
  db.prepare(
    "UPDATE settlements SET release_at=0,created='2025-01-01T00:00:00.000Z' WHERE order_id=?",
  ).run(checkout.order);
  await expectStatus(
    "finance",
    {
      user: "admin",
      body: {
        action: "payout",
        id: "alice",
        amount: 1350,
        reference: "TEST-TRANSFER-1",
      },
    },
    200,
  );
  await expectStatus(
    "finance",
    {
      user: "admin",
      body: {
        action: "payout",
        id: "alice",
        amount: 1,
        reference: "TEST-TRANSFER-1",
      },
    },
    400,
  );
  await expectStatus(
    "finance",
    {
      user: "admin",
      body: {
        action: "payout",
        id: "alice",
        amount: 1,
        reference: "TEST-OVERDRAW",
      },
    },
    400,
  );
  const orders = await (await call("orders")).json();
  assert.equal(orders.orders.find((o) => o.id === checkout.order).total, 1990);
  checks++;
  await expectStatus("download/" + saved.id, { user: "bob" }, 403);
  globalThis.fetch = async () =>
    Response.json({
      status: "succeeded",
      latest_charge: {
        id: "ch_test",
        amount: 1990,
        amount_refunded: 1990,
        currency: "brl",
        balance_transaction: {
          id: "txn_test",
          fee: 190,
          amount: 1990,
          currency: "brl",
          available_on: Math.floor(Date.now() / 1000) - 1,
        },
      },
    });
  const refundBody = JSON.stringify({
    id: "evt_refund",
    type: "charge.refunded",
    data: { object: { payment_intent: "pi_test", refunded: true } },
  });
  const refundTime = String(Math.floor(Date.now() / 1000));
  const refundSig = createHmac("sha256", "whsec_fake")
    .update(refundTime + "." + refundBody)
    .digest("hex");
  await expectStatus(
    "webhook",
    {
      user: null,
      method: "POST",
      raw: refundBody,
      headers: { "stripe-signature": `t=${refundTime},v1=${refundSig}` },
    },
    200,
  );
  await expectStatus("download/" + saved.id, {}, 403);
  const finalReport = (await (await call("author")).json()).finance;
  const remaining = finalReport.balances.find((x) => x.author_id === "alice");
  assert.equal(remaining.balance, -1350);
  assert.equal(remaining.payable, 0);
  checks++;
  await expectStatus("privacy-export", { user: null }, 401);
  await expectStatus("privacy-admin", {}, 403);
  await expectStatus(
    "privacy",
    {
      body: {
        kind: "exclusão",
        message: "Solicito análise de exclusão dos meus dados.",
      },
    },
    200,
  );
  const privacy = (await (await call("privacy")).json()).requests;
  assert.equal(privacy.length, 1);
  const bobPrivacy = (await (await call("privacy", { user: "bob" })).json())
    .requests;
  assert.equal(bobPrivacy.length, 0);
  checks++;
  await expectStatus(
    "privacy-admin",
    {
      user: "admin",
      body: {
        action: "respond",
        id: privacy[0].id,
        status: "in_progress",
        response: "Pedido recebido, em análise das retenções aplicáveis.",
      },
    },
    200,
  );
  const exported = await (await expectStatus("privacy-export", {}, 200)).json();
  assert.equal(exported.profile.id, "alice");
  assert.equal(exported.privacy_requests[0].status, "in_progress");
  assert(!JSON.stringify(exported).includes("sk_test_fake"));
  assert(!Object.keys(exported).includes("credentials"));
  checks++;
  await expectStatus(
    "privacy-admin",
    {
      user: "admin",
      body: {
        action: "settings",
        controller: "Operação de teste Nimbus",
        contact: "privacidade@nimbus.test",
        retention:
          "Critérios demonstrativos de teste: conservar dados estritamente necessários e analisar obrigações legais antes da exclusão.",
      },
    },
    200,
  );
  assert.equal(
    (await (await call("privacy-info", { user: null })).json()).settings
      .contact,
    "privacidade@nimbus.test",
  );
  checks++;
  globalThis.fetch = originalFetch;
  // Novos fluxos: kits, arquivos imutáveis, versões, revisão, privacidade e avisos.
  async function sendFile(
    id,
    filename,
    content,
    user = "charlie",
    kind = "file",
  ) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("kind", kind);
    fd.set("notes", "Atualização original com exemplos revisados.");
    fd.set(
      "file",
      new File([content], filename, {
        type: kind === "file" ? "application/pdf" : "image/png",
      }),
    );
    const r = await POST(
      new Request(
        "https://nimbus.test/api/" +
          (kind === "file" ? "upload" : "asset-upload"),
        {
          method: "POST",
          headers: {
            origin: "https://nimbus.test",
            "oai-authenticated-user-id": user,
            "oai-authenticated-user-email": user + "@nimbus.test",
          },
          body: fd,
        },
      ),
    );
    return r;
  }
  async function createMaterial(title) {
    const p = await (
      await expectStatus(
        "author",
        {
          user: "charlie",
          body: {
            ...material,
            title,
            price: 0,
            accepted_rate: 2500,
            accepted_owned: 0,
          },
        },
        200,
      )
    ).json();
    const r = await sendFile(
      p.id,
      "original.pdf",
      "%PDF-1.4\nOriginal " + title,
    );
    assert.equal(r.status, 200, await r.text());
    checks++;
    await expectStatus(
      "author-meta",
      {
        user: "charlie",
        body: {
          id: p.id,
          objectives: "Compreender conceitos com exemplos originais.",
          toc: "Conceitos e exercícios",
          sources: "Referências bibliográficas declaradas pelo autor.",
        },
      },
      200,
    );
    await expectStatus(
      "admin",
      {
        user: "admin",
        body: {
          action: "product",
          id: p.id,
          status: "published",
          reviewed: true,
          feedback: "Conteúdo e referências revisados para publicação.",
        },
      },
      200,
    );
    return p.id;
  }
  const child1 = await createMaterial("Primeiro material do kit");
  const child2 = await createMaterial("Segundo material do kit");
  await expectStatus(
    "author-meta",
    { user: "bob", body: { id: child1, objectives: "Modificação indevida" } },
    404,
  );
  await expectStatus(
    "author-profile",
    {
      user: "charlie",
      body: {
        slug: "autor-charlie",
        public_name: "Autor de Teste",
        bio: "Biografia pública autorizada.",
        credentials: "Formação declarada.",
        public: true,
      },
    },
    200,
  );
  await expectStatus(
    "author-profile",
    {
      user: "bob",
      body: {
        slug: "autor-charlie",
        public_name: "Outra pessoa",
        public: true,
      },
    },
    409,
  );
  const kit = await (
    await expectStatus(
      "author",
      {
        user: "charlie",
        body: {
          ...material,
          title: "Kit de testes originais",
          format: "Kits e coleções",
          price: 0,
        },
      },
      200,
    )
  ).json();
  await expectStatus(
    "author-meta",
    { user: "charlie", body: { id: kit.id, bundle_ids: [child1] } },
    400,
  );
  await expectStatus(
    "author-meta",
    { user: "charlie", body: { id: kit.id, bundle_ids: [child1, saved.id] } },
    400,
  );
  await expectStatus(
    "author-meta",
    { user: "charlie", body: { id: kit.id, bundle_ids: [child1, child2] } },
    200,
  );
  await expectStatus("submit", { user: "charlie", body: { id: kit.id } }, 200);
  await expectStatus(
    "admin",
    {
      user: "admin",
      body: {
        action: "product",
        id: kit.id,
        status: "changes_requested",
        feedback: "Inclua mais informações sobre os objetivos do kit.",
      },
    },
    200,
  );
  assert(
    (await (await call("author", { user: "charlie" })).json()).editorial.some(
      (e) => e.product_id === kit.id && e.action === "changes_requested",
    ),
  );
  checks++;
  await expectStatus(
    "admin",
    {
      user: "admin",
      body: { action: "product", id: kit.id, status: "published" },
    },
    200,
  );
  const kitOrder = await (
    await expectStatus(
      "checkout",
      { user: "dora", body: { ids: [kit.id], accepted: true } },
      200,
    )
  ).json();
  const kitLibrary = (await (await call("library", { user: "dora" })).json())
    .items;
  assert(kitLibrary.some((i) => i.product_id === child1));
  assert(kitLibrary.some((i) => i.product_id === child2));
  assert(!kitLibrary.some((i) => i.product_id === kit.id));
  checks++;
  const originalBody = await (
    await expectStatus("download/" + child1, { user: "dora" }, 200)
  ).text();
  await expectStatus("download/" + child1, { user: "bob" }, 403);
  await expectStatus(
    "checkout",
    { user: "dora", body: { ids: [child1], accepted: true } },
    409,
  );
  await expectStatus(
    "checkout",
    { user: "elena", body: { ids: [kit.id, child1], accepted: true } },
    409,
  );
  const update = await sendFile(
    child1,
    "nova-versao.pdf",
    "%PDF-1.4\nNova versão de teste",
  );
  assert.equal(update.status, 200, await update.text());
  checks++;
  await expectStatus(
    "admin",
    {
      user: "admin",
      body: {
        action: "product",
        id: child1,
        status: "published",
        reviewed: true,
      },
    },
    200,
  );
  const versions = (
    await (
      await expectStatus("versions?id=" + child1, { user: "dora" }, 200)
    ).json()
  ).versions;
  assert.equal(versions.length, 2);
  assert.equal(versions[0].sequence, 2);
  checks++;
  const updatedBody = await (
    await expectStatus(
      "version-download/" + versions[0].id,
      { user: "dora" },
      200,
    )
  ).text();
  assert(updatedBody.includes("Nova versão"));
  assert.equal(
    await (await call("download/" + child1, { user: "dora" })).text(),
    originalBody,
  );
  checks++;
  await expectStatus(
    "version-download/" + versions[0].id,
    { user: "bob" },
    403,
  );
  const notices = (
    await (await expectStatus("notifications", { user: "dora" }, 200)).json()
  ).notifications;
  assert(notices.some((n) => n.title === "Nova versão disponível"));
  assert.equal(
    notices.filter((n) => n.title === "Sua aquisição está disponível").length,
    1,
  );
  checks++;
  await expectStatus(
    "notifications",
    { user: "bob", body: { id: notices[0].id } },
    200,
  );
  assert.equal(
    db.prepare("SELECT read FROM notifications WHERE id=?").get(notices[0].id)
      .read,
    0,
  );
  checks++;
  await expectStatus("operations", { user: "bob" }, 403);
  const operations = await (
    await expectStatus("operations", { user: "admin" }, 200)
  ).json();
  assert.equal(operations.readiness.email, false);
  assert(!JSON.stringify(operations).includes("sk_test_fake"));
  checks++;
  await expectStatus(
    "operations",
    { user: "admin", body: { action: "retry_email", id: notices[0].id } },
    200,
  );
  assert.equal(
    db.prepare("SELECT status FROM email_outbox WHERE id=?").get(notices[0].id)
      .status,
    "pending",
  );
  checks++;
  const visitor = "12345678-1234-1234-1234-123456789abc";
  await expectStatus(
    "metric",
    {
      user: null,
      body: { productId: child1, kind: "view", visitor, consent: false },
    },
    400,
  );
  for (let i = 0; i < 2; i++)
    await expectStatus(
      "metric",
      {
        user: null,
        body: { productId: child1, kind: "view", visitor, consent: true },
      },
      200,
    );
  const metrics = (
    await (await expectStatus("analytics", { user: "charlie" }, 200)).json()
  ).metrics;
  assert.equal(metrics.find((p) => p.id === child1).views, 1);
  assert(
    !(await (await call("analytics", { user: "bob" })).json()).metrics.some(
      (p) => p.id === child1,
    ),
  );
  checks++;
  const publicCatalog = (await (await call("catalog", { user: null })).json())
    .products;
  const publicItem = publicCatalog.find((p) => p.id === child1);
  assert(!("cover_key" in publicItem));
  assert(!("preview_keys" in publicItem));
  assert(!("file_key" in publicItem));
  assert.equal(publicItem.author_slug, "autor-charlie");
  checks++;
  const invalidImage = await sendFile(
    child1,
    "falsa.png",
    "isto não é uma imagem válida",
    "charlie",
    "cover",
  );
  assert.equal(invalidImage.status, 400);
  checks++;
  const image = await sendFile(
    child1,
    "capa.png",
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0]),
    "charlie",
    "cover",
  );
  assert.equal(image.status, 200, await image.text());
  checks++;
  await expectStatus("asset/" + child1 + "/cover", { user: null }, 404);
  await expectStatus(
    "admin",
    {
      user: "admin",
      body: { action: "product", id: child1, status: "published" },
    },
    200,
  );
  const coverResponse = await expectStatus(
    "asset/" + child1 + "/cover",
    { user: null },
    200,
  );
  assert.equal(coverResponse.headers.get("Content-Type"), "image/png");
  checks++;
  await expectStatus(
    "asset-remove",
    { user: "charlie", body: { id: child1, kind: "preview", index: -1 } },
    400,
  );
  db.prepare("UPDATE orders SET status='refunded' WHERE id=?").run(
    kitOrder.order,
  );
  await expectStatus("download/" + child1, { user: "dora" }, 403);
  await expectStatus("versions?id=" + child1, { user: "dora" }, 403);

  console.log(
    `Nimbus: ${checks} verificações de integração aprovadas (SQLite real em memória + R2/Stripe simulados).`,
  );
} finally {
  db.close();
  await rm(temp, { recursive: true, force: true });
  delete globalThis.__NIMBUS_TEST_ENV__;
}
