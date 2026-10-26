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
let batchCounter = 0;
const objects = new Map();
globalThis.__NIMBUS_TEST_ENV__ = {
  DB: {
    prepare: (sql) => new Statement(sql),
    async batch(statements) {
      const point = "batch_" + ++batchCounter;
      db.exec("SAVEPOINT " + point);
      try {
        const r = [];
        for (const s of statements) r.push(await s.run());
        db.exec("RELEASE " + point);
        return r;
      } catch (e) {
        db.exec("ROLLBACK TO " + point);
        db.exec("RELEASE " + point);
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
  const { runStress } = await import("./stress-scenarios.mjs");
  await runStress({ db, call, POST, objects, temp, fixturePdf });
} finally {
  db.close();
  await rm(temp, { recursive: true, force: true });
  delete globalThis.__NIMBUS_TEST_ENV__;
}
