import { PDFDocument, StandardFonts } from "pdf-lib";
async function fixturePdf(text = "Original fixture") {
  const d = await PDFDocument.create(),
    f = await d.embedFont(StandardFonts.Helvetica);
  d.addPage().drawText(text, { font: f });
  return d.save({ useObjectStreams: false });
}
import { DatabaseSync } from "node:sqlite";
import { restoreSnapshot } from "../scripts/restore-backup.mjs";
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
  STRIPE_WEBHOOK_READY: "1",
  STRIPE_SUBSCRIPTIONS_READY: "1",
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
  assert.equal(catalog.products.length, 12);
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
    new File([await fixturePdf("Test fixture only.")], "test.pdf", {
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
      await fixturePdf("Original " + title),
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
    await fixturePdf("Nova versao de teste"),
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
  assert(updatedBody.startsWith("%PDF-"));
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

  await expectStatus("coupons", {}, 403);
  const campaign = {
    code: "ABERTURA",
    kind: "percent",
    value: 50,
    min_total: 0,
    max_uses: 1,
    starts: "2026-01-01T00:00:00.000Z",
    ends: "2099-01-01T00:00:00.000Z",
  };
  await expectStatus("coupons", { user: "admin", body: campaign }, 200);
  await expectStatus("coupons", { user: "admin", body: campaign }, 409);
  await expectStatus(
    "coupon-quote",
    { user: "fred", body: { code: "ABERTURA", ids: [child1] } },
    400,
  );
  db.prepare(
    "INSERT INTO author_accounts(id,commission_bps,owned,updated) VALUES('charlie',0,1,?) ON CONFLICT(id) DO UPDATE SET owned=1,commission_bps=0",
  ).run(new Date().toISOString());
  db.prepare(
    "UPDATE products SET accepted_owned=1,accepted_bps=0,price=101 WHERE id=?",
  ).run(child1);
  db.prepare(
    "UPDATE products SET accepted_owned=1,accepted_bps=0,price=1 WHERE id=?",
  ).run(child2);
  const quote = await (
    await expectStatus(
      "coupon-quote",
      { user: "fred", body: { code: "ABERTURA", ids: [child1, child2] } },
      200,
    )
  ).json();
  assert.equal(quote.discount, 51);
  assert.equal(quote.total, 51);
  checks++;
  let captured = [];
  globalThis.fetch = async (url, opts) => {
    assert.equal(url, "https://api.stripe.com/v1/checkout/sessions");
    captured = [
      Number(opts.body.get("line_items[0][price_data][unit_amount]")),
      Number(opts.body.get("line_items[1][price_data][unit_amount]")),
    ];
    return Response.json({
      id: "cs_discounted",
      url: "https://checkout.stripe.com/discounted",
    });
  };
  const discounted = await (
    await expectStatus(
      "checkout",
      {
        user: "fred",
        body: { ids: [child1, child2], coupon: "ABERTURA", accepted: true },
      },
      200,
    )
  ).json();
  assert.equal(
    captured.reduce((a, b) => a + b, 0),
    51,
  );
  assert(captured.every((x) => x >= 0));
  assert.equal(
    db.prepare("SELECT total FROM orders WHERE id=?").get(discounted.order)
      .total,
    51,
  );
  assert.equal(
    db
      .prepare("SELECT SUM(price) total FROM order_items WHERE order_id=?")
      .get(discounted.order).total,
    51,
  );
  checks++;
  await expectStatus(
    "checkout",
    {
      user: "george",
      body: { ids: [child1], coupon: "ABERTURA", accepted: true },
    },
    409,
  );
  await expectStatus(
    "coupons",
    { user: "admin", body: { ...campaign, code: "INATIVO", max_uses: 10 } },
    200,
  );
  await expectStatus(
    "coupons",
    {
      user: "admin",
      body: { action: "toggle", code: "INATIVO", active: false },
    },
    200,
  );
  await expectStatus(
    "coupon-quote",
    { user: "george", body: { code: "INATIVO", ids: [child1] } },
    400,
  );
  await expectStatus(
    "coupons",
    { user: "admin", body: { ...campaign, code: "INVALIDO", value: 101 } },
    400,
  );
  // Proteção transacional: mesmo se um cliente ignorar a consulta prévia, o banco impede excesso.
  db.prepare(
    "INSERT INTO orders(id,user_id,status,total,created) VALUES('quota-test','george','pending',50,?)",
  ).run(new Date().toISOString());
  assert.throws(
    () =>
      db
        .prepare(
          "INSERT INTO coupon_uses(order_id,code,user_id,discount,created) VALUES(?,?,?,?,?)",
        )
        .run("quota-test", "ABERTURA", "george", 50, new Date().toISOString()),
    /Cupom indisponível/,
  );
  checks++;
  globalThis.fetch = originalFetch;
  await expectStatus("material-requests", { user: null }, 401);
  await expectStatus(
    "material-requests",
    {
      user: "fred",
      body: {
        course: "Medicina Veterinária",
        subject: "Patologia",
        description: "Gostaria de questões comentadas sobre adaptação celular.",
      },
    },
    200,
  );
  const suggestions = (
    await (await call("material-requests", { user: "fred" })).json()
  ).requests;
  assert.equal(suggestions.length, 1);
  assert.equal(
    (await (await call("material-requests", { user: "george" })).json())
      .requests.length,
    0,
  );
  checks++;
  await expectStatus(
    "material-requests",
    {
      user: "george",
      body: {
        action: "respond",
        id: suggestions[0].id,
        status: "planned",
        response: "Vou preparar o material solicitado.",
      },
    },
    403,
  );
  await expectStatus(
    "material-requests",
    {
      user: "admin",
      body: {
        action: "respond",
        id: suggestions[0].id,
        status: "planned",
        response: "Sugestão recebida para avaliação da coleção.",
      },
    },
    200,
  );
  await expectStatus(
    "content-issues",
    {
      user: "george",
      body: {
        product_id: child1,
        page: "2",
        message: "Este trecho precisa de esclarecimento.",
      },
    },
    403,
  );
  db.prepare("UPDATE orders SET status='paid' WHERE id=?").run(
    discounted.order,
  );
  await expectStatus(
    "content-issues",
    {
      user: "fred",
      body: {
        product_id: child1,
        page: "2, segundo parágrafo",
        message: "Este trecho precisa de esclarecimento e de um exemplo.",
      },
    },
    200,
  );
  const issues = (
    await (
      await call("content-issues?scope=author", { user: "charlie" })
    ).json()
  ).issues;
  assert.equal(issues.length, 1);
  assert.equal(
    (await (await call("content-issues", { user: "george" })).json()).issues
      .length,
    0,
  );
  checks++;
  await expectStatus(
    "content-issues",
    {
      user: "george",
      body: {
        action: "respond",
        id: issues[0].id,
        status: "resolved",
        response: "Alteração não autorizada.",
      },
    },
    403,
  );
  await expectStatus(
    "content-issues",
    {
      user: "charlie",
      body: {
        action: "respond",
        id: issues[0].id,
        status: "in_progress",
        response: "Obrigado, vou conferir este trecho na próxima revisão.",
      },
    },
    200,
  );
  assert(
    (
      await (await call("notifications", { user: "fred" })).json()
    ).notifications.some((n) => n.title === "Retorno sobre o conteúdo"),
  );
  checks++;
  await expectStatus("collections", { user: null }, 200);
  await expectStatus("collections-admin", { user: "fred" }, 403);
  await expectStatus(
    "collections-admin",
    {
      user: "admin",
      body: {
        slug: "colecao-teste",
        title: "Coleção original de teste",
        description: "Seleção editorial.",
        course: "Medicina Veterinária",
        subject: "Patologia",
        product_ids: [child1],
        published: false,
      },
    },
    200,
  );
  assert(
    !(
      await (await call("collections", { user: null })).json()
    ).collections.some((c) => c.slug === "colecao-teste"),
  );
  checks++;
  await expectStatus(
    "collections-admin",
    {
      user: "admin",
      body: {
        slug: "colecao-teste",
        title: "Coleção original de teste",
        product_ids: [child1],
        published: true,
      },
    },
    200,
  );
  const collection = (
    await (await call("collections", { user: null })).json()
  ).collections.find((c) => c.slug === "colecao-teste");
  assert.equal(collection.products[0].id, child1);
  assert(!("cover_key" in collection.products[0]));
  assert.equal(collection.products[0].file_key, null);
  checks++;
  const freeCatalog = (
    await (await call("catalog", { user: null })).json()
  ).products.filter((p) => p.public_download);
  assert.equal(freeCatalog.length, 4);
  assert(freeCatalog.every((p) => p.price === 0 && p.file_format === "PDF"));
  checks++;
  await expectStatus(
    "checkout",
    { user: "fred", body: { ids: ["planejamento-academico"], accepted: true } },
    200,
  );
  const pdfRedirect = await expectStatus(
    "download/planejamento-academico",
    { user: "fred" },
    302,
  );
  assert(
    pdfRedirect.headers
      .get("location")
      .endsWith("/materiais-gratuitos/planejamento-academico.pdf"),
  );
  checks++;

  await expectStatus("commercial-plan", { user: null }, 401);
  await expectStatus("commercial-plan", { user: "fred" }, 403);
  const ideas = (
    await (await expectStatus("commercial-plan", { user: "admin" }, 200)).json()
  ).ideas;
  assert(ideas.length >= 35);
  assert(ideas.some((x) => x.id === "mentoria-individual"));
  checks++;
  await expectStatus(
    "commercial-plan",
    {
      user: "admin",
      body: {
        id: "apostilas",
        status: "planned",
        priority: "high",
        notes: "Começar por Patologia Veterinária.",
      },
    },
    200,
  );
  const planned = (
    await (await call("commercial-plan", { user: "admin" })).json()
  ).ideas.find((x) => x.id === "apostilas");
  assert.equal(planned.priority, "high");
  assert.equal(planned.notes, "Começar por Patologia Veterinária.");
  checks++;
  await expectStatus(
    "commercial-plan",
    {
      user: "fred",
      body: {
        id: "apostilas",
        status: "available",
        priority: "high",
        notes: "Sem autorização",
      },
    },
    403,
  );
  await expectStatus("admin-overview", { user: null }, 401);
  await expectStatus("admin-overview", { user: "fred" }, 403);
  const overview = (
    await (await expectStatus("admin-overview", { user: "admin" }, 200)).json()
  ).overview;
  assert.equal(
    overview.orders,
    db.prepare("SELECT COUNT(*) n FROM orders WHERE status='paid'").get().n,
  );
  assert.equal(
    overview.gross,
    db
      .prepare(
        "SELECT COALESCE(SUM(total),0) n FROM orders WHERE status='paid'",
      )
      .get().n,
  );
  assert.equal(
    overview.pending_products,
    db
      .prepare(
        "SELECT COUNT(*) n FROM products WHERE status='pending' AND demo=0",
      )
      .get().n,
  );
  assert.equal(
    overview.corrections,
    db
      .prepare(
        "SELECT COUNT(*) n FROM content_issues WHERE status IN ('open','in_progress')",
      )
      .get().n,
  );
  assert.equal(overview.ideas, 1);
  assert.equal(typeof overview.nimbus_net, "number");
  assert(!JSON.stringify(overview).includes("@"));
  checks++;
  {
    // New marketplace capabilities: verify isolation and authorization against the real SQL schema.
    db.exec("DELETE FROM rate_buckets");
    await expectStatus("reader-state?id=metodo", { user: null }, 401);
    await expectStatus("reader-state?id=metodo", { user: "outsider" }, 403);
    await expectStatus(
      "reader-state",
      {
        body: {
          product_id: "metodo",
          page: 2,
          zoom: 125,
          folder: "Semestre",
          status: "studying",
          next_review: "2026-12-10",
        },
      },
      200,
    );
    assert.equal(
      (await (await call("reader-state?id=metodo")).json()).state.page,
      2,
    );
    checks++;
    await expectStatus(
      "reader-state",
      { body: { product_id: "metodo", page: -1 } },
      400,
    );
    await expectStatus(
      "page-annotations",
      {
        body: {
          product_id: "metodo",
          page: 2,
          kind: "note",
          text: "Anotação privada",
        },
      },
      200,
    );
    const note = (await (await call("page-annotations?id=metodo")).json())
      .annotations[0];
    await expectStatus(
      "checkout",
      { user: "readerbob", body: { ids: ["metodo"], accepted: true } },
      200,
    );
    await expectStatus(
      "page-annotations",
      {
        user: "readerbob",
        body: { product_id: "metodo", action: "delete", id: note.id },
      },
      200,
    );
    assert.equal(
      (await (await call("page-annotations?id=metodo")).json()).annotations
        .length,
      1,
    );
    checks++;
    await expectStatus(
      "author-draft",
      {
        body: {
          key: "new",
          data: {
            title: "Rascunho privado",
            rights: true,
            commercial_accepted: true,
          },
        },
      },
      200,
    );
    const restored = JSON.parse(
      (await (await call("author-draft?key=new")).json()).draft.data,
    );
    assert.equal(restored.rights, false);
    assert.equal(restored.commercial_accepted, false);
    checks++;
    assert.equal(
      (await (await call("author-draft?key=new", { user: "readerbob" })).json())
        .draft,
      null,
    );
    checks++;
    await expectStatus(
      "saved-searches",
      { body: { title: "Minha pesquisa", filters: { q: "anatomia" } } },
      200,
    );
    assert.equal(
      (await (await call("saved-searches", { user: "outsider" })).json())
        .searches.length,
      0,
    );
    checks++;
    await expectStatus("roadmap", { user: "alice" }, 403);
    const roadmapData = (
      await (await call("roadmap", { user: "admin" })).json()
    ).items;
    assert.equal(roadmapData.length, 100);
    checks++;
    await expectStatus(
      "staff-roles",
      { user: "alice", body: { user_id: "alice", reviewer: true } },
      403,
    );
    await expectStatus(
      "staff-roles",
      {
        user: "admin",
        body: { user_id: "outsider", reviewer: true, support: false },
      },
      200,
    );
    await expectStatus("staff-review", { user: "outsider" }, 200);
    await expectStatus("staff-support", { user: "outsider" }, 403);
    await expectStatus("finance", { user: "outsider" }, 403);
    await expectStatus("management-report", { user: "outsider" }, 403);
    await expectStatus("management-report?from=bad", { user: "admin" }, 400);
    const report = await (
      await expectStatus("management-report", { user: "admin" }, 200)
    ).json();
    assert(Array.isArray(report.products));
    assert(Array.isArray(report.campaigns));
    checks++;
    await expectStatus("backup-export", { user: "outsider" }, 403);
    const backup = await (
      await expectStatus("backup-export", { user: "admin" }, 200)
    ).json();
    assert.equal(backup.format, "nimbus-data-v1");
    assert(backup.tables.users.length > 0);
    assert(Array.isArray(backup.object_manifest));
    checks++;
    const restoredDb = new DatabaseSync(":memory:");
    for (const file of (await readdir("drizzle"))
      .filter((x) => x.endsWith(".sql"))
      .sort())
      restoredDb.exec(await readFile("drizzle/" + file, "utf8"));
    await restoreSnapshot(restoredDb, backup);
    assert.equal(
      restoredDb.prepare("SELECT COUNT(*) n FROM users").get().n,
      backup.tables.users.length,
    );
    assert.equal(
      restoredDb.prepare("SELECT COUNT(*) n FROM order_items").get().n,
      backup.tables.order_items.length,
    );
    restoredDb.close();
    checks++;

    // A free gift grants only the verified recipient, then revokes access on a refund.
    const gift = await (
      await expectStatus(
        "checkout",
        {
          user: "giftbuyer",
          body: {
            ids: ["metodo"],
            accepted: true,
            gift_email: "giftrecipient@nimbus.test",
            seats: 1,
          },
        },
        200,
      )
    ).json();
    await expectStatus("download/metodo", { user: "giftbuyer" }, 403);
    await expectStatus("download/metodo", { user: "giftrecipient" }, 200);
    db.prepare("UPDATE orders SET status='refunded' WHERE id=?").run(
      gift.order,
    );
    await expectStatus("download/metodo", { user: "giftrecipient" }, 403);
    const group = await (
      await expectStatus(
        "checkout",
        {
          user: "teacher",
          body: { ids: ["metodo"], accepted: true, seats: 2 },
        },
        200,
      )
    ).json();
    await expectStatus(
      "licenses",
      {
        user: "teacher",
        body: { order_id: group.order, email: "student1@nimbus.test" },
      },
      200,
    );
    await expectStatus(
      "licenses",
      {
        user: "teacher",
        body: { order_id: group.order, email: "student2@nimbus.test" },
      },
      409,
    );
    await expectStatus("download/metodo", { user: "student1" }, 200);
    await expectStatus(
      "licenses",
      {
        user: "outsider",
        body: { order_id: group.order, email: "thief@nimbus.test" },
      },
      403,
    );
    // Approved learning packages: unpublished edits must never leak to students.
    const courseProduct = saved.id;
    db.prepare(
      "UPDATE products SET accepted_bps=(SELECT CASE WHEN owned=1 THEN 0 ELSE commission_bps END FROM author_accounts WHERE id=products.author_id),accepted_owned=(SELECT owned FROM author_accounts WHERE id=products.author_id) WHERE id=?",
    ).run(courseProduct);
    await expectStatus(
      "learning-author",
      { user: "outsider", body: { product_id: courseProduct, cards: [] } },
      403,
    );
    const activities = {
      product_id: courseProduct,
      cards: [{ id: "card1", front: "Frente", back: "Verso" }],
      questions: [
        {
          id: "q1",
          prompt: "Quanto é dois mais dois?",
          options: ["Três", "Quatro"],
          correct: 1,
          explanation: "Soma de dois e dois.",
        },
      ],
      lessons: [
        {
          id: "l1",
          title: "Aula inicial",
          text: "Conteúdo original de uma aula de demonstração.",
          video_url: "",
        },
      ],
    };
    await expectStatus(
      "learning-author",
      { user: "admin", body: activities },
      200,
    );
    await expectStatus(
      "admin",
      {
        user: "admin",
        body: { action: "product", id: courseProduct, status: "published" },
      },
      200,
    );
    const purchase = await (
      await expectStatus(
        "checkout",
        { user: "learner", body: { ids: ["metodo"], accepted: true } },
        200,
      )
    ).json();
    // Use a separate paid-order fixture to exercise entitlement; provider integration is tested elsewhere above.
    db.prepare(
      "INSERT INTO order_items(id,order_id,product_id,title,price,file_key,file_name,content,author_id,commission_bps,owned) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      "lms-fixture",
      purchase.order,
      courseProduct,
      "Atividades",
      0,
      null,
      null,
      "",
      "admin",
      0,
      1,
    );
    let learningData = await (
      await expectStatus(
        "learning-content?id=" + courseProduct,
        { user: "learner" },
        200,
      )
    ).json();
    assert(!("correct" in learningData.package.questions[0]));
    assert(!("explanation" in learningData.package.questions[0]));
    checks++;
    const scored = await (
      await expectStatus(
        "quiz-submit",
        {
          user: "learner",
          body: { product_id: courseProduct, answers: [1], score: 0 },
        },
        200,
      )
    ).json();
    assert.equal(scored.score, 1);
    checks++;
    await expectStatus(
      "quiz-submit",
      { user: "outsider", body: { product_id: courseProduct, answers: [1] } },
      403,
    );
    await expectStatus(
      "lesson-progress",
      {
        user: "learner",
        body: { product_id: courseProduct, lesson_id: "l1", completed: true },
      },
      200,
    );
    await expectStatus(
      "card-review",
      {
        user: "learner",
        body: { product_id: courseProduct, card_id: "card1", level: "easy" },
      },
      200,
    );
    await expectStatus(
      "learning-author",
      {
        user: "admin",
        body: {
          ...activities,
          cards: [{ id: "card1", front: "NOVA SEM REVISÃO", back: "Privado" }],
        },
      },
      200,
    );
    learningData = await (
      await call("learning-content?id=" + courseProduct, { user: "learner" })
    ).json();
    assert.equal(learningData.package.cards[0].front, "Frente");
    checks++;
    await expectStatus(
      "learning-author",
      {
        user: "admin",
        body: {
          ...activities,
          lessons: [
            {
              id: "invalid",
              title: "Vídeo ruim",
              text: "Conteúdo original completo",
              video_url: "https://evil.test/embed/x",
            },
          ],
        },
      },
      400,
    );
    // Mentoring reservations enforce capacity in SQL and hide meeting URLs from strangers.
    const offer = await (
      await expectStatus(
        "service-admin",
        {
          user: "admin",
          body: {
            title: "Mentoria de demonstração",
            kind: "mentoria_individual",
            description:
              "Descrição suficiente para o encontro de demonstração.",
            terms: "Condições completas do encontro de demonstração gratuita.",
            price: 0,
            duration: 30,
            capacity: 1,
            status: "published",
          },
        },
        200,
      )
    ).json();
    const starts = new Date(Date.now() + 86400000).toISOString(),
      ends = new Date(Date.now() + 88200000).toISOString();
    await expectStatus(
      "service-admin",
      {
        user: "admin",
        body: {
          action: "slot",
          offer_id: offer.id,
          starts,
          ends,
          meeting_url: "https://meet.example.test/private",
        },
      },
      200,
    );
    const slots = (
      await (await call("service-slots?id=" + offer.id, { user: null })).json()
    ).slots;
    assert(!JSON.stringify(slots).includes("private"));
    checks++;
    await expectStatus(
      "service-bookings",
      { user: "learner", body: { slot_id: slots[0].id, accepted: true } },
      200,
    );
    await expectStatus(
      "service-bookings",
      { user: "student1", body: { slot_id: slots[0].id, accepted: true } },
      409,
    );
    assert(
      (
        await (await call("service-bookings", { user: "learner" })).text()
      ).includes("private"),
    );
    checks++;
    assert(
      !(
        await (await call("service-bookings", { user: "outsider" })).text()
      ).includes("private"),
    );
    checks++;
    const exported = await (
      await expectStatus("privacy-export", { user: "learner" }, 200)
    ).json();
    assert.equal(exported.quiz_attempts.length, 1);
    assert.equal(exported.bookings.length, 1);
    checks++;
    // Refund approval must be idempotent, revoke access and reconcile actual provider totals.
    const refundOrder = "refund-new-fixture",
      refundItem = "refund-new-item";
    db.prepare(
      "INSERT INTO orders(id,user_id,status,total,payment_intent,created) VALUES(?,?,'paid',500,?,?)",
    ).run(refundOrder, "learner", "pi_refundfixture", new Date().toISOString());
    db.prepare(
      "INSERT INTO order_items(id,order_id,product_id,title,price,content,author_id,commission_bps,owned,policy_version) VALUES(?,?,?,?,500,'','admin',0,1,'services-owned-v1')",
    ).run(refundItem, refundOrder, "refund-product", "Material para reembolso");
    await expectStatus(
      "refund-requests",
      {
        user: "outsider",
        body: {
          order_id: refundOrder,
          reason: "Solicitação indevida de outra conta.",
        },
      },
      404,
    );
    await expectStatus(
      "refund-requests",
      {
        user: "learner",
        body: {
          order_id: refundOrder,
          reason: "Motivo original do pedido de devolução.",
        },
      },
      200,
    );
    const refundRequest = db
      .prepare("SELECT id FROM refund_requests WHERE order_id=?")
      .get(refundOrder).id;
    await expectStatus(
      "refund-requests",
      { user: "learner", body: { action: "approve", id: refundRequest } },
      403,
    );
    const fetchBeforeBilling = globalThis.fetch;
    let refundCalls = 0;
    globalThis.fetch = async (url, options) => {
      if (String(url).endsWith("/refunds")) {
        refundCalls++;
        assert.equal(
          options.headers["Idempotency-Key"],
          "nimbus-refund:" + refundRequest,
        );
        assert.equal(options.body.get("amount"), "500");
        return Response.json({
          id: "re_fixture",
          status: "succeeded",
          amount: 500,
        });
      }
      if (String(url).includes("/payment_intents/pi_refundfixture"))
        return Response.json({
          status: "succeeded",
          latest_charge: {
            id: "ch_refundfixture",
            amount: 500,
            amount_refunded: 500,
            currency: "brl",
            balance_transaction: {
              id: "bt_refundfixture",
              fee: 50,
              currency: "brl",
              amount: 500,
              available_on: Math.floor(Date.now() / 1000),
            },
          },
        });
      throw Error("Unexpected provider endpoint " + url);
    };
    await expectStatus(
      "refund-requests",
      { user: "admin", body: { action: "approve", id: refundRequest } },
      200,
    );
    assert.equal(
      db.prepare("SELECT status FROM orders WHERE id=?").get(refundOrder)
        .status,
      "refunded",
    );
    assert.equal(
      db
        .prepare("SELECT refunded_gross FROM settlements WHERE id=?")
        .get(refundItem).refunded_gross,
      500,
    );
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) n FROM finance_events WHERE order_id=? AND type='hold'",
        )
        .get(refundOrder).n,
      0,
    );
    checks++;
    await expectStatus(
      "refund-requests",
      { user: "admin", body: { action: "approve", id: refundRequest } },
      409,
    );
    assert.equal(refundCalls, 1);
    checks++;
    // Subscription access is verified with the provider and uses the contracted catalog snapshot.
    const subProduct = "subscription-material-fixture";
    db.prepare(
      "INSERT INTO products(id,author_id,title,description,category,subject,format,price,pages,author,preview,status,file_key,file_name,accepted_bps,accepted_owned,created) VALUES(?,'admin','Material original de assinatura','Descrição original suficientemente completa','Saúde','Patologia','Resumo',1000,3,'Nimbus','Amostra original de assinatura','published','subscription-original.pdf','original.pdf',0,1,?)",
    ).run(subProduct, new Date().toISOString());
    objects.set("subscription-original.pdf", "%PDF-1.4 Original fixture");
    let providerSubStatus = "active";
    globalThis.fetch = async (url, opts) => {
      if (String(url).endsWith("/checkout/sessions")) {
        assert.equal(opts.body.get("mode"), "subscription");
        return Response.json({
          id: "cs_subfixture",
          url: "https://checkout.stripe.test/subscription",
        });
      }
      if (String(url).includes("/prices/price_fixture"))
        return Response.json({
          active: true,
          currency: "brl",
          unit_amount: 1500,
          recurring: { interval: "month" },
        });
      if (String(url).includes("/subscriptions/sub_fixture"))
        return Response.json({
          id: "sub_fixture",
          status: providerSubStatus,
          customer: "cus_fixture",
          items: {
            data: [
              {
                price: { id: "price_fixture" },
                current_period_end: Math.floor(Date.now() / 1000) + 86400,
              },
            ],
          },
          latest_invoice: {
            paid: providerSubStatus === "active",
            status: providerSubStatus === "active" ? "paid" : "open",
          },
        });
      throw Error("Unexpected subscription endpoint " + url);
    };
    const subPlan = await (
      await expectStatus(
        "subscription-admin",
        {
          user: "admin",
          body: {
            title: "Biblioteca teste",
            description: "Plano demonstrativo só do teste",
            product_ids: [subProduct],
            stripe_price_id: "price_fixture",
            status: "active",
          },
        },
        200,
      )
    ).json();
    await expectStatus(
      "subscription-checkout",
      { user: "subscriber", body: { plan_id: subPlan.id, accepted: true } },
      200,
    );
    const subLocalId = db
      .prepare("SELECT id FROM subscriptions WHERE user_id='subscriber'")
      .get().id;
    assert.equal(
      JSON.parse(
        db
          .prepare("SELECT assets FROM subscriptions WHERE id=?")
          .get(subLocalId).assets,
      )[0].file_key,
      "subscription-original.pdf",
    );
    checks++;

    await expectStatus("download/" + subProduct, { user: "subscriber" }, 403);
    async function signedNewEvent(id, type, object, valid = true) {
      const raw = JSON.stringify({ id, type, data: { object } }),
        t = String(Math.floor(Date.now() / 1000)),
        sig = createHmac("sha256", "whsec_fake")
          .update(t + "." + raw)
          .digest("hex");
      return expectStatus(
        "webhook",
        {
          user: null,
          method: "POST",
          raw,
          headers: {
            "stripe-signature": `t=${t},v1=${valid ? sig : "0".repeat(64)}`,
          },
        },
        valid ? 200 : 400,
      );
    }
    await signedNewEvent(
      "evt_sub_bad",
      "checkout.session.completed",
      {
        id: "cs_subfixture",
        mode: "subscription",
        subscription: "sub_fixture",
        metadata: { nimbus_subscription_id: subLocalId },
      },
      false,
    );
    await expectStatus("download/" + subProduct, { user: "subscriber" }, 403);
    await signedNewEvent("evt_sub_ok", "checkout.session.completed", {
      id: "cs_subfixture",
      mode: "subscription",
      subscription: "sub_fixture",
      metadata: { nimbus_subscription_id: subLocalId },
    });
    await expectStatus("download/" + subProduct, { user: "subscriber" }, 200);
    await expectStatus(
      "subscription-admin",
      {
        user: "admin",
        body: {
          id: subPlan.id,
          title: "Biblioteca teste",
          product_ids: [],
          stripe_price_id: "price_fixture",
          status: "active",
        },
      },
      409,
    );
    db.prepare(
      "UPDATE products SET status='draft',file_key='unapproved-file.pdf' WHERE id=?",
    ).run(subProduct);
    await expectStatus("download/" + subProduct, { user: "subscriber" }, 200);
    // Even a changed plan definition cannot add uncontracted products to this subscription.
    db.prepare("UPDATE subscription_plans SET product_ids='[]' WHERE id=?").run(
      subPlan.id,
    );
    await expectStatus("download/" + subProduct, { user: "subscriber" }, 200);
    providerSubStatus = "past_due";
    await signedNewEvent("evt_sub_late", "invoice.payment_failed", {
      id: "in_fixture",
      subscription: "sub_fixture",
    });
    await expectStatus("download/" + subProduct, { user: "subscriber" }, 403);
    globalThis.fetch = fetchBeforeBilling;
    await expectStatus("admin?section=produtos&page=1", { user: "admin" }, 200);

    const editorialVersions = await (
      await expectStatus(
        "editorial-versions?id=" + courseProduct,
        { user: "admin" },
        200,
      )
    ).json();
    await expectStatus(
      "editorial-versions?id=" + courseProduct,
      { user: "outsider" },
      403,
    );
    assert(editorialVersions.versions.length > 0);
    checks++;
    db.prepare(
      "INSERT INTO content_issues(id,user_id,product_id,page,message,status,response,created,updated) VALUES('version-link-test','learner',?,'2','Correção original para teste','open','',?,?)",
    ).run(courseProduct, new Date().toISOString(), new Date().toISOString());
    await expectStatus(
      "correction-version",
      {
        user: "outsider",
        body: {
          id: "version-link-test",
          version_id: editorialVersions.versions[0].id,
        },
      },
      403,
    );
    await expectStatus(
      "correction-version",
      {
        user: "admin",
        body: {
          id: "version-link-test",
          version_id: editorialVersions.versions[0].id,
          response: "Correção já incorporada nesta versão.",
        },
      },
      200,
    );
    assert.equal(
      db
        .prepare(
          "SELECT status FROM content_issues WHERE id='version-link-test'",
        )
        .get().status,
      "resolved",
    );
    checks++;
    const fullBackup = await (
      await call("backup-export", { user: "admin" })
    ).json();
    const recoveryDb = new DatabaseSync(":memory:");
    for (const file of (await readdir("drizzle"))
      .filter((x) => x.endsWith(".sql"))
      .sort())
      recoveryDb.exec(await readFile("drizzle/" + file, "utf8"));
    await restoreSnapshot(recoveryDb, fullBackup);
    assert.equal(
      recoveryDb.prepare("SELECT COUNT(*) n FROM service_bookings").get().n,
      fullBackup.tables.service_bookings.length,
    );
    assert.equal(
      recoveryDb
        .prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='trigger'")
        .get().n,
      db
        .prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='trigger'")
        .get().n,
    );
    recoveryDb.close();
    checks++;
  }
  {
    // Newly connected workflows: genuine PDF structure, access boundaries and financial snapshots.
    await expectStatus("integration-readiness", {}, 403);
    const readiness = await (
      await expectStatus("integration-readiness", { user: "admin" }, 200)
    ).json();
    assert.equal(readiness.payments.ready, true);
    assert.equal(readiness.payments.mode, "test");
    checks++;
    globalThis.__NIMBUS_TEST_ENV__.STRIPE_WEBHOOK_READY = "0";
    assert.equal(
      (await (await call("catalog", { user: null })).json()).payments,
      false,
    );
    checks++;
    await expectStatus(
      "subscription-checkout",
      { user: "gate-check", body: { accepted: true, plan_id: "none" } },
      503,
    );
    globalThis.__NIMBUS_TEST_ENV__.STRIPE_WEBHOOK_READY = "1";
    await expectStatus(
      "demand-board",
      { user: null, body: { title: "No auth" } },
      401,
    );
    await expectStatus(
      "demand-board",
      {
        user: "idea-author",
        body: {
          title: "Mapa de mecanismos de estudo",
          course: "Graduação",
          subject: "Métodos",
          description:
            "Quero relacionar os conceitos e praticar explicações sem consultar as respostas.",
        },
      },
      200,
    );
    const idea = (
      await (await call("demand-mine", { user: "idea-author" })).json()
    ).ideas[0];
    assert(
      !(await (await call("demand-board", { user: null })).json()).ideas.some(
        (x) => x.id === idea.id,
      ),
    );
    checks++;
    await expectStatus(
      "demand-admin",
      { user: "idea-author", body: { id: idea.id, status: "open" } },
      403,
    );
    await expectStatus(
      "demand-admin",
      {
        user: "admin",
        body: {
          id: idea.id,
          status: "open",
          response: "Tema recebido para avaliação editorial.",
        },
      },
      200,
    );
    await expectStatus(
      "demand-board",
      {
        user: "idea-voter",
        body: { action: "vote", id: idea.id, active: true },
      },
      200,
    );
    await expectStatus(
      "demand-board",
      {
        user: "idea-voter",
        body: { action: "vote", id: idea.id, active: true },
      },
      200,
    );
    assert.equal(
      (await (await call("demand-board", { user: null })).json()).ideas.find(
        (x) => x.id === idea.id,
      ).votes,
      1,
    );
    checks++;
    const demo = await (
      await expectStatus("demo-learning", { user: null }, 200)
    ).json();
    assert.equal(demo.questions.length, 3);
    assert(!("correct" in demo.questions[0]));
    checks++;
    const quiz = await (
      await expectStatus(
        "demo-quiz",
        { user: null, body: { answers: [1, 1, 2] } },
        200,
      )
    ).json();
    assert.equal(quiz.score, 3);
    checks++;
    await expectStatus(
      "demo-quiz",
      { user: null, body: { answers: [1] } },
      400,
    );
    const sources = await (
      await expectStatus(
        "demo-assistant",
        {
          user: null,
          body: { question: "Como conferir a resposta na revisão?" },
        },
        200,
      )
    ).json();
    assert(sources.sources.length > 0);
    assert(sources.sources.every((s) => s.page >= 1 && s.page <= 3));
    checks++;
    await expectStatus(
      "study-assistant",
      {
        user: "pdf-outsider",
        body: { product_id: saved.id, question: "Qual o conteúdo original?" },
      },
      403,
    );
    const pdfBytes = await fixturePdf(
      "Aprendizado original e revisao ativa com feedback.",
    );
    const pdfFile = new FormData();
    pdfFile.set("id", saved.id);
    pdfFile.set(
      "file",
      new File(["%PDF-1.4 broken"], "broken.pdf", { type: "application/pdf" }),
    );
    const badPdf = await POST(
      new Request("https://nimbus.test/api/upload", {
        method: "POST",
        headers: {
          origin: "https://nimbus.test",
          "oai-authenticated-user-id": "alice",
          "oai-authenticated-user-email": "alice@nimbus.test",
        },
        body: pdfFile,
      }),
    );
    assert.equal(badPdf.status, 400);
    checks++;
    // Existing paid purchase retains its original valid PDF and receives an opaque copy code.
    db.prepare(
      "INSERT INTO orders(id,user_id,status,total,created) VALUES('copy-pdf-fixture','alice','paid',1990,?)",
    ).run(new Date().toISOString());
    db.prepare(
      "INSERT INTO order_items(id,order_id,product_id,author_id,commission_bps,owned,policy_version,price,title,file_key,file_name,content) SELECT 'copy-pdf-item','copy-pdf-fixture',product_id,author_id,commission_bps,owned,policy_version,price,title,file_key,file_name,content FROM order_items WHERE order_id=? LIMIT 1",
    ).run(checkout.order);
    const marked = await expectStatus(
      "download/" + saved.id,
      { user: "alice" },
      200,
    );
    assert.equal(marked.headers.get("X-Nimbus-Watermark"), "applied");
    const markedBytes = new Uint8Array(await marked.arrayBuffer());
    const markedDoc = await PDFDocument.load(markedBytes);
    assert.equal(markedDoc.getPageCount(), 1);
    const copy = db
      .prepare("SELECT * FROM download_copies WHERE user_id=? AND product_id=?")
      .get("alice", saved.id);
    assert(copy);
    assert(!copy.copy_code.includes("alice"));
    checks++;
    await expectStatus(
      "copy-lookup?code=" + copy.copy_code,
      { user: "outsider" },
      403,
    );
    assert.equal(
      (
        await (
          await call("copy-lookup?code=" + copy.copy_code, { user: "admin" })
        ).json()
      ).copies.length,
      1,
    );
    checks++;
    await expectStatus(
      "product-policy",
      { user: "outsider", body: { product_id: saved.id, watermark: false } },
      403,
    );
    await expectStatus(
      "product-policy",
      {
        user: "alice",
        body: { product_id: saved.id, ai_enabled: true, watermark: true },
      },
      400,
    );
    await expectStatus(
      "product-policy",
      {
        user: "alice",
        body: {
          product_id: saved.id,
          ai_enabled: true,
          watermark: true,
          accepted: true,
        },
      },
      200,
    );
    assert.equal(
      (
        await (
          await call("study-assistant?id=" + saved.id, { user: "alice" })
        ).json()
      ).ai_available,
      false,
    );
    checks++;
    await expectStatus(
      "review-schedule",
      {
        user: "alice",
        body: {
          product_id: saved.id,
          next_review: "2020-01-01",
          pause_sales: true,
        },
      },
      200,
    );
    await expectStatus(
      "checkout",
      { user: "review-blocked", body: { ids: [saved.id], accepted: true } },
      409,
    );
    // Historical purchases remain accessible when new sales pause.
    await expectStatus("download/" + saved.id, { user: "alice" }, 200);
    await expectStatus("review-queue", { user: "pdf-outsider" }, 403);
    await expectStatus(
      "review-queue",
      {
        user: "admin",
        body: {
          product_id: saved.id,
          next_review: new Date(Date.now() + 30 * 86400000)
            .toISOString()
            .slice(0, 10),
          notes: "Conteúdo e referências conferidos para o teste.",
          checked: true,
        },
      },
      200,
    );
    await expectStatus(
      "permission-review",
      {
        user: "admin",
        body: {
          checked: true,
          notes: "Conferidas as permissões atuais da equipe e administração.",
        },
      },
      200,
    );
    await expectStatus("permission-review", { user: "outsider" }, 403);
    // Institution proposals keep prices and files fixed after explicit acceptance.
    await call("me", { user: "institution-buyer" });
    await call("me", { user: "affiliate-owner" });
    await call("me", { user: "referred-buyer" });
    await call("me", { user: "other-buyer" });
    const commercialId = "real-owned-workflow-test",
      commercialKey = "workflow-original.pdf";
    objects.set(commercialKey, pdfBytes);
    db.prepare(
      "INSERT INTO products(id,author_id,title,description,category,subject,course,format,price,pages,author,preview,status,file_key,file_name,accepted_bps,accepted_owned,created) VALUES(?,'admin','Roteiro original de revisão','Material original para validar a operação acadêmica','Saúde','Métodos','Graduação','Resumos e apostilas',3000,1,'Nimbus','Amostra original do conteúdo','published',?,'original.pdf',0,1,?)",
    ).run(commercialId, commercialKey, new Date().toISOString());
    await expectStatus(
      "institutions",
      {
        user: "institution-buyer",
        body: {
          organization: "Instituição de teste",
          course: "Graduação",
          message:
            "Desejamos disponibilizar estes materiais para uma turma de estudantes.",
          seats: 3,
          product_ids: [commercialId],
        },
      },
      200,
    );
    const proposal = (
      await (await call("institutions", { user: "institution-buyer" })).json()
    ).requests[0];
    await expectStatus(
      "institution-admin",
      { user: "outsider", body: { id: proposal.id, price: 0 } },
      403,
    );
    await expectStatus(
      "institution-admin",
      {
        user: "admin",
        body: {
          id: proposal.id,
          price: 0,
          seats: 3,
          scope:
            "Três licenças nominativas para avaliação interna, sem direito de redistribuir os arquivos.",
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      },
      200,
    );
    const quoted = (
      await (await call("institutions", { user: "institution-buyer" })).json()
    ).requests[0];
    assert(!("quoted_items" in quoted));
    assert(!("file_key" in quoted.items[0]));
    checks++;
    await expectStatus(
      "institutions",
      {
        user: "institution-buyer",
        body: { action: "accept", id: proposal.id, accepted: true },
      },
      200,
    );
    await expectStatus(
      "institution-admin",
      { user: "admin", body: { id: proposal.id, price: 1 } },
      409,
    );
    await expectStatus(
      "institution-checkout",
      { user: "other-buyer", body: { id: proposal.id } },
      409,
    );
    await expectStatus(
      "institution-checkout",
      { user: "institution-buyer", body: { id: proposal.id } },
      200,
    );
    assert.equal(
      db
        .prepare("SELECT seats FROM order_licenses WHERE order_id=?")
        .get(proposal.id).seats,
      3,
    );
    assert.equal(
      db
        .prepare("SELECT file_key FROM order_items WHERE order_id=?")
        .get(proposal.id).file_key,
      commercialKey,
    );
    checks++;
    await expectStatus(
      "partner-settings",
      { user: "outsider", body: { enabled: true } },
      403,
    );
    await expectStatus(
      "partner-settings",
      {
        user: "admin",
        body: {
          enabled: true,
          discount_percent: 10,
          student_reward: 500,
          min_total: 2000,
          affiliate_rate: 1000,
        },
      },
      200,
    );
    await expectStatus(
      "partners",
      { user: "affiliate-owner", body: { kind: "affiliate", accepted: true } },
      200,
    );
    let partner = (
      await (await call("partners", { user: "affiliate-owner" })).json()
    ).account;
    assert.equal(partner.status, "pending");
    checks++;
    await expectStatus(
      "partners-admin",
      {
        user: "admin",
        body: { user_id: "affiliate-owner", status: "approved" },
      },
      200,
    );
    await expectStatus(
      "referral-quote",
      {
        user: "affiliate-owner",
        body: { ids: [commercialId], code: partner.code },
      },
      400,
    );
    const referralQuote = await (
      await expectStatus(
        "referral-quote",
        {
          user: "referred-buyer",
          body: { ids: [commercialId], seats: 1, code: partner.code },
        },
        200,
      )
    ).json();
    assert.equal(referralQuote.discount, 300);
    assert.equal(referralQuote.total, 2700);
    checks++;
    let newSessionCalls = 0;
    globalThis.fetch = async (url, opts) => {
      assert(String(url).endsWith("/checkout/sessions"));
      newSessionCalls++;
      assert.equal(
        opts.body.get("line_items[0][price_data][unit_amount]"),
        "2700",
      );
      return Response.json({
        id: "cs_referral_workflow",
        url: "https://checkout.stripe.test/referral",
      });
    };
    const referred = await (
      await expectStatus(
        "checkout",
        {
          user: "referred-buyer",
          body: {
            ids: [commercialId],
            referral_code: partner.code,
            accepted: true,
            request_id: crypto.randomUUID(),
          },
        },
        200,
      )
    ).json();
    assert.equal(newSessionCalls, 1);
    assert.equal(
      db.prepare("SELECT total FROM orders WHERE id=?").get(referred.order)
        .total,
      2700,
    );
    checks++;
    await expectStatus(
      "referral-quote",
      {
        user: "referred-buyer",
        body: { ids: [commercialId], code: partner.code },
      },
      409,
    );
    const referredItem = db
        .prepare("SELECT id FROM order_items WHERE order_id=?")
        .get(referred.order),
      oldDate = new Date(Date.now() - 20 * 86400000).toISOString();
    db.prepare("UPDATE orders SET status='paid' WHERE id=?").run(
      referred.order,
    );
    db.prepare("UPDATE referral_sales SET created=? WHERE order_id=?").run(
      oldDate,
      referred.order,
    );
    db.prepare(
      "INSERT INTO settlements(id,order_id,author_id,gross,fee,rate,platform,author_net,refunded_gross,refunded_author,release_at,created) VALUES(?,?,'admin',2700,170,0,2530,0,0,0,?,?)",
    ).run(referredItem.id, referred.order, oldDate, oldDate);
    const released = await (
      await call("partners", { user: "affiliate-owner" })
    ).json();
    assert.equal(released.ledger.balances[0].available, 253);
    checks++;
    await expectStatus(
      "partner-payout",
      {
        user: "admin",
        body: {
          user_id: "affiliate-owner",
          amount: 254,
          reference: "external-overdraw-test",
        },
      },
      409,
    );
    await expectStatus(
      "partner-payout",
      {
        user: "admin",
        body: {
          user_id: "affiliate-owner",
          amount: 253,
          reference: "external-transfer-test",
        },
      },
      200,
    );
    await expectStatus(
      "partner-payout",
      {
        user: "admin",
        body: {
          user_id: "affiliate-owner",
          amount: 1,
          reference: "external-transfer-test-2",
        },
      },
      409,
    );
    db.prepare(
      "UPDATE settlements SET refunded_gross=2700 WHERE order_id=?",
    ).run(referred.order);
    const reversed = await (
      await call("partners", { user: "affiliate-owner" })
    ).json();
    assert.equal(reversed.ledger.balances[0].available, -253);
    checks++;
    // Payment recovery always checks original provider state and preserves frozen price.
    db.prepare(
      "UPDATE orders SET status='failed',session_id='cs_retry_old',checkout_url='https://checkout.stripe.test/old' WHERE id=?",
    ).run(referred.order);
    let renewalCalls = 0;
    globalThis.fetch = async (url, opts) => {
      if (String(url).endsWith("/cs_retry_old"))
        return Response.json({
          id: "cs_retry_old",
          status: "expired",
          amount_total: 2700,
          metadata: { order_id: referred.order },
        });
      assert(String(url).endsWith("/checkout/sessions"));
      renewalCalls++;
      assert.equal(
        opts.body.get("line_items[0][price_data][unit_amount]"),
        "2700",
      );
      assert.equal(
        opts.headers["Idempotency-Key"],
        "retry:" + referred.order + ":cs_retry_old",
      );
      return Response.json({
        id: "cs_retry_new",
        url: "https://checkout.stripe.test/new",
      });
    };
    await expectStatus(
      "order-retry",
      { user: "pdf-outsider", body: { id: referred.order } },
      404,
    );
    await expectStatus(
      "order-retry",
      { user: "referred-buyer", body: { id: referred.order } },
      200,
    );
    assert.equal(renewalCalls, 1);
    checks++;
    globalThis.fetch = async () =>
      Response.json({
        id: "cs_retry_new",
        status: "complete",
        amount_total: 2700,
        metadata: { order_id: referred.order },
      });
    await expectStatus(
      "order-retry",
      { user: "referred-buyer", body: { id: referred.order } },
      409,
    );
    globalThis.fetch = originalFetch;
    // Paid license holders search the exact contracted PDF rather than a public catalog replacement.
    const indexed = await (
      await expectStatus(
        "study-assistant",
        {
          user: "institution-buyer",
          body: {
            product_id: commercialId,
            question: "Como fazer revisao ativa com feedback?",
          },
        },
        200,
      )
    ).json();
    assert(
      indexed.sources.some((s) => s.page === 1 && s.text.includes("feedback")),
    );
    checks++;
    assert([...objects.keys()].some((k) => k.startsWith("study-index/")));
    checks++;
    await expectStatus(
      "review-schedule",
      {
        user: "admin",
        body: {
          product_id: commercialId,
          next_review: "2020-01-01",
          pause_sales: true,
        },
      },
      200,
    );
    await expectStatus(
      "checkout",
      {
        user: "new-review-buyer",
        body: { ids: [commercialId], accepted: true },
      },
      409,
    );
    await expectStatus(
      "download/" + commercialId,
      { user: "institution-buyer" },
      200,
    );
    await expectStatus(
      "review-queue",
      {
        user: "admin",
        body: {
          product_id: commercialId,
          next_review: new Date(Date.now() + 86400000)
            .toISOString()
            .slice(0, 10),
          notes: "Conferidas as fontes e a estrutura do material de teste.",
          checked: true,
        },
      },
      200,
    );
    await call("me", { user: "student-referrer" });
    await call("me", { user: "student-referral-buyer" });
    await expectStatus(
      "partners",
      { user: "student-referrer", body: { kind: "student", accepted: true } },
      200,
    );
    const studentPartner = (
      await (await call("partners", { user: "student-referrer" })).json()
    ).account;
    assert.equal(studentPartner.status, "approved");
    checks++;
    db.prepare(
      "INSERT INTO orders(id,user_id,status,total,created) VALUES('student-reward-fixture','student-referral-buyer','paid',2700,?)",
    ).run(oldDate);
    db.prepare(
      "INSERT INTO order_items(id,order_id,product_id,author_id,commission_bps,owned,policy_version,price,title,file_key,file_name,content) VALUES('student-reward-item','student-reward-fixture',?,'admin',0,1,'test',2700,'Material original',?,'original.pdf','')",
    ).run(commercialId, commercialKey);
    db.prepare(
      "INSERT INTO referral_sales(order_id,referrer_id,buyer_id,code,kind,rate_bps,reward_cents,min_total,discount,created) VALUES('student-reward-fixture','student-referrer','student-referral-buyer',?,'student',0,500,2000,300,?)",
    ).run(studentPartner.code, oldDate);
    db.prepare(
      "INSERT INTO settlements(id,order_id,author_id,gross,fee,rate,platform,author_net,refunded_gross,refunded_author,release_at,created) VALUES('student-reward-item','student-reward-fixture','admin',2700,170,0,2530,0,0,0,?,?)",
    ).run(oldDate, oldDate);
    const studentLedger = (
      await (await call("partners", { user: "student-referrer" })).json()
    ).ledger;
    const rewardCode = studentLedger.sales[0].reward.code;
    assert.equal(studentLedger.sales[0].reward.status, "issued");
    checks++;
    await expectStatus(
      "coupon-quote",
      { user: "other-buyer", body: { ids: [commercialId], code: rewardCode } },
      403,
    );
    const personalReward = await (
      await expectStatus(
        "coupon-quote",
        {
          user: "student-referrer",
          body: { ids: [commercialId], code: rewardCode },
        },
        200,
      )
    ).json();
    assert.equal(personalReward.discount, 500);
    checks++;
    db.prepare(
      "UPDATE settlements SET refunded_gross=2700 WHERE order_id=?",
    ).run("student-reward-fixture");
    await call("partners", { user: "student-referrer" });
    assert.equal(
      db.prepare("SELECT active FROM coupons WHERE code=?").get(rewardCode)
        .active,
      0,
    );
    checks++;

    // External document tracking never claims to have issued or signed anything by itself.
    await expectStatus(
      "documents",
      {
        user: "outsider",
        body: { kind: "invoice", order_id: "copy-pdf-fixture" },
      },
      403,
    );
    await expectStatus(
      "documents",
      {
        user: "alice",
        body: { kind: "invoice", order_id: "copy-pdf-fixture" },
      },
      200,
    );
    const fiscal = (await (await call("documents", { user: "alice" })).json())
      .documents[0];
    assert.equal(fiscal.status, "requested");
    checks++;
    await expectStatus(
      "documents-admin",
      {
        user: "admin",
        body: {
          id: fiscal.id,
          status: "issued",
          reference: "NF-test-001",
          url: "javascript:alert(1)",
          verified: true,
        },
      },
      400,
    );
    await expectStatus(
      "documents-admin",
      {
        user: "admin",
        body: {
          id: fiscal.id,
          status: "issued",
          reference: "NF-test-001",
          url: "https://fiscal.example/document/1",
        },
      },
      400,
    );
    await expectStatus(
      "documents-admin",
      {
        user: "admin",
        body: {
          id: fiscal.id,
          status: "issued",
          reference: "NF-test-001",
          url: "https://fiscal.example/document/1",
          verified: true,
        },
      },
      200,
    );
    assert.equal(
      (await (await call("documents", { user: "outsider" })).json()).documents
        .length,
      0,
    );
    checks++;
    await expectStatus(
      "tickets",
      {
        user: "student-referrer",
        body: {
          subject: "Dúvida sobre outro pedido",
          message: "Preciso confirmar a entrega deste material.",
          order_id: "copy-pdf-fixture",
        },
      },
      403,
    );
    await expectStatus(
      "tickets",
      {
        user: "alice",
        body: {
          subject: "Dúvida sobre meu pedido",
          message: "Preciso de informações sobre o arquivo que adquiri.",
          order_id: "copy-pdf-fixture",
        },
      },
      200,
    );
    const ownTicket = (await (await call("tickets", { user: "alice" })).json())
      .tickets[0];
    await expectStatus(
      "support-thread?id=" + ownTicket.id,
      { user: "other-buyer" },
      404,
    );
    await expectStatus(
      "admin",
      {
        user: "admin",
        body: {
          action: "ticket",
          id: ownTicket.id,
          response: "O arquivo está disponível na sua biblioteca.",
        },
      },
      200,
    );
    await expectStatus(
      "support-thread",
      {
        user: "alice",
        body: {
          id: ownTicket.id,
          message: "Obrigado. Preciso ainda conferir a versão do documento.",
        },
      },
      200,
    );
    const thread = await (
      await call("support-thread?id=" + ownTicket.id, { user: "alice" })
    ).json();
    assert.equal(thread.ticket.status, "open");
    assert.equal(thread.ticket.order_id, "copy-pdf-fixture");
    assert.equal(thread.messages.length, 2);
    checks++;
    const exported = await (
      await expectStatus("privacy-export", { user: "affiliate-owner" }, 200)
    ).json();
    assert.equal(exported.partner_account.length, 1);
    assert(
      exported.affiliate_payouts.every((x) => x.user_id === "affiliate-owner"),
    );
    checks++;
  }
  {
    // Editorial transparency, purchase terms, private feedback and consented demand signals.
    const id = "experience-free-fixture",
      at = new Date().toISOString();
    db.prepare(
      "INSERT INTO products(id,author_id,title,description,category,subject,course,format,price,pages,author,preview,status,file_key,file_name,accepted_bps,accepted_owned,objectives,sources,created,updated) VALUES(?,'admin','Guia de revisão com fontes','Guia original com exemplos de estudo e questões para revisão','Saúde','Métodos','Graduação','Guias práticos',0,1,'Nimbus','Esta amostra textual apresenta objetivos e um exemplo de revisão ativa.','published','workflow-original.pdf','original.pdf',0,1,'Explicar os fundamentos da revisão ativa.','Referências de estudo conferidas pelo autor.',?,?)",
    ).run(id, at, at);
    await expectStatus(
      "material-experience?id=not-a-product",
      { user: null },
      404,
    );
    const initial = await (
      await expectStatus("material-experience?id=" + id, { user: null }, 200)
    ).json();
    assert(initial.transparency.items.some((i) => i.status === "registered"));
    assert(!initial.transparency.items.some((i) => i.status === "reviewed"));
    checks++;
    await expectStatus(
      "experience-editor",
      {
        user: "policy-outsider",
        body: {
          product_id: id,
          update_policy:
            "Política não autorizada para testar alterações indevidas.",
          sample_descriptions: [],
          confirmed: true,
        },
      },
      403,
    );
    const oldTerms =
      "Inclui o arquivo adquirido e as versões publicadas deste mesmo material. Não inclui novos produtos nem mentorias. Política de teste A.";
    await expectStatus(
      "experience-editor",
      {
        user: "admin",
        body: {
          product_id: id,
          update_policy: oldTerms,
          sample_descriptions: [
            "Esquema de revisão com perguntas e respostas.",
          ],
          confirmed: true,
        },
      },
      200,
    );
    assert.equal(
      db.prepare("SELECT status FROM products WHERE id=?").get(id).status,
      "draft",
    );
    checks++;
    await expectStatus("material-experience?id=" + id, { user: null }, 404);
    const launch = await (
      await expectStatus("launch-check?id=" + id, { user: "admin" }, 200)
    ).json();
    assert(launch.items.find((i) => i.id === "file").ready);
    assert(launch.items.find((i) => i.id === "updates").ready);
    assert(!launch.items.find((i) => i.id === "review").ready);
    checks++;
    await expectStatus(
      "launch-check?id=" + id,
      { user: "policy-outsider" },
      403,
    );
    await expectStatus(
      "admin",
      {
        user: "admin",
        body: {
          action: "product",
          id,
          status: "published",
          reviewed: true,
          review_checks: ["sources", "legibility", "rights"],
        },
      },
      200,
    );
    const reviewed = await (
      await call("material-experience?id=" + id, { user: null })
    ).json();
    assert.equal(
      reviewed.sample_descriptions[0],
      "Esquema de revisão com perguntas e respostas.",
    );
    assert(
      reviewed.transparency.items.find((i) => i.id === "sources").status ===
        "reviewed",
    );
    assert(
      reviewed.transparency.items.find((i) => i.id === "answers").status ===
        "not_recorded",
    );
    checks++;
    const acquisition = await (
      await expectStatus(
        "checkout",
        {
          user: "policy-student",
          body: { ids: [id], accepted: true, request_id: crypto.randomUUID() },
        },
        200,
      )
    ).json();
    const frozen = db
      .prepare(
        "SELECT terms FROM order_update_terms WHERE order_id=? AND product_id=?",
      )
      .get(acquisition.order, id);
    assert.equal(frozen.terms, oldTerms);
    checks++;
    const newerTerms =
      "Inclui o arquivo adquirido e as versões publicadas deste mesmo material, sem novos produtos ou suporte individual. Política de teste B.";
    await expectStatus(
      "experience-editor",
      {
        user: "admin",
        body: {
          product_id: id,
          update_policy: newerTerms,
          sample_descriptions: [],
          confirmed: true,
        },
      },
      200,
    );
    assert.equal(
      db
        .prepare(
          "SELECT terms FROM order_update_terms WHERE order_id=? AND product_id=?",
        )
        .get(acquisition.order, id).terms,
      oldTerms,
    );
    checks++;
    const historic = await (
      await call("order-detail?id=" + acquisition.order, {
        user: "policy-student",
      })
    ).json();
    assert.equal(historic.update_terms[0].terms, oldTerms);
    checks++;
    await expectStatus(
      "study-feedback",
      {
        user: "policy-outsider",
        body: {
          product_id: id,
          helpfulness: 5,
          difficulty: "adequate",
          consent: true,
        },
      },
      403,
    );
    await expectStatus(
      "study-feedback",
      {
        user: "policy-student",
        body: { product_id: id, helpfulness: 5, difficulty: "adequate" },
      },
      400,
    );
    await expectStatus(
      "study-feedback",
      {
        user: "policy-student",
        body: {
          product_id: id,
          helpfulness: 5,
          difficulty: "adequate",
          missing: "Gostaria de mais exemplos originais.",
          consent: true,
        },
      },
      200,
    );
    await expectStatus(
      "study-feedback",
      {
        user: "policy-student",
        body: {
          product_id: id,
          helpfulness: 4,
          difficulty: "too_hard",
          missing: "Um glossário ajudaria.",
          consent: true,
        },
      },
      200,
    );
    assert.equal(
      db
        .prepare("SELECT COUNT(*) n FROM study_feedback WHERE product_id=?")
        .get(id).n,
      1,
    );
    checks++;
    await expectStatus(
      "feedback-report?id=" + id,
      { user: "policy-outsider" },
      403,
    );
    const report = await (
      await call("feedback-report?id=" + id, { user: "admin" })
    ).json();
    assert.equal(report.feedback[0].helpfulness, 4);
    assert(!("user_id" in report.feedback[0]));
    checks++;
    const visitor = crypto.randomUUID();
    await expectStatus(
      "search-signal",
      {
        user: null,
        body: {
          query: "quero um tema indisponível",
          visitor,
          course: "Graduação",
          subject: "Métodos",
          consent: false,
        },
      },
      400,
    );
    await expectStatus(
      "search-signal",
      {
        user: null,
        body: {
          query: "quero um tema indisponível",
          visitor,
          course: "Graduação",
          subject: "Métodos",
          consent: true,
        },
      },
      200,
    );
    await expectStatus(
      "search-signal",
      {
        user: null,
        body: {
          query: "quero um tema indisponível",
          visitor,
          course: "Graduação",
          subject: "Métodos",
          consent: true,
        },
      },
      200,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM search_signals").get().n,
      1,
    );
    assert.equal(
      db.prepare("SELECT kind FROM search_signals").get().kind,
      "empty",
    );
    assert(
      !db
        .prepare("PRAGMA table_info(search_signals)")
        .all()
        .some((c) => ["query", "visitor", "user_id"].includes(c.name)),
    );
    checks++;
    await expectStatus(
      "search-signal",
      {
        user: null,
        body: {
          query: "foo",
          visitor,
          course: "Curso inventado",
          consent: true,
        },
      },
      400,
    );
    await expectStatus("demand-insights", { user: "policy-student" }, 403);
    const insights = await (
      await expectStatus("demand-insights", { user: "admin" }, 200)
    ).json();
    assert(
      insights.searches.some(
        (i) => i.kind === "empty" && i.course === "Graduação",
      ),
    );
    checks++;
    await expectStatus("launch-readiness", { user: "policy-student" }, 403);
    await expectStatus(
      "launch-readiness",
      {
        user: "admin",
        body: {
          id: "payments",
          checked: true,
          notes:
            "Tentativa de alterar configuração automática sem credenciais.",
        },
      },
      400,
    );
    await expectStatus(
      "launch-readiness",
      {
        user: "admin",
        body: {
          id: "support_test",
          checked: true,
          notes:
            "Conferido o atendimento com abertura, resposta e reabertura de chamado.",
        },
      },
      200,
    );
    const readiness = await (
      await call("launch-readiness", { user: "admin" })
    ).json();
    assert(readiness.manual.support_test.checked);
    assert.equal(
      readiness.automated.find((i) => i.id === "email").ready,
      false,
    );
    checks++;
    const tasks = (
      await (await call("usability-tasks", { user: null })).json()
    ).tasks.map((t) => ({ id: t.id, result: "not_tested" }));
    await expectStatus(
      "usability-feedback",
      {
        user: "policy-student",
        body: {
          tasks,
          device: "mobile",
          notes: "Roteiro de teste para validar o formulário.",
          consent: false,
        },
      },
      400,
    );
    await expectStatus(
      "usability-feedback",
      {
        user: "policy-student",
        body: {
          tasks,
          device: "mobile",
          notes: "Roteiro de teste para validar o formulário.",
          consent: true,
        },
      },
      200,
    );
    await expectStatus("usability-feedback", { user: "policy-student" }, 403);
    const sessions = (
      await (await call("usability-feedback", { user: "admin" })).json()
    ).sessions;
    assert.equal(sessions.length, 1);
    assert(!("user_id" in sessions[0]));
    checks++;
    const exported = await (
      await call("privacy-export", { user: "policy-student" })
    ).json();
    assert.equal(exported.study_feedback.length, 1);
    assert.equal(exported.usability_sessions.length, 1);
    checks++;
    await expectStatus(
      "study-feedback",
      { user: "policy-student", body: { product_id: id, action: "delete" } },
      200,
    );
    assert.equal(
      db
        .prepare("SELECT COUNT(*) n FROM study_feedback WHERE product_id=?")
        .get(id).n,
      0,
    );
    checks++;
  }

  {
    const id = "experience-free-fixture";
    await expectStatus(
      "sales-maintenance",
      {
        user: "policy-student",
        body: { paused: true, message: "Pausa indevida de vendas." },
      },
      403,
    );
    await expectStatus(
      "sales-maintenance",
      {
        user: "admin",
        body: {
          paused: true,
          message: "Conferência operacional em andamento.",
        },
      },
      200,
    );
    assert.equal(
      (await (await call("service-status", { user: null })).json()).sales
        .paused,
      true,
    );
    checks++;
    await expectStatus(
      "subscription-checkout",
      { user: "policy-student", body: { accepted: true, plan_id: "none" } },
      503,
    );
    await expectStatus("download/" + id, { user: "policy-student" }, 200);
    await expectStatus(
      "sales-maintenance",
      {
        user: "admin",
        body: { paused: false, message: "Conferência operacional concluída." },
      },
      200,
    );
    await expectStatus(
      "editorial-tools-edit",
      {
        user: "policy-student",
        body: {
          product_id: id,
          glossary: [],
          atlas: [],
          rights: true,
          deidentified: true,
        },
      },
      403,
    );
    const glossary = [
      {
        term: "Revisão ativa",
        definition: "Responder uma pergunta antes de conferir a fonte.",
      },
    ];
    await expectStatus(
      "editorial-tools-edit",
      {
        user: "admin",
        body: {
          product_id: id,
          glossary,
          atlas: [],
          rights: false,
          deidentified: true,
        },
      },
      400,
    );
    await expectStatus(
      "editorial-tools-edit",
      {
        user: "admin",
        body: {
          product_id: id,
          glossary,
          atlas: [],
          rights: true,
          deidentified: true,
        },
      },
      200,
    );
    assert.equal(
      (
        await (
          await call("editorial-tools?id=" + id, { user: "policy-student" })
        ).json()
      ).tools.glossary,
      undefined,
    );
    checks++;
    await expectStatus(
      "admin",
      {
        user: "admin",
        body: { action: "product", id, status: "published", reviewed: true },
      },
      200,
    );
    assert.equal(
      (
        await (
          await call("editorial-tools?id=" + id, { user: "policy-student" })
        ).json()
      ).tools.glossary[0].term,
      "Revisão ativa",
    );
    checks++;
    await expectStatus(
      "editorial-tools?id=" + id,
      { user: "policy-outsider" },
      403,
    );
    await expectStatus(
      "evolution-admin",
      { user: "policy-student", body: { kind: "incident" } },
      403,
    );
    const path = await (
      await expectStatus(
        "evolution-admin",
        {
          user: "admin",
          body: {
            kind: "path",
            title: "Métodos de estudo — primeiro semestre",
            body: "Sequência sugerida de leitura e prática com os materiais originais.",
            course: "Graduação",
            semester: "1º semestre",
            product_ids: [id],
            status: "published",
          },
        },
        200,
      )
    ).json();
    const publicPaths = await (
      await call("study-paths", { user: null })
    ).json();
    assert.equal(
      publicPaths.paths.find((p) => p.id === path.id).items[0].id,
      id,
    );
    assert(!("file_key" in publicPaths.paths[0].items[0]));
    checks++;
    await expectStatus(
      "evolution-admin",
      {
        user: "admin",
        body: {
          id: path.id,
          kind: "incident",
          title: "Tipo não pode mudar",
          body: "Tentativa inválida de alterar o tipo do registro existente.",
          product_ids: [],
          status: "published",
        },
      },
      409,
    );
    const correction = await (
      await expectStatus(
        "evolution-admin",
        {
          user: "admin",
          body: {
            kind: "errata",
            title: "Correção do exemplo de revisão",
            body: "Na primeira página, considere a pergunta e confira a resposta na fonte antes de marcar acerto.",
            product_ids: [id],
            status: "published",
          },
        },
        200,
      )
    ).json();
    assert.equal(
      (await (await call("material-errata?id=" + id, { user: null })).json())
        .errata.length,
      1,
    );
    assert(
      db
        .prepare(
          "SELECT COUNT(*) n FROM notifications WHERE user_id='policy-student' AND title LIKE 'Correção importante:%'",
        )
        .get().n > 0,
    );
    checks++;
    await expectStatus(
      "evolution-admin",
      {
        user: "admin",
        body: {
          id: correction.id,
          kind: "errata",
          title: "Alteração posterior proibida",
          body: "Uma correção publicada deve manter o histórico do que foi comunicado.",
          product_ids: [id],
          status: "draft",
        },
      },
      409,
    );
    await expectStatus(
      "evolution-admin",
      {
        user: "admin",
        body: {
          kind: "incident",
          title: "Teste de comunicado de serviço",
          body: "Foi identificada uma dificuldade de acesso e a equipe está conferindo o serviço.",
          product_ids: [],
          status: "published",
        },
      },
      200,
    );
    assert.equal(
      (await (await call("service-status", { user: null })).json()).incidents
        .length,
      1,
    );
    checks++;
    await expectStatus("recurring-questions", { user: "policy-student" }, 403);
    await expectStatus("recurring-questions", { user: "admin" }, 200);
    await expectStatus(
      "version-compare?id=" + id + "&a=wrong&b=other",
      { user: "policy-outsider" },
      403,
    );
    await expectStatus(
      "version-compare?id=" + id + "&a=wrong&b=other",
      { user: "policy-student" },
      400,
    );
    objects.set(
      "compare-before.pdf",
      await fixturePdf("Texto original antes da revisao."),
    );
    objects.set(
      "compare-after.pdf",
      await fixturePdf("Texto corrigido depois da revisao."),
    );
    for (const [key, seq] of [
      ["compare-before", 1],
      ["compare-after", 2],
    ])
      db.prepare(
        "INSERT INTO product_versions(id,product_id,sequence,file_key,file_name,notes,status,created,released) VALUES(?,?,?,?,?,'Comparação de teste','published',?,?)",
      ).run(
        key,
        id,
        seq,
        key + ".pdf",
        "original.pdf",
        new Date().toISOString(),
        new Date().toISOString(),
      );
    const comparison = await (
      await expectStatus(
        "version-compare?id=" + id + "&a=compare-before&b=compare-after",
        { user: "policy-student" },
        200,
      )
    ).json();
    assert.equal(comparison.total, 1);
    assert(comparison.changes[0].before.includes("original"));
    assert(comparison.changes[0].after.includes("corrigido"));
    checks++;
    db.prepare("UPDATE products SET preview_keys=? WHERE id=?").run(
      JSON.stringify(["atlas-original.png"]),
      id,
    );
    objects.set("atlas-original.png", new Uint8Array([137, 80, 78, 71]));
    const atlas = [
      {
        image: 0,
        caption: "Imagem original com descrição anatômica para estudo.",
        source: "Arquivo autoral autorizado",
        question: "Que estrutura foi marcada?",
        answer: "Confira a legenda numerada.",
        points: [{ x: 50, y: 50, label: "Estrutura de interesse" }],
      },
    ];
    await expectStatus(
      "editorial-tools-edit",
      {
        user: "admin",
        body: {
          product_id: id,
          glossary,
          atlas,
          rights: true,
          deidentified: true,
        },
      },
      200,
    );
    await expectStatus(
      "admin",
      {
        user: "admin",
        body: { action: "product", id, status: "published", reviewed: true },
      },
      200,
    );
    const publishedAtlas = (
      await (
        await call("editorial-tools?id=" + id, { user: "policy-student" })
      ).json()
    ).tools.atlas;
    assert.equal(publishedAtlas[0].points[0].x, 50);
    checks++;
  }

  {
    const id = "experience-free-fixture";
    const guideSearch = await (
      await call("academic-search?q=Seu%20plano%20de%20estudos", { user: null })
    ).json();
    assert(guideSearch.products.some((p) => p.id === "planejamento-academico"));
    checks++;

    const qs = [
      {
        id: "adv-one",
        prompt: "Qual conceito está no primeiro tema?",
        options: ["Certa", "Segunda", "Terceira", "Quarta"],
        correct: 0,
        explanation: "Conferir a página um.",
        topic: "Método",
        difficulty: "easy",
        page: 1,
        option_explanations: [
          "Correta pelo método",
          "Não corresponde",
          "Falta evidência",
          "Não corresponde",
        ],
      },
      {
        id: "adv-two",
        prompt: "Qual conceito avançado consta do segundo tema?",
        options: ["A", "B", "C", "D"],
        correct: 1,
        explanation: "Conferir a página dois.",
        topic: "Revisão",
        difficulty: "hard",
        page: 2,
      },
    ];
    db.prepare(
      "INSERT INTO learning_packages(product_id,cards,questions,lessons,published_cards,published_questions,published_lessons,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET published_questions=excluded.published_questions,published_cards=excluded.published_cards",
    ).run(
      id,
      "[]",
      "[]",
      "[]",
      JSON.stringify([
        {
          id: "adv-card",
          front: "Conceito de revisão",
          back: "Resposta de referência",
        },
      ]),
      JSON.stringify(qs),
      "[]",
      new Date().toISOString(),
    );
    await expectStatus("practice?id=" + id, { user: "policy-outsider" }, 403);
    await expectStatus(
      "study-card-review?id=" + id,
      { user: "policy-student" },
      405,
    );
    const active = await (
      await call("practice", {
        user: "policy-student",
        body: {
          product_id: id,
          action: "start",
          count: 10,
          minutes: 10,
          topic: "Método",
          difficulty: "easy",
        },
      })
    ).json();
    assert.equal(active.session.questions.length, 1);
    assert.equal(active.session.questions[0].correct, undefined);
    assert.equal(active.session.questions[0].option_explanations, undefined);
    assert.equal(active.session.questions[0].explanation, undefined);
    checks += 4;
    const sid = active.session.id;
    const earlyExport = await (
      await call("privacy-export", { user: "policy-student" })
    ).json();
    const earlyQuestions = JSON.parse(
      earlyExport.practice_sessions.find((s) => s.id === sid).questions,
    );
    assert.equal(earlyQuestions[0].correct, undefined);
    checks++;

    const resumed = await (
      await call("practice", {
        user: "policy-student",
        body: { product_id: id, action: "start", count: 1 },
      })
    ).json();
    assert.equal(resumed.session.id, sid);
    checks++;
    await expectStatus(
      "practice",
      {
        user: "policy-outsider",
        body: {
          product_id: id,
          action: "finish",
          session_id: sid,
          answers: [0],
        },
      },
      403,
    );
    await expectStatus(
      "practice",
      {
        user: "policy-student",
        body: { product_id: id, action: "save", session_id: sid, answers: [9] },
      },
      400,
    );
    await expectStatus(
      "practice",
      {
        user: "policy-student",
        body: { product_id: id, action: "save", session_id: sid, answers: [0] },
      },
      200,
    );
    db.prepare(
      "UPDATE learning_packages SET published_questions=? WHERE product_id=?",
    ).run(JSON.stringify(qs.map((q) => ({ ...q, correct: 3 }))), id);
    const completed = await (
      await call("practice", {
        user: "policy-student",
        body: {
          product_id: id,
          action: "finish",
          session_id: sid,
          answers: [0],
        },
      })
    ).json();
    assert.equal(completed.session.score, 1);
    assert.equal(
      completed.session.feedback[0].options[0].explanation,
      qs[0].option_explanations[0],
    );
    checks += 2;
    const repeat = await (
      await call("practice", {
        user: "policy-student",
        body: {
          product_id: id,
          action: "finish",
          session_id: sid,
          answers: [3],
        },
      })
    ).json();
    assert.equal(repeat.session.score, 1);
    checks++;
    const timed = await (
      await call("practice", {
        user: "policy-student",
        body: { product_id: id, action: "start", count: 1, minutes: 1 },
      })
    ).json();
    db.prepare("UPDATE practice_sessions SET deadline=? WHERE id=?").run(
      "2000-01-01T00:00:00.000Z",
      timed.session.id,
    );
    const expired = await (
      await call("practice", {
        user: "policy-student",
        body: {
          product_id: id,
          action: "finish",
          session_id: timed.session.id,
          answers: [3],
        },
      })
    ).json();
    assert.equal(expired.session.score, 0);
    assert.equal(expired.session.status, "completed");
    checks += 2;
    await expectStatus(
      "study-cards",
      {
        user: "policy-student",
        body: {
          product_id: id,
          front: "Minha pergunta",
          back: "Minha anotação privada",
          page: 1,
        },
      },
      200,
    );
    const cards = await (
      await call("study-cards?id=" + id, { user: "policy-student" })
    ).json();
    const personal = cards.cards.find((c) => c.personal);
    assert(personal);
    checks++;
    const review = {
      product_id: id,
      card_id: personal.id,
      rating: "hard",
      request_id: crypto.randomUUID(),
    };
    await expectStatus(
      "study-card-review",
      { user: "policy-student", body: review },
      200,
    );
    await expectStatus(
      "study-card-review",
      { user: "policy-student", body: review },
      200,
    );
    const stored = db
      .prepare("SELECT * FROM adaptive_reviews WHERE card_id=?")
      .get(personal.id);
    assert.equal(stored.repetitions, 1);
    assert.equal(stored.interval, 1);
    assert.equal(stored.lapses, 1);
    checks += 3;
    await expectStatus(
      "study-card-review",
      { user: "policy-student", body: { ...review, card_id: "adv-card" } },
      409,
    );
    await expectStatus(
      "study-card-review",
      {
        user: "policy-student",
        body: {
          ...review,
          request_id: crypto.randomUUID(),
          exam_date: "2000-01-01",
        },
      },
      400,
    );
    await expectStatus(
      "academic-metadata",
      {
        user: "policy-student",
        body: { product_id: id, institution: "Outro autor" },
      },
      403,
    );
    const todayReview = await (
      await call("study-card-review", {
        user: "policy-student",
        body: {
          ...review,
          request_id: crypto.randomUUID(),
          exam_date: new Date().toISOString().slice(0, 10),
          rating: "easy",
        },
      })
    ).json();
    assert.equal(todayReview.due, new Date().toISOString().slice(0, 10));
    assert.equal(todayReview.interval, 0);
    checks += 2;
    await expectStatus(
      "study-card-review",
      {
        user: "policy-student",
        body: {
          ...review,
          request_id: crypto.randomUUID(),
          exam_date: "2027-02-30",
        },
      },
      400,
    );
    await expectStatus(
      "academic-metadata",
      {
        user: "admin",
        body: {
          product_id: id,
          institution: "Instituto Teste Nimbus",
          course_code: "NIM-2026",
          isbn: "978-85-0000-000-0",
          edition: "2",
        },
      },
      200,
    );
    let found = await (
      await call("academic-search?q=NIM-2026", { user: null })
    ).json();
    assert(!found.products.some((p) => p.id === id));
    checks++;
    await expectStatus(
      "admin",
      {
        user: "admin",
        body: { action: "product", id, status: "published", reviewed: true },
      },
      200,
    );
    found = await (
      await call("academic-search?q=NIM-2026", { user: null })
    ).json();
    assert(found.products.some((p) => p.id === id));
    assert(!JSON.stringify(found).includes("file_key"));
    checks += 2;
    await expectStatus(
      "editorial-ai",
      {
        user: "policy-student",
        body: { product_id: id, kind: "cards", consent: true, rights: true },
      },
      403,
    );
    await expectStatus(
      "editorial-ai",
      {
        user: "admin",
        body: { product_id: id, kind: "cards", consent: true, rights: true },
      },
      503,
    );
    db.prepare(
      "INSERT INTO ai_editorial_drafts(id,user_id,product_id,kind,data,sources,created) VALUES(?,?,?,?,?,?,?)",
    ).run(
      "draft-test",
      "admin",
      id,
      "cards",
      JSON.stringify({
        cards: [
          {
            front: "Pergunta criada para revisão humana",
            back: "Resposta a ser conferida.",
          },
        ],
        questions: [],
        glossary: [],
        map: [],
      }),
      "[]",
      new Date().toISOString(),
    );
    await expectStatus(
      "editorial-ai",
      {
        user: "admin",
        body: { product_id: id, action: "adopt", draft_id: "draft-test" },
      },
      400,
    );
    await expectStatus(
      "editorial-ai",
      {
        user: "admin",
        body: {
          product_id: id,
          action: "adopt",
          draft_id: "draft-test",
          reviewed: true,
        },
      },
      200,
    );
    await expectStatus(
      "editorial-ai",
      {
        user: "admin",
        body: {
          product_id: id,
          action: "adopt",
          draft_id: "draft-test",
          reviewed: true,
        },
      },
      200,
    );
    const pkg = db
      .prepare("SELECT * FROM learning_packages WHERE product_id=?")
      .get(id);
    assert.equal(JSON.parse(pkg.cards).length, 1);
    assert.equal(JSON.parse(pkg.published_cards).length, 0);
    assert.equal(
      db.prepare("SELECT status FROM products WHERE id=?").get(id).status,
      "draft",
    );
    checks += 3;
    const exp = await (
      await call("privacy-export", { user: "policy-student" })
    ).json();
    assert(exp.personal_cards.some((c) => c.front === "Minha pergunta"));
    assert(exp.practice_sessions.some((s) => s.id === sid));
    checks += 2;
  }

  console.log(
    `Nimbus: ${checks} verificações de integração aprovadas (SQLite real em memória + R2/Stripe simulados).`,
  );
} finally {
  db.close();
  await rm(temp, { recursive: true, force: true });
  delete globalThis.__NIMBUS_TEST_ENV__;
}
