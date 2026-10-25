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
  };
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
  globalThis.fetch = originalFetch;
  await expectStatus("download/" + saved.id, {}, 403);
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
  const orders = await (await call("orders")).json();
  assert.equal(orders.orders.find((o) => o.id === checkout.order).total, 1990);
  checks++;
  await expectStatus("download/" + saved.id, { user: "bob" }, 403);
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
  console.log(
    `Nimbus: ${checks} verificações de integração aprovadas (SQLite real em memória + R2/Stripe simulados).`,
  );
} finally {
  db.close();
  await rm(temp, { recursive: true, force: true });
  delete globalThis.__NIMBUS_TEST_ENV__;
}
