// Isolated API/property stress suite. Never calls a real provider or production URL.
import assert from "node:assert/strict";
import { createHmac, createHash } from "node:crypto";
import { writeFile, readFile, readdir, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { performance } from "node:perf_hooks";
import { build } from "esbuild";
import { restoreSnapshot } from "../scripts/restore-backup.mjs";
export async function runStress({ db, call, POST, objects, temp, fixturePdf }) {
  const rounds = Number(process.env.NIMBUS_STRESS_ROUNDS || 30000);
  assert(
    Number.isInteger(rounds) && rounds > 0 && rounds <= 30000,
    "Use de 1 a 30000 rodadas.",
  );
  const output = resolve(
    process.env.NIMBUS_STRESS_OUTPUT || "work/stress-results.json",
  );
  await mkdir(resolve(output, ".."), { recursive: true });
  await build({
    stdin: {
      contents: `export {inspectPdf} from './lib/pdf-tools';export {notify,deliver} from './lib/notifications';export {parseNavigation,safeReturnTarget,workspaceFor,adminGroups,authorTabs} from './lib/navigation';`,
      resolveDir: process.cwd(),
      sourcefile: "stress-core.ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: join(temp, "core.mjs"),
  });
  const core = await import(pathToFileURL(join(temp, "core.mjs")));
  const env = globalThis.__NIMBUS_TEST_ENV__,
    stamp = new Date().toISOString();
  for (const id of ["admin", "stress-buyer", "stress-outsider"])
    db.prepare("INSERT INTO users(id,email,name,created) VALUES(?,?,?,?)").run(
      id,
      id + "@nimbus.test",
      "Pessoa fictícia " + id,
      stamp,
    );
  const content = new TextEncoder().encode(
    "CONTEUDO ORIGINAL FICTICIO PARA TESTES NIMBUS.",
  );
  for (const id of ["stress-paid", "stress-owned"]) {
    db.prepare(
      `INSERT INTO products(id,author_id,title,description,category,course,subject,format,price,pages,author,preview,objectives,sources,status,file_key,file_name,preview_keys,accepted_bps,accepted_owned,created) VALUES(?,'admin',?,'Material original fictício para teste automatizado.','Formação acadêmica geral','Formação acadêmica geral','Métodos de estudo','Guias práticos',1990,1,'Autor fictício','Prévia fictícia para os testes isolados.','Aprender a validar os fluxos da plataforma.','Referência original fictícia da suíte de testes.','published',?,'material.txt','["stress-preview"]',0,1,?)`,
    ).run(id, "Material fictício " + id, id + ".txt", stamp);
    objects.set(id + ".txt", content);
  }
  objects.set(
    "stress-preview",
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  db.prepare(
    "INSERT INTO orders(id,user_id,status,total,payment_intent,created) VALUES('stress-owned-order','stress-buyer','paid',1990,'pi_owned',?)",
  ).run(stamp);
  db.prepare(
    "INSERT INTO order_items(id,order_id,product_id,title,price,author_id,commission_bps,owned,policy_version,file_key,file_name,content) VALUES('stress-owned-item','stress-owned-order','stress-owned','Material adquirido fictício',1990,'admin',0,1,'nimbus-net-25-v1','stress-owned.txt','material.txt','')",
  ).run();
  const questions = [
    {
      id: "stress-q",
      prompt: "Qual é a alternativa correta nesta questão fictícia?",
      options: ["Correta", "Incorreta", "Outra incorreta"],
      correct: 0,
      explanation: "A alternativa correta está na primeira posição.",
      option_explanations: [
        "Correta pela fonte.",
        "Contraria a fonte.",
        "Não é sustentada.",
      ],
      page: 1,
      topic: "Revisão",
      difficulty: "medium",
    },
  ];
  db.prepare(
    "INSERT INTO learning_packages(product_id,cards,questions,lessons,published_cards,published_questions,published_lessons,updated) VALUES(?,?,?,?,?,?,?,?)",
  ).run(
    "stress-owned",
    JSON.stringify([
      {
        id: "stress-card",
        front: "Pergunta fictícia",
        back: "Resposta fictícia",
        page: 1,
      },
    ]),
    JSON.stringify(questions),
    "[]",
    JSON.stringify([
      {
        id: "stress-card",
        front: "Pergunta fictícia",
        back: "Resposta fictícia",
        page: 1,
      },
    ]),
    JSON.stringify(questions),
    "[]",
    stamp,
  );
  db.prepare(
    "INSERT INTO tickets(id,user_id,order_id,subject,message,created) VALUES('stress-ticket','stress-buyer','stress-owned-order','Atendimento fictício','Mensagem original de atendimento fictício.',?)",
  ).run(stamp);
  const baseObjects = new Map(objects),
    migrations = (
      await Promise.all(
        (await readdir("drizzle"))
          .filter((n) => n.endsWith(".sql"))
          .sort()
          .map((n) => readFile("drizzle/" + n, "utf8")),
      )
    ).join("\n");
  const pdfs = [];
  for (let i = 0; i < 12; i++)
    pdfs.push(await fixturePdf("Nimbus original fixture number " + i));
  const originalFetch = globalThis.fetch;
  let iter = 0,
    amount = 1990,
    refunded = 0,
    providerCalls = 0,
    unexpectedFetch = 0,
    assertions = 0,
    apiCalls = 0,
    sessionCreates = 0;
  const eq = (a, b) => {
    assertions++;
    assert.deepEqual(
      a && typeof a === "object" ? JSON.parse(JSON.stringify(a)) : a,
      b,
    );
  };
  const check = (v, message) => {
    assertions++;
    assert(v, message);
  };
  globalThis.fetch = async (url, opts = {}) => {
    providerCalls++;
    const u = String(url);
    if (u === "https://api.stripe.com/v1/checkout/sessions") {
      sessionCreates++;
      eq(
        opts.body.get("line_items[0][price_data][unit_amount]"),
        String(amount),
      );
      return Response.json({
        id: "cs_test_stress_" + iter,
        url: "https://checkout.stripe.com/test_only_" + iter,
      });
    }
    if (u.startsWith("https://api.stripe.com/v1/checkout/sessions/")) {
      const order = db
        .prepare(
          "SELECT * FROM orders WHERE user_id='stress-buyer' AND status='pending' ORDER BY created DESC LIMIT 1",
        )
        .get();
      return Response.json({
        id: order.session_id,
        status: "open",
        amount_total: order.total,
        metadata: { order_id: order.id },
        url: order.checkout_url,
      });
    }
    if (u.startsWith("https://api.stripe.com/v1/payment_intents/"))
      return Response.json({
        status: "succeeded",
        latest_charge: {
          id: "ch_fake",
          amount,
          amount_refunded: refunded,
          currency: "brl",
          balance_transaction: {
            id: "txn_fake",
            amount,
            fee: Math.min(50, amount),
            currency: "brl",
            available_on: Math.floor(Date.now() / 1000) - 1,
          },
        },
      });
    if (u === "https://api.stripe.com/v1/refunds") {
      refunded = amount;
      return Response.json({
        id: "re_fake_" + iter,
        status: "succeeded",
        amount,
      });
    }
    if (u === "https://api.resend.com/emails")
      return Response.json({ id: "email_fake_" + iter });
    unexpectedFetch++;
    throw Error("External call blocked by test harness: " + u);
  };
  async function req(path, opts = {}, expected = 200) {
    apiCalls++;
    const response = await call(path, { user: "stress-buyer", ...opts });
    const text = await response.text();
    eq(response.status, expected);
    return response.headers.get("content-type")?.includes("json")
      ? JSON.parse(text)
      : text;
  }
  async function checkout(i) {
    amount = 100 + ((i * 7919) % 999900);
    refunded = 0;
    db.prepare("UPDATE products SET price=? WHERE id='stress-paid'").run(
      amount,
    );
    return req("checkout", {
      body: {
        ids: ["stress-paid"],
        accepted: true,
        request_id: uuid(i),
        price: 1,
        total: 1,
      },
    });
  }
  function uuid(i) {
    return "10000000-0000-4000-8000-" + String(i).padStart(12, "0");
  }
  async function webhook(order, i, valid = true) {
    const o = db.prepare("SELECT * FROM orders WHERE id=?").get(order);
    const raw = JSON.stringify({
      id: "evt_stress_" + i,
      type: "checkout.session.completed",
      data: {
        object: {
          id: o.session_id,
          metadata: { order_id: order },
          payment_status: "paid",
          amount_total: o.total,
          currency: "brl",
          payment_intent: "pi_stress_" + i,
        },
      },
    });
    const t = String(Math.floor(Date.now() / 1000));
    const sig = createHmac("sha256", valid ? "whsec_fake" : "wrong")
      .update(t + "." + raw)
      .digest("hex");
    return req(
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
  const limits = {
    1: "Stripe, R2 e e-mail simulados; compra real no sandbox depende de webhook configurado.",
    2: "Retomada e repetição sequenciais na API isolada; corrida distribuída real não medida.",
    3: "Assinatura HMAC real e eventos simulados; entrega pela rede Stripe não exercitada.",
    4: "Autorização da API e bytes no armazenamento simulado; fronteira de identidade da hospedagem não substituída.",
    5: "Solicitação, aprovação, revogação e conciliação com resposta Stripe simulada; sem dinheiro real.",
    6: "Identidade de teste injetada no adaptador isolado e rejeição de anônimos/tokens inválidos; cadastro/recuperação no provedor pendentes.",
    7: "Edição, permissão e aprovação via API; conferência editorial humana não simulada.",
    8: "Formato, assinatura e conteúdo básico; não constitui varredura antivírus.",
    9: "Regras de tentativas e cartões pela API; interação e percepção do estudante exigem navegador.",
    10: "Estrutura de PDFs reais gerados e limites de marcadores do atlas; 30000 OCRs/leituras por voz não executados.",
    11: "Somente roteamento e destinos seguros; 30000 testes visuais em iOS/Android, contraste e leitor de tela não executados.",
    12: "Chamado vinculado e envio idempotente ao provedor simulado; recebimento real na caixa postal não testado.",
    13: "Exportação e isolamento entre titulares; exclusão, retenção e conformidade jurídica dependem de processo operacional.",
    14: "Concorrência local sobre API importada, sem HTTP/Cloudflare/D1 remoto; não é capacidade de produção.",
    15: "Restaurações em SQLite vazio com todas as migrações e cópia em memória dos arquivos fictícios; backup real da hospedagem não exercitado.",
  };
  const cases = [
    {
      id: 1,
      name: "Compra e entrega",
      run: async (i) => {
        const c = await checkout(i);
        await req("download/stress-paid", {}, 403);
        await webhook(c.order, i);
        eq(
          db.prepare("SELECT total,status FROM orders WHERE id=?").get(c.order),
          { total: amount, status: "paid" },
        );
        const bytes = await req("download/stress-paid");
        check(bytes.includes("CONTEUDO ORIGINAL"));
      },
    },
    {
      id: 2,
      name: "Pagamento interrompido",
      run: async (i) => {
        const c = await checkout(i),
          count = sessionCreates;
        const repeated = await req("checkout", {
          body: { ids: ["stress-paid"], accepted: true, request_id: uuid(i) },
        });
        eq(repeated.order, c.order);
        eq(sessionCreates, count);
        const r = await req("order-retry", { body: { id: c.order } });
        eq(r.url, c.url);
        eq(sessionCreates, count);
        await req(
          "order-retry",
          { user: "stress-outsider", body: { id: c.order } },
          404,
        );
      },
    },
    {
      id: 3,
      name: "Webhook repetido e adulterado",
      run: async (i) => {
        amount = 100 + ((i * 13) % 900000);
        db.prepare(
          "INSERT INTO orders(id,user_id,status,total,session_id,created) VALUES('stress-webhook','stress-buyer','pending',?,'cs_stress',?)",
        ).run(amount, stamp);
        db.prepare(
          "INSERT INTO order_items(id,order_id,product_id,title,price,author_id,commission_bps,owned,policy_version,content) VALUES('stress-webhook-item','stress-webhook','stress-paid','Fictício',?,'admin',0,1,'nimbus-net-25-v1','Conteúdo fictício')",
        ).run(amount);
        await webhook("stress-webhook", i, false);
        eq(
          db
            .prepare("SELECT status FROM orders WHERE id='stress-webhook'")
            .get().status,
          "pending",
        );
        await webhook("stress-webhook", i);
        await webhook("stress-webhook", i);
        eq(
          db
            .prepare("SELECT COUNT(*) n FROM webhook_events WHERE id=?")
            .get("evt_stress_" + i).n,
          1,
        );
        eq(
          db
            .prepare(
              "SELECT COUNT(*) n FROM notifications WHERE id='purchase:stress-webhook'",
            )
            .get().n,
          1,
        );
      },
    },
    {
      id: 4,
      name: "Proteção de arquivos",
      run: async (i) => {
        await req("download/stress-owned", { user: null }, 401);
        await req("download/stress-owned", { user: "stress-outsider" }, 403);
        await req("download/nao-existe-" + i, {}, 403);
        check(
          (await req("download/stress-owned")).includes("CONTEUDO ORIGINAL"),
        );
      },
    },
    {
      id: 5,
      name: "Reembolso",
      run: async (i) => {
        amount = 100 + ((i * 37) % 900000);
        db.prepare(
          "UPDATE orders SET total=? WHERE id='stress-owned-order'",
        ).run(amount);
        db.prepare(
          "UPDATE order_items SET price=? WHERE id='stress-owned-item'",
        ).run(amount);
        await req(
          "refund-requests",
          {
            user: "stress-outsider",
            body: {
              order_id: "stress-owned-order",
              reason: "Solicitação indevida " + i,
            },
          },
          404,
        );
        await req("refund-requests", {
          body: {
            order_id: "stress-owned-order",
            reason: "Motivo fictício para o reembolso " + i,
          },
        });
        const r = db
          .prepare(
            "SELECT id FROM refund_requests WHERE order_id='stress-owned-order'",
          )
          .get();
        await req(
          "refund-requests",
          { body: { action: "approve", id: r.id } },
          403,
        );
        await req("refund-requests", {
          user: "admin",
          body: { action: "approve", id: r.id },
        });
        eq(
          db
            .prepare("SELECT status FROM orders WHERE id='stress-owned-order'")
            .get().status,
          "refunded",
        );
        await req("download/stress-owned", {}, 403);
      },
    },
    {
      id: 6,
      name: "Identidade e acesso à conta",
      run: async (i) => {
        const user = "stress-account-" + i;
        const me = await req("me", { user });
        eq(me.user.id, user);
        await req(
          "library",
          { user: null, headers: { authorization: "Bearer invalid-" + i } },
          401,
        );
        const l = await req("library", { user });
        eq(l.items.length, 0);
        await req("admin", { user }, 403);
      },
    },
    {
      id: 7,
      name: "Revisão e publicação por autores",
      run: async (i) => {
        const pkg = {
          product_id: "stress-owned",
          cards: [
            {
              front: "Conceito fictício " + i,
              back: "Resposta original para revisão " + i,
            },
          ],
          questions: [],
          lessons: [],
        };
        await req(
          "learning-author",
          { user: "stress-outsider", body: pkg },
          403,
        );
        await req("learning-author", { user: "admin", body: pkg });
        eq(
          db
            .prepare("SELECT status FROM products WHERE id='stress-owned'")
            .get().status,
          "draft",
        );
        await req("admin", {
          user: "admin",
          body: {
            action: "product",
            id: "stress-owned",
            status: "published",
            reviewed: true,
          },
        });
        eq(
          (await req("learning-content?id=stress-owned")).package.cards[0]
            .front,
          pkg.cards[0].front,
        );
      },
    },
    {
      id: 8,
      name: "Arquivos problemáticos",
      run: async (i) => {
        const bad = [
          ["falso.pdf", "%PDF-invalid-" + i],
          ["script.txt", "<script>alert(" + i + ")</script>"],
          ["errado.png", "NOT_A_PNG_" + i],
          ["errado.zip", "NOT_A_ZIP_" + i],
          ["vazio.txt", ""],
          ["exec.exe", "EXECUTABLE_" + i],
        ][i % 6];
        const form = new FormData();
        form.set("id", "stress-owned");
        form.set("file", new File([bad[1]], bad[0]));
        const response = await POST(
          new Request("https://nimbus.test/api/upload", {
            method: "POST",
            headers: {
              origin: "https://nimbus.test",
              "oai-authenticated-user-id": "admin",
              "oai-authenticated-user-email": "admin@nimbus.test",
            },
            body: form,
          }),
        );
        apiCalls++;
        eq(response.status, 400);
        const good = new FormData();
        good.set("id", "stress-owned");
        good.set(
          "file",
          new File(["Conteúdo original fictício " + i], "valido.txt"),
        );
        const accepted = await POST(
          new Request("https://nimbus.test/api/upload", {
            method: "POST",
            headers: {
              origin: "https://nimbus.test",
              "oai-authenticated-user-id": "admin",
              "oai-authenticated-user-email": "admin@nimbus.test",
            },
            body: good,
          }),
        );
        apiCalls++;
        eq(accepted.status, 200);
        check(
          db
            .prepare(
              "SELECT result FROM upload_checks WHERE product_id='stress-owned'",
            )
            .get()
            .result.includes('"signature":true'),
        );
      },
    },
    {
      id: 9,
      name: "Simulados e revisões",
      run: async (i) => {
        const s = await req("practice", {
          body: {
            product_id: "stress-owned",
            action: "start",
            count: 1,
            minutes: 1,
          },
        });
        eq(s.session.questions[0].correct, undefined);
        eq(s.session.questions[0].explanation, undefined);
        const answer = i % 3;
        const done = await req("practice", {
          body: {
            product_id: "stress-owned",
            action: "finish",
            session_id: s.session.id,
            answers: [answer],
          },
        });
        eq(done.session.score, answer === 0 ? 1 : 0);
        const repeated = await req("practice", {
          body: {
            product_id: "stress-owned",
            action: "finish",
            session_id: s.session.id,
            answers: [2],
          },
        });
        eq(repeated.session.score, done.session.score);
        const rating = ["hard", "normal", "easy"][i % 3],
          review = {
            product_id: "stress-owned",
            card_id: "stress-card",
            rating,
            request_id: uuid(i),
          };
        await req("study-card-review", { body: review });
        await req("study-card-review", { body: review });
        eq(
          db
            .prepare(
              "SELECT repetitions,interval FROM adaptive_reviews WHERE card_id='stress-card'",
            )
            .get(),
          {
            repetitions: 1,
            interval: rating === "hard" ? 1 : rating === "normal" ? 2 : 4,
          },
        );
      },
    },
    {
      id: 10,
      name: "PDF e atlas",
      run: async (i) => {
        const info = await core.inspectPdf(pdfs[i % pdfs.length]);
        eq(info.pages, 1);
        const x = i % 101,
          y = (i * 7) % 101,
          bad = i % 4 === 0;
        const atlas = [
          {
            image: 0,
            caption: "Imagem fictícia para exercício " + i,
            source: "Fonte própria fictícia " + i,
            question: "Qual conceito?",
            answer: "Resposta fictícia.",
            points: [{ x: bad ? 101 : x, y, label: "Marcação " + i }],
          },
        ];
        await req(
          "editorial-tools-edit",
          {
            user: "admin",
            body: {
              product_id: "stress-owned",
              glossary: [],
              atlas,
              rights: true,
              deidentified: true,
            },
          },
          bad ? 400 : 200,
        );
      },
    },
    {
      id: 11,
      name: "Navegação e acessibilidade — cobertura parcial",
      run: async (i) => {
        const tabs = core.adminGroups.flatMap((g) => g.items.map(([id]) => id));
        const tab = tabs[i % tabs.length];
        const r = core.parseNavigation("#admin/" + encodeURIComponent(tab));
        eq(r.adminTab, tab);
        eq(core.workspaceFor(r.view), "admin");
        eq(core.safeReturnTarget("https://malicioso.invalid/" + i), "conta");
        eq(core.safeReturnTarget("//malicioso.invalid/" + i), "conta");
        eq(core.safeReturnTarget("javascript:alert(" + i + ")"), "conta");
        const a = core.authorTabs[i % core.authorTabs.length];
        eq(core.parseNavigation("#autores/" + a).authorTab, a);
        eq(core.safeReturnTarget("autores/" + a), "autores/" + a);
      },
    },
    {
      id: 12,
      name: "Atendimento e notificações",
      run: async (i) => {
        await req(
          "support-thread?id=stress-ticket",
          { user: "stress-outsider" },
          404,
        );
        await req("support-thread", {
          user: "admin",
          body: {
            id: "stress-ticket",
            message: "Resposta fictícia número " + i,
          },
        });
        const thread = await req("support-thread?id=stress-ticket");
        eq(thread.ticket.order_id, "stress-owned-order");
        eq(thread.messages[0].message, "Resposta fictícia número " + i);
        const key = "stress-email-" + i;
        await core.notify(
          env,
          key,
          "stress-buyer",
          "Assunto fictício " + i,
          "Mensagem fictícia " + i,
        );
        await core.notify(
          env,
          key,
          "stress-buyer",
          "Assunto fictício " + i,
          "Mensagem fictícia " + i,
        );
        eq(
          db.prepare("SELECT COUNT(*) n FROM email_outbox WHERE id=?").get(key)
            .n,
          1,
        );
        const prior = providerCalls;
        env.RESEND_API_KEY = "fake-not-a-secret";
        env.EMAIL_FROM = "test@nimbus.invalid";
        eq((await core.deliver(env, key)).status, "sent");
        eq((await core.deliver(env, key)).status, "sent");
        eq(providerCalls, prior + 1);
        delete env.RESEND_API_KEY;
        delete env.EMAIL_FROM;
      },
    },
    {
      id: 13,
      name: "Privacidade e isolamento dos dados",
      run: async (i) => {
        const note = "Anotação privada titular " + i;
        db.prepare(
          "INSERT INTO study(id,user_id,product_id,notes,progress) VALUES('private','stress-buyer','stress-owned',?,?)",
        ).run(note, i % 101);
        await req("privacy-export", { user: null }, 401);
        const own = await req("privacy-export");
        eq(own.profile.id, "stress-buyer");
        check(own.notes.some((n) => n.notes === note));
        const other = await req("privacy-export", { user: "stress-outsider" });
        eq(other.profile.id, "stress-outsider");
        check(!JSON.stringify(other).includes(note));
      },
    },
    {
      id: 14,
      name: "Desempenho local com concorrência",
      run: async (i) => {
        const responses = await Promise.all(
          Array.from({ length: 8 }, (_, n) =>
            req(
              (i + n) % 2
                ? "service-status"
                : "academic-search?q=inexistente-" + i,
              { user: null },
            ),
          ),
        );
        eq(responses.length, 8);
        check(responses.every((r) => r.sales || Array.isArray(r.products)));
      },
    },
    { id: 15, name: "Backup e restauração isolada", run: null },
  ];
  const snapshot = await req("backup-export", { user: "admin" });
  const sourceUsers = snapshot.tables.users.length;
  check(sourceUsers >= 3);
  cases[14].run = async (i) => {
    const target = new DatabaseSync(":memory:");
    try {
      target.exec(migrations);
      const s = {
        ...snapshot,
        tables: {
          ...snapshot.tables,
          users: snapshot.tables.users.map((u) =>
            u.id === "stress-buyer" ? { ...u, name: "Restaurado " + i } : u,
          ),
        },
      };
      await restoreSnapshot(target, s);
      eq(target.prepare("SELECT COUNT(*) n FROM users").get().n, sourceUsers);
      eq(
        target.prepare("SELECT name FROM users WHERE id='stress-buyer'").get()
          .name,
        "Restaurado " + i,
      );
      eq(
        target
          .prepare(
            "SELECT COUNT(*) n FROM order_items WHERE order_id='stress-owned-order'",
          )
          .get().n,
        1,
      );
      const copies = new Map(
        [...baseObjects].map(([key, value]) => [
          key,
          new Uint8Array(value).slice(),
        ]),
      );
      eq(
        createHash("sha256")
          .update(copies.get("stress-owned.txt"))
          .digest("hex"),
        createHash("sha256")
          .update(baseObjects.get("stress-owned.txt"))
          .digest("hex"),
      );
    } finally {
      target.close();
    }
  };
  const selected = process.env.NIMBUS_STRESS_GROUPS
    ? new Set(process.env.NIMBUS_STRESS_GROUPS.split(",").map(Number))
    : null;
  const report = {
    schema: "nimbus-stress-v1",
    started: new Date().toISOString(),
    source_commit: process.env.NIMBUS_STRESS_COMMIT || null,
    rounds_per_group: rounds,
    seed: "deterministic-index-7919-v1",
    node_version: process.version,
    sqlite_version: db.prepare("SELECT sqlite_version() version").get().version,
    harness_sha256: createHash("sha256")
      .update(await readFile("tests/stress-scenarios.mjs"))
      .digest("hex"),
    environment:
      "Node + SQLite in-memory + mocked provider fetch + mocked R2; no production traffic",
    groups: [],
    total_completed: 0,
    total_failures: 0,
    assertions: 0,
    api_calls: 0,
    provider_calls_mocked: 0,
    external_network_calls: 0,
  };
  try {
    for (const c of cases) {
      if (selected && !selected.has(c.id)) continue;
      const start = performance.now(),
        latencies = [],
        a0 = assertions,
        q0 = apiCalls,
        p0 = providerCalls;
      let completed = 0,
        failures = [];
      for (let i = 0; i < rounds; i++) {
        iter = i;
        amount = 1990;
        refunded = 0;
        const begin = performance.now();
        db.exec("SAVEPOINT stress_iteration");
        try {
          await c.run(i);
          completed++;
        } catch (error) {
          failures.push({
            iteration: i,
            message: error.message,
            stack: error.stack?.split("\n").slice(0, 6),
          });
        } finally {
          db.exec("ROLLBACK TO stress_iteration");
          db.exec("RELEASE stress_iteration");
          objects.clear();
          for (const [k, v] of baseObjects) objects.set(k, v);
          delete env.RESEND_API_KEY;
          delete env.EMAIL_FROM;
        }
        latencies.push(performance.now() - begin);
        if (failures.length) break;
        if ((i + 1) % 3000 === 0)
          console.log(
            JSON.stringify({
              group: c.id,
              completed: i + 1,
              target: rounds,
              seconds: Math.round((performance.now() - start) / 1000),
            }),
          );
      }
      latencies.sort((a, b) => a - b);
      const milliseconds = performance.now() - start;
      const g = {
        id: c.id,
        name: c.name,
        requested: rounds,
        completed,
        failed: failures.length,
        assertions: assertions - a0,
        api_calls: apiCalls - q0,
        provider_calls_mocked: providerCalls - p0,
        duration_ms: Math.round(milliseconds),
        scenarios_per_second: Math.round(completed / (milliseconds / 1000)),
        p50_ms: Number(
          latencies[Math.floor(latencies.length * 0.5)]?.toFixed(3),
        ),
        p95_ms: Number(
          latencies[
            Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))
          ]?.toFixed(3),
        ),
        coverage: "partial versus full end-to-end checklist; see limitation",
        limitation: limits[c.id],
        failures,
      };
      report.groups.push(g);
      report.total_completed += completed;
      report.total_failures += failures.length;
      report.assertions = assertions;
      report.api_calls = apiCalls;
      report.provider_calls_mocked = providerCalls;
      report.external_network_calls = unexpectedFetch;
      report.updated = new Date().toISOString();
      await writeFile(output, JSON.stringify(report, null, 2) + "\n");
      console.log(
        JSON.stringify({
          group: c.id,
          completed,
          failed: failures.length,
          duration_ms: g.duration_ms,
        }),
      );
      if (failures.length)
        throw Error(
          "Stress group " +
            c.id +
            " failed at " +
            failures[0].iteration +
            ": " +
            failures[0].message,
        );
    }
    eq(unexpectedFetch, 0);
    report.finished = new Date().toISOString();
    report.assertions = assertions;
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
    console.log(
      JSON.stringify({
        report: output,
        completed: report.total_completed,
        assertions,
        apiCalls,
        unexpectedFetch,
      }),
    );
  } finally {
    globalThis.fetch = originalFetch;
    delete env.RESEND_API_KEY;
    delete env.EMAIL_FROM;
  }
}
