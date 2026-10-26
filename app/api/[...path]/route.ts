import { STRIPE_API_VERSION, CHECKOUT_INTEGRATION } from "@/lib/stripe-config";
import { supportThread } from "@/lib/support-thread";
import { operationDocuments } from "@/lib/operation-documents";
import { paymentsReady, requirePayments } from "@/lib/payment-readiness";
import { studyAssistant } from "@/lib/study-assistant";
import {
  editorialOperations,
  assertSaleAvailable,
} from "@/lib/editorial-operations";
import { copyPdf, inspectPdf } from "@/lib/pdf-tools";
import { institutional } from "@/lib/institutional";
import {
  marketGrowth,
  prepareReferral,
  referralStatement,
} from "@/lib/market-growth";
import { publicationNotices } from "@/lib/publication-notices";
import { management } from "@/lib/management";
import { freeGuides } from "@/lib/free-guides";
import { growth, couponQuote } from "@/lib/growth";
import { editorialPlus } from "@/lib/editorial-plus";
import { releaseDuePublications } from "@/lib/publication-schedule";
import { subscriptionRoutes, syncSubscriptionEvent } from "@/lib/subscriptions";
import { serviceRoutes, syncServiceEvent } from "@/lib/services";
import { licenses, claimLicenses, orderAccess } from "@/lib/licenses";
import { staff } from "@/lib/staff";
import { learningProducts, hasPackage } from "@/lib/learning-products";
import { learning } from "@/lib/learning";
import { discovery } from "@/lib/discovery";
import { operationsPlus, syncRefundEvent } from "@/lib/operations-plus";
import { rate as limitRate, audit as featureAudit } from "@/lib/feature-db";
import { extension } from "@/lib/extensions";
import { emailIdentity } from "@/lib/identity";
import {
  bundleIds,
  entitlement,
  validateBundle,
  type RichProduct,
  publicDTO,
} from "@/lib/catalog-services";
import { notify, deliver, purchaseNotice } from "@/lib/notifications";
import {
  policy,
  reconcile,
  financialReport,
  recordPayout,
  POLICY_VERSION,
} from "@/lib/finance";
import {
  normalizeProduct,
  areas,
  levels,
  languages,
  legacyTypes,
  fileTypes,
  fileMime,
} from "@/lib/taxonomy";
import { env } from "cloudflare:workers";
import { seed, categories, formats, type Product } from "@/lib/catalog";
import { parseCart, validProduct, verifyStripe } from "@/lib/commerce";
export const dynamic = "force-dynamic";
type Runtime = {
  DB: D1Database;
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  BUCKET: R2Bucket;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_WEBHOOK_READY?: string;
  ADMIN_EMAILS?: string;
};
const runtime = () => env as unknown as Runtime;
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
type Body = {
  order_id?: string;
  referral_code?: string;
  seats?: number;
  gift_email?: string;
  coupon?: string;
  review_checks?: string[];
  clarity?: number;
  presentation?: number;
  reviewed?: boolean;
  feedback?: string;
  controller?: string;
  contact?: string;
  retention?: string;
  kind?: string;
  accepted_rate?: number;
  accepted_owned?: number;
  commission_bps?: number;
  owned?: boolean;
  commercial_accepted?: boolean;
  amount?: number;
  reference?: string;
  topic?: string;
  level?: string;
  language?: string;
  name: string;
  course: string;
  institution: string;
  id: string;
  active: boolean;
  accepted: boolean;
  ids: unknown;
  progress: number;
  notes: string;
  rating: number;
  comment: string;
  subject: string;
  message: string;
  title: string;
  rights: boolean;
  category: string;
  format: string;
  description: string;
  preview: string;
  price: number;
  pages: number;
  action: string;
  status: string;
  response: string;
  request_id?: string;
};
async function body(req: Request) {
  const value: unknown = await req.json();
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("Dados inválidos.");
  return value as Body;
}
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const clean = (v: unknown, max = 500) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
async function all<T = Record<string, unknown>>(
  sql: string,
  ...args: unknown[]
) {
  return (
    await runtime()
      .DB.prepare(sql)
      .bind(...args)
      .all<T>()
  ).results;
}
async function run(sql: string, ...args: unknown[]) {
  return runtime()
    .DB.prepare(sql)
    .bind(...args)
    .run();
}
async function who(req: Request) {
  const id = req.headers.get("oai-authenticated-user-id"),
    email = req.headers.get("oai-authenticated-user-email");
  if (!id || !email) return emailIdentity(req, runtime());
  let name =
    req.headers.get("oai-authenticated-user-full-name") || email.split("@")[0];
  if (
    req.headers.get("oai-authenticated-user-full-name-encoding") ===
    "percent-encoded-utf-8"
  ) {
    try {
      name = decodeURIComponent(name);
    } catch {}
  }
  return {
    id,
    email,
    name,
    admin: (runtime().ADMIN_EMAILS || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
      .includes(email.toLowerCase()),
  };
}
async function auth(req: Request) {
  const user = await who(req);
  if (!user) fail("Entre na sua conta para continuar.", 401);
  await run(
    "INSERT INTO users (id,email,name,created) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email",
    user!.id,
    user!.email,
    user!.name,
    now(),
  );
  await claimLicenses(runtime(), user);
  const route = new URL(req.url).pathname;
  if (
    route.startsWith("/api/download/") ||
    route.startsWith("/api/version-download/")
  )
    await limitRate(runtime(), user.id, "downloads", 40);
  if (
    req.method === "POST" &&
    ["/api/upload", "/api/checkout", "/api/tickets", "/api/reviews"].includes(
      route,
    )
  )
    await limitRate(runtime(), user.id, route, 20);
  return user!;
}
async function admin(req: Request) {
  const u = await auth(req);
  if (!u.admin) fail("Acesso restrito à administração.", 403);
  return u;
}
async function log(user: string, action: string, target: string) {
  await run(
    "INSERT INTO audit (id,user_id,action,target,created) VALUES (?,?,?,?,?)",
    uid(),
    user,
    action,
    target,
    now(),
  );
}
async function catalog() {
  await releaseDuePublications(runtime());
  const db = await all<Product>(
    "SELECT p.*,u.author_slug FROM products p LEFT JOIN users u ON u.id=p.author_id",
  );
  const map = new Map(seed.map((p) => [p.id, p]));
  db.forEach((p) => map.set(p.id, p));
  const ratings = await all<{
    product_id: string;
    rating: number;
    review_count: number;
  }>(
    "SELECT r.product_id,AVG(r.rating) rating,COUNT(*) review_count FROM reviews r LEFT JOIN review_moderation m ON m.review_id=r.id WHERE COALESCE(m.status,'visible')='visible' GROUP BY r.product_id",
  );
  const ownership = await all<{ id: string; owned: number }>(
    "SELECT u.id,COALESCE(a.owned,CASE WHEN instr(?,','||lower(u.email)||',')>0 THEN 1 ELSE 0 END) owned FROM users u LEFT JOIN author_accounts a ON a.id=u.id",
    "," + (runtime().ADMIN_EMAILS || "").toLowerCase() + ",",
  );
  return [...map.values()].map((p) => ({
    owned: ownership.find((x) => x.id === p.author_id)?.owned || 0,
    ...normalizeProduct(p),
    rating: ratings.find((r) => r.product_id === p.id)?.rating || 0,
    review_count: ratings.find((r) => r.product_id === p.id)?.review_count || 0,
  }));
}
async function purchased(user: string, id: string) {
  return entitlement(runtime(), user, id);
}
async function moderateProduct(u: Awaited<ReturnType<typeof auth>>, b: Body) {
  if (
    !["published", "rejected", "draft", "changes_requested"].includes(b.status)
  )
    fail("Status inválido.");
  const p = (await catalog()).find((p) => p.id === b.id);
  if (p && b.status === "published") {
    const terms = await policy(runtime(), p.author_id);
    if (
      p.accepted_bps !== (terms.owned ? 0 : terms.commission_bps) ||
      p.accepted_owned !== terms.owned
    )
      fail("O autor deve aceitar as condições comerciais atuais.", 409);
  }
  if (
    !p ||
    p.demo ||
    (!p.file_key &&
      !bundleIds(p).length &&
      !(await hasPackage(runtime(), p.id)))
  )
    fail("Apenas materiais reais com arquivo podem ser publicados.");
  if (b.status === "published")
    await validateBundle(runtime(), p.id, p.author_id, bundleIds(p));
  const reviewer = (
    await all<{ name: string; public_name: string }>(
      "SELECT name,public_name FROM users WHERE id=?",
      u.id,
    )
  )[0];
  if (
    b.reviewed === true &&
    b.status === "published" &&
    ((p.objectives || "").length < 10 || (p.sources || "").length < 10)
  )
    fail(
      "Para registrar revisão, informe objetivos e referências no material.",
    );
  const schedule = (
    await all<{ release_at: string }>(
      "SELECT release_at FROM publication_schedule WHERE product_id=?",
      p.id,
    )
  )[0];
  const scheduled =
    b.status === "published" && schedule && schedule.release_at > now();
  if (scheduled)
    await run(
      "UPDATE publication_schedule SET approved=1 WHERE product_id=?",
      p.id,
    );
  await run(
    "UPDATE products SET status=?,reviewed_by=?,reviewed_at=? WHERE id=?",
    scheduled ? "scheduled" : b.status,
    b.reviewed === true && b.status === "published"
      ? reviewer.public_name || reviewer.name
      : null,
    b.reviewed === true && b.status === "published" ? now() : null,
    p.id,
  );
  if (b.status === "published" && !scheduled)
    await run(
      "UPDATE learning_packages SET published_cards=cards,published_questions=questions,published_lessons=lessons WHERE product_id=?",
      p.id,
    );
  const feedback =
    clean(b.feedback, 5000) ||
    (b.status === "published"
      ? "Material aprovado para publicação."
      : "Consulte a administração para orientações.");
  await run(
    "INSERT INTO editorial_events(id,product_id,action,feedback,reviewer,checks,created) VALUES(?,?,?,?,?,?,?)",
    uid(),
    p.id,
    b.status,
    feedback,
    reviewer.name,
    JSON.stringify(
      Array.isArray(b.review_checks)
        ? b.review_checks.filter((x) =>
            [
              "content",
              "sources",
              "legibility",
              "examples",
              "answers",
              "rights",
            ].includes(x),
          )
        : [],
    ),
    now(),
  );
  const noteId = "editorial:" + uid();
  await notify(
    runtime(),
    noteId,
    p.author_id,
    scheduled
      ? "Material agendado"
      : b.status === "published"
        ? "Material publicado"
        : "Retorno sobre seu material",
    p.title + " — " + feedback,
    "/#autores",
  );
  await deliver(runtime(), noteId);
  if (b.status === "published" && !scheduled && p.file_key) {
    const versions = await all<{ id: string; sequence: number }>(
      "SELECT id,sequence FROM product_versions WHERE product_id=? AND file_key=? AND status='pending'",
      p.id,
      p.file_key,
    );
    await run(
      "UPDATE product_versions SET status='published',released=? WHERE product_id=? AND file_key=?",
      now(),
      p.id,
      p.file_key,
    );
    if (versions.length)
      await publicationNotices(
        runtime(),
        p,
        String(versions[0].id),
        true,
        false,
      );
  }
  if (b.status === "published" && !scheduled)
    await publicationNotices(runtime(), p, p.updated);

  await log(u.id, `product.${b.status}`, p.id);
}
async function respondTicket(u: Awaited<ReturnType<typeof auth>>, b: Body) {
  if (clean(b.response, 5000).length < 5)
    fail("Escreva uma resposta com pelo menos cinco caracteres.");
  const ticket = (
    await all("SELECT id FROM tickets WHERE id=?", clean(b.id, 100))
  )[0];
  if (!ticket) fail("Chamado não encontrado.", 404);
  await run(
    "INSERT INTO ticket_messages(id,ticket_id,user_id,kind,message,created) VALUES(?,?,?,'support',?,?)",
    uid(),
    clean(b.id, 100),
    u.id,
    clean(b.response, 5000),
    now(),
  );
  await run(
    "UPDATE tickets SET response=?,status=? WHERE id=?",
    clean(b.response, 5000),
    "closed",
    clean(b.id, 100),
  );
  const owner = (
    await all<{ user_id: string }>(
      "SELECT user_id FROM tickets WHERE id=?",
      clean(b.id, 100),
    )
  )[0];
  if (owner) {
    const id = "support:" + uid();
    await notify(
      runtime(),
      id,
      owner.user_id,
      "Resposta do suporte",
      "Sua solicitação recebeu uma resposta. Consulte o atendimento na Nimbus.",
      "/#suporte",
    );
    await deliver(runtime(), id);
  }
  await log(u.id, "ticket.responded", clean(b.id, 100));
}
async function dispatch(req: Request) {
  const url = new URL(req.url);
  const path = url.pathname.slice(5).split("/").filter(Boolean);
  const method = req.method;
  const { DB, BUCKET } = runtime();
  if (method !== "GET" && path[0] !== "webhook") {
    const origin = req.headers.get("origin");
    if (!origin || origin !== url.origin)
      fail("Origem da solicitação inválida.", 403);
  }
  for (const handler of [
    supportThread,
    operationDocuments,
    studyAssistant,
    editorialOperations,
    marketGrowth,
    institutional,
    management,
    learning,
    discovery,
    operationsPlus,
    learningProducts,
    staff,
    licenses,
    subscriptionRoutes,
    serviceRoutes,
    editorialPlus,
  ]) {
    const result = await handler(req, runtime(), auth);
    if (result) return result;
  }
  const grown = await growth(req, runtime(), auth);
  if (grown) return grown;
  const extended = await extension(req, runtime(), auth);
  if (extended) return extended;
  if (path[0] === "privacy-info" && method === "GET") {
    return json({
      settings: (
        await all(
          "SELECT controller,contact,retention,updated FROM privacy_settings WHERE id=?",
          "nimbus",
        )
      )[0] || { controller: "", contact: "", retention: "" },
    });
  }
  if (path[0] === "privacy-export" && method === "GET") {
    const u = await auth(req);
    const profile = (await all("SELECT * FROM users WHERE id=?", u.id))[0];
    const data = {
      exported_at: now(),
      profile,
      orders: await all(
        "SELECT id,status,total,created FROM orders WHERE user_id=?",
        u.id,
      ),
      items: await all(
        "SELECT i.product_id,i.price,i.title,o.id order_id FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.user_id=?",
        u.id,
      ),
      favorites: await all(
        "SELECT product_id FROM favorites WHERE user_id=?",
        u.id,
      ),
      notes: await all(
        "SELECT product_id,notes,progress FROM study WHERE user_id=?",
        u.id,
      ),
      reviews: await all(
        "SELECT product_id,rating,comment,name,created FROM reviews WHERE user_id=?",
        u.id,
      ),
      tickets: await all(
        "SELECT subject,message,status,response,created FROM tickets WHERE user_id=?",
        u.id,
      ),
      privacy_requests: await all(
        "SELECT kind,message,status,response,created,updated FROM privacy_requests WHERE user_id=?",
        u.id,
      ),
      acceptances: await all(
        "SELECT kind,version,details,created FROM legal_acceptances WHERE user_id=?",
        u.id,
      ),
      publications: await all(
        "SELECT id,title,description,category,course,subject,topic,format,price,pages,author,preview,status,file_name,created,updated FROM products WHERE author_id=?",
        u.id,
      ),
      material_requests: await all(
        "SELECT course,subject,description,status,response,created FROM material_requests WHERE user_id=?",
        u.id,
      ),
      content_issues: await all(
        "SELECT product_id,page,message,status,response,created FROM content_issues WHERE user_id=?",
        u.id,
      ),
      notifications: await all(
        "SELECT title,message,href,read,created FROM notifications WHERE user_id=?",
        u.id,
      ),
      email_notifications: await all(
        "SELECT subject,message,status,created,sent FROM email_outbox WHERE user_id=?",
        u.id,
      ),
      kit_items: await all(
        "SELECT a.product_id,a.title,a.parent_id,o.id order_id FROM order_assets a JOIN orders o ON o.id=a.order_id WHERE o.user_id=?",
        u.id,
      ),
      finances: await financialReport(runtime(), u.id),
      reader_states: await all(
        "SELECT * FROM reader_states WHERE user_id=?",
        u.id,
      ),
      page_annotations: await all(
        "SELECT * FROM page_annotations WHERE user_id=?",
        u.id,
      ),
      saved_searches: await all(
        "SELECT * FROM saved_searches WHERE user_id=?",
        u.id,
      ),
      author_follows: await all(
        "SELECT * FROM author_follows WHERE user_id=?",
        u.id,
      ),
      preferences: await all(
        "SELECT * FROM student_preferences WHERE user_id=?",
        u.id,
      ),
      drafts: await all("SELECT * FROM author_drafts WHERE user_id=?", u.id),
      questions: await all(
        "SELECT * FROM product_questions WHERE user_id=?",
        u.id,
      ),
      refund_requests: await all(
        "SELECT id,order_id,reason,status,response,amount,created,updated FROM refund_requests WHERE user_id=?",
        u.id,
      ),
      quality_reports: await all(
        "SELECT * FROM quality_reports WHERE user_id=?",
        u.id,
      ),
      lesson_progress: await all(
        "SELECT * FROM lesson_progress WHERE user_id=?",
        u.id,
      ),
      card_reviews: await all(
        "SELECT * FROM card_reviews WHERE user_id=?",
        u.id,
      ),
      quiz_attempts: await all(
        "SELECT * FROM quiz_attempts WHERE user_id=?",
        u.id,
      ),
      bookings: await all(
        "SELECT id,offer_id,slot_id,status,price,created FROM service_bookings WHERE user_id=?",
        u.id,
      ),
      quotes: await all(
        "SELECT id,offer_id,brief,status,price,response,payment_status,created,updated FROM service_quotes WHERE user_id=?",
        u.id,
      ),
      subscriptions: await all(
        "SELECT id,plan_id,product_ids,status,expires,created FROM subscriptions WHERE user_id=?",
        u.id,
      ),
      received_licenses: await all(
        "SELECT order_id,email,created FROM license_invites WHERE user_id=?",
        u.id,
      ),
      support_messages: await all(
        "SELECT m.kind,m.message,m.created FROM ticket_messages m JOIN tickets t ON t.id=m.ticket_id WHERE t.user_id=?",
        u.id,
      ),
      documents: await all(
        "SELECT id,kind,order_id,reference,status,url,notes,created,updated FROM operation_documents WHERE user_id=?",
        u.id,
      ),
      demand_ideas: await all(
        "SELECT * FROM demand_ideas WHERE user_id=?",
        u.id,
      ),
      demand_votes: await all(
        "SELECT * FROM demand_votes WHERE user_id=?",
        u.id,
      ),
      partner_account: await all(
        "SELECT * FROM partner_accounts WHERE user_id=?",
        u.id,
      ),
      referral_sales: await all(
        "SELECT order_id,code,kind,discount,created FROM referral_sales WHERE buyer_id=? OR referrer_id=?",
        u.id,
        u.id,
      ),
      affiliate_credits: await all(
        "SELECT * FROM affiliate_credits WHERE user_id=?",
        u.id,
      ),
      affiliate_payouts: await all(
        "SELECT * FROM affiliate_payouts WHERE user_id=?",
        u.id,
      ),
      institutional_requests: await all(
        "SELECT id,organization,course,message,seats,status,price,scope,expires,created,updated FROM institution_requests WHERE user_id=?",
        u.id,
      ),
      download_copies: await all(
        "SELECT copy_code,order_id,product_id,created FROM download_copies WHERE user_id=?",
        u.id,
      ),
      assistant_usage: await all(
        "SELECT day,count,input_tokens,output_tokens FROM tutor_usage WHERE user_id=?",
        u.id,
      ),
      sent_licenses: await all(
        "SELECT li.order_id,li.email,li.created FROM license_invites li JOIN orders o ON o.id=li.order_id WHERE o.user_id=?",
        u.id,
      ),
    };
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=nimbus-meus-dados.json",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (path[0] === "privacy") {
    const u = await auth(req);
    if (method === "GET")
      return json({
        requests: await all(
          "SELECT * FROM privacy_requests WHERE user_id=? ORDER BY created DESC",
          u.id,
        ),
      });
    const b = await body(req);
    if (
      !["acesso", "correção", "exclusão", "oposição", "informações"].includes(
        b.kind || "",
      )
    )
      fail("Tipo de solicitação inválido.");
    if (clean(b.message, 4000).length < 10) fail("Descreva sua solicitação.");
    await run(
      "INSERT INTO privacy_requests(id,user_id,kind,message,created,updated) VALUES(?,?,?,?,?,?)",
      uid(),
      u.id,
      b.kind,
      clean(b.message, 4000),
      now(),
      now(),
    );
    return json({ ok: true });
  }
  if (path[0] === "privacy-admin") {
    const u = await admin(req);
    if (method === "GET")
      return json({
        settings: (
          await all("SELECT * FROM privacy_settings WHERE id=?", "nimbus")
        )[0] || { controller: "", contact: "", retention: "" },
        requests: await all(
          "SELECT p.*,u.name,u.email FROM privacy_requests p JOIN users u ON u.id=p.user_id ORDER BY p.created DESC",
        ),
      });
    const b = await body(req);
    if (b.action === "settings") {
      const contact = clean(b.contact, 200);
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ||
        clean(b.controller, 200).length < 3 ||
        clean(b.retention, 4000).length < 50
      )
        fail("Informe responsável, e-mail e critérios de retenção completos.");
      await run(
        "INSERT INTO privacy_settings(id,controller,contact,retention,updated) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET controller=excluded.controller,contact=excluded.contact,retention=excluded.retention,updated=excluded.updated",
        "nimbus",
        clean(b.controller, 200),
        contact,
        clean(b.retention, 4000),
        now(),
      );
      await log(u.id, "privacy.settings", "nimbus");
    } else if (b.action === "respond") {
      if (
        !["responded", "in_progress"].includes(b.status) ||
        clean(b.response, 5000).length < 10
      )
        fail("Informe status e resposta fundamentada.");
      await run(
        "UPDATE privacy_requests SET status=?,response=?,updated=? WHERE id=?",
        b.status,
        clean(b.response, 5000),
        now(),
        clean(b.id, 100),
      );
      await log(u.id, "privacy.responded", clean(b.id, 100));
    } else fail("Ação inválida.");
    return json({ ok: true });
  }
  if (path[0] === "catalog" && method === "GET") {
    const products = (await catalog())
      .filter((p) => p.status === "published")
      .map(
        ({
          file_key,
          file_name,
          author_id,
          accepted_bps,
          accepted_owned,
          cover_key,
          preview_keys,
          ...p
        }) => ({
          ...p,
          has_cover: !!cover_key,
          preview_count: JSON.parse(preview_keys || "[]").length,
        }),
      );
    return json({ products, payments: paymentsReady(runtime()) });
  }
  if (path[0] === "me" && method === "GET") {
    const u = await who(req);
    if (!u) return json({ user: null });
    await auth(req);
    const profile = (await all("SELECT * FROM users WHERE id=?", u.id))[0];
    const favorites = await all(
      "SELECT product_id FROM favorites WHERE user_id=?",
      u.id,
    );
    return json({
      user: {
        ...profile,
        admin: u.admin,
        staff:
          (
            await all(
              "SELECT reviewer,support FROM staff_roles WHERE user_id=?",
              u.id,
            )
          )[0] || {},
      },
      favorites: favorites.map((f) => f.product_id),
    });
  }
  if (path[0] === "profile" && method === "POST") {
    const u = await auth(req),
      b = await body(req);
    const name = clean(b.name, 100);
    if (name.length < 2) fail("Informe seu nome.");
    await run(
      "UPDATE users SET name=?,course=?,institution=? WHERE id=?",
      name,
      clean(b.course, 100),
      clean(b.institution, 150),
      u.id,
    );
    return json({ ok: true });
  }
  if (path[0] === "favorites" && method === "POST") {
    const u = await auth(req),
      b = await body(req),
      id = clean(b.id, 100);
    if (!(await catalog()).some((p) => p.id === id && p.status === "published"))
      fail("Material não encontrado.", 404);
    const key = `${u.id}:${id}`;
    if (b.active)
      await run(
        "INSERT OR IGNORE INTO favorites(id,user_id,product_id) VALUES(?,?,?)",
        key,
        u.id,
        id,
      );
    else await run("DELETE FROM favorites WHERE id=?", key);
    return json({ ok: true });
  }
  if (path[0] === "checkout" && method === "POST") {
    const u = await auth(req),
      b = await body(req);
    if (b.accepted !== true) fail("Confirme que leu as condições da compra.");
    if (b.request_id && !/^[a-f0-9-]{36}$/i.test(b.request_id))
      fail("Identificador de checkout inválido.");
    const requestHash = b.request_id
      ? Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(u.id + ":" + b.request_id),
            ),
          ),
        )
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("")
      : uid();
    const previous = (
      await all<{
        id: string;
        status: string;
        total: number;
        checkout_url: string;
      }>("SELECT * FROM orders WHERE id=? AND user_id=?", requestHash, u.id)
    )[0];
    if (previous) {
      if (previous.status === "paid")
        return json({
          ok: true,
          order: previous.id,
          free: previous.total === 0,
        });
      if (previous.checkout_url && previous.status === "pending")
        return json({ url: previous.checkout_url, order: previous.id });
      fail(
        "Este checkout está sendo processado ou foi encerrado. Atualize seu carrinho para tentar novamente.",
        409,
      );
    }
    const seats = Number(b.seats || 1),
      giftEmail = clean(b.gift_email, 200).toLowerCase();
    if (!Number.isSafeInteger(seats) || seats < 1 || seats > 100)
      fail("Escolha de 1 a 100 licenças.");
    if (
      giftEmail &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(giftEmail) ||
        seats !== 1 ||
        giftEmail === u.email.toLowerCase())
    )
      fail("Presente exige uma licença e o e-mail de outra pessoa.");
    const ids = parseCart(b.ids);
    const products = await catalog();
    const selected = ids.map(
      (id) =>
        products.find((p) => p.id === id && p.status === "published") ||
        fail("Um material não está mais disponível.", 409),
    );
    const bundleMap = new Map<string, RichProduct[]>();
    const included = new Set<string>();
    for (const p of selected) {
      const children = await validateBundle(
        runtime(),
        p.id,
        p.author_id,
        bundleIds(p),
      );
      bundleMap.set(p.id, children);
      for (const child of children) {
        await assertSaleAvailable(runtime(), child.id);
        if (ids.includes(child.id) || included.has(child.id))
          fail("Há materiais repetidos entre os kits e o carrinho.", 409);
        included.add(child.id);
        if (!giftEmail && (await purchased(u.id, child.id)))
          fail(`Você já possui um material deste kit: ${child.title}`, 409);
      }
    }
    for (const p of selected) {
      await assertSaleAvailable(runtime(), p.id);
      if (!giftEmail && (await purchased(u.id, p.id)))
        fail(`Você já possui: ${p.title}`, 409);
      if (
        p.price > 0 &&
        (p.demo ||
          (!p.file_key &&
            !bundleMap.get(p.id)?.length &&
            !(await hasPackage(runtime(), p.id))))
      )
        fail("Este material é demonstrativo e ainda não está à venda.", 409);
      if (p.file_key && !(await BUCKET.head(p.file_key)))
        fail("Arquivo indisponível. Entre em contato com o suporte.", 409);
    }
    const policies = new Map<string, Awaited<ReturnType<typeof policy>>>();
    for (const p of selected) {
      const rule = await policy(runtime(), p.author_id);
      policies.set(p.id, rule);
      if (
        !p.demo &&
        (p.accepted_bps !== (rule.owned ? 0 : rule.commission_bps) ||
          p.accepted_owned !== rule.owned)
      )
        fail(
          "O autor precisa confirmar as condições comerciais deste material.",
          409,
        );
    }
    const quote = b.coupon
      ? await couponQuote(
          runtime(),
          b.coupon,
          selected.map((p) => ({
            ...p,
            price: p.price * seats,
            owned: policies.get(p.id)!.owned,
          })),
          u.id,
        )
      : null;
    if (b.referral_code && b.coupon)
      fail("Escolha cupom ou indicação; os descontos não se acumulam.");
    const referral = b.referral_code
      ? await prepareReferral(
          runtime(),
          u,
          clean(b.referral_code, 40),
          selected.map((p) => ({
            id: p.id,
            price: p.price * seats,
            owned: policies.get(p.id)!.owned,
          })),
        )
      : null;
    const priced = selected.map((p) => ({
      ...p,
      price:
        quote?.amounts.get(p.id) ??
        referral?.amounts.get(p.id) ??
        p.price * seats,
    }));
    const total = priced.reduce((s, p) => s + p.price, 0);
    if (total > 0) requirePayments(runtime());
    const id = requestHash;
    await run(
      "INSERT OR IGNORE INTO legal_acceptances(id,user_id,kind,version,details,created) VALUES(?,?,?,?,?,?)",
      id + ":purchase",
      u.id,
      "purchase_terms",
      "nimbus-terms-v2",
      JSON.stringify({
        ids,
        total,
        coupon: quote?.code,
        referral: referral?.account.code,
        discount: quote?.discount ?? referral?.discount,
        seats,
        giftEmail,
      }),
      now(),
    );
    await DB.batch([
      ...(referral ? [referralStatement(runtime(), u, id, referral)] : []),
      DB.prepare(
        "INSERT INTO orders (id,user_id,status,total,created) VALUES(?,?,?,?,?)",
      ).bind(id, u.id, total === 0 ? "paid" : "pending", total, now()),
      ...(seats > 1 || giftEmail
        ? [
            DB.prepare(
              "INSERT INTO order_licenses(order_id,seats,gift) VALUES(?,?,?)",
            ).bind(id, seats, giftEmail ? 1 : 0),
          ]
        : []),
      ...(giftEmail
        ? [
            DB.prepare(
              "INSERT INTO license_invites(id,order_id,email,created) VALUES(?,?,?,?)",
            ).bind(uid(), id, giftEmail, now()),
          ]
        : []),
      ...priced.map((p) =>
        DB.prepare(
          "INSERT INTO order_items (id,order_id,product_id,price,title,file_key,file_name,content,author_id,commission_bps,owned,policy_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        ).bind(
          uid(),
          id,
          p.id,
          p.price,
          p.title,
          p.file_key,
          p.file_name,
          p.preview,
          p.author_id,
          policies.get(p.id)!.owned ? 0 : policies.get(p.id)!.commission_bps,
          policies.get(p.id)!.owned,
          POLICY_VERSION,
        ),
      ),
      ...selected.flatMap((p) =>
        (bundleMap.get(p.id) || []).map((child) =>
          DB.prepare(
            "INSERT INTO order_assets(id,order_id,parent_id,product_id,title,file_key,file_name,content,version_id) VALUES(?,?,?,?,?,?,?,?,?)",
          ).bind(
            uid(),
            id,
            p.id,
            child.id,
            child.title,
            child.file_key,
            child.file_name,
            child.preview,
            null,
          ),
        ),
      ),
      ...(quote
        ? [
            DB.prepare(
              "INSERT INTO coupon_uses(order_id,code,user_id,discount,created) VALUES(?,?,?,?,?)",
            ).bind(id, quote.code, u.id, quote.discount, now()),
          ]
        : []),
    ]).catch((err) => {
      if (referral)
        fail(
          "Indicação já vinculada ou indisponível. Atualize os pedidos.",
          409,
        );
      if (quote)
        fail(
          "Cupom indisponível, já utilizado ou com limite atingido. Atualize o carrinho.",
          409,
        );
      throw err;
    });
    if (total === 0) {
      await reconcile(runtime(), id);
      await purchaseNotice(runtime(), id, u.id);
      return json({ ok: true, order: id, free: true });
    }
    const form = new URLSearchParams({
      mode: "payment",
      integration_identifier: CHECKOUT_INTEGRATION,
      success_url: `${url.origin}/?payment=success&order=${id}#${giftEmail || seats > 1 ? "licencas" : "biblioteca"}`,
      cancel_url: `${url.origin}/?payment=cancelled#carrinho`,
      "metadata[order_id]": id,
      client_reference_id: id,
      customer_email: u.email,
    });
    priced.forEach((p, i) => {
      form.set(`line_items[${i}][price_data][currency]`, "brl");
      form.set(`line_items[${i}][price_data][unit_amount]`, String(p.price));
      form.set(`line_items[${i}][price_data][product_data][name]`, p.title);
      form.set(`line_items[${i}][quantity]`, "1");
    });
    const response = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${runtime().STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Stripe-Version": STRIPE_API_VERSION,
          "Idempotency-Key": id,
        },
        body: form,
      },
    );
    const session = (await response.json()) as { id?: string; url?: string };
    if (!response.ok || !session.id || !session.url) {
      await run("UPDATE orders SET status=? WHERE id=?", "failed", id);
      fail("Não foi possível iniciar o pagamento. Tente novamente.", 502);
    }
    await run(
      "UPDATE orders SET session_id=?,checkout_url=? WHERE id=?",
      session.id,
      session.url,
      id,
    );
    return json({ url: session.url, order: id });
  }
  if (path[0] === "webhook" && method === "POST") {
    const secret = runtime().STRIPE_WEBHOOK_SECRET;
    if (!secret) fail("Webhook não configurado.", 503);
    const raw = await req.text();
    if (
      !(await verifyStripe(
        raw,
        req.headers.get("stripe-signature") || "",
        secret,
      ))
    )
      fail("Assinatura inválida.", 400);
    const event = JSON.parse(raw),
      s = event.data?.object;
    await syncRefundEvent(runtime(), event);
    await syncSubscriptionEvent(runtime(), event);
    await syncServiceEvent(runtime(), event);
    const order = (
      await all<{ id: string; total: number; status: string }>(
        "SELECT * FROM orders WHERE id=? AND session_id=?",
        s?.metadata?.order_id || "",
        s?.id || "",
      )
    )[0];
    const affected =
      order?.id ||
      (s?.payment_intent
        ? (
            await all<{ id: string }>(
              "SELECT id FROM orders WHERE payment_intent=?",
              typeof s.payment_intent === "string"
                ? s.payment_intent
                : s.payment_intent.id,
            )
          )[0]?.id
        : null);
    if (
      affected &&
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "charge.refunded",
        "charge.dispute.created",
      ].includes(event.type)
    ) {
      await run(
        "INSERT OR REPLACE INTO finance_events(id,order_id,type,detail,created) VALUES(?,?,?,?,?)",
        affected + ":hold",
        affected,
        "hold",
        "Aguardando conciliação do provedor",
        now(),
      );
    }
    if (
      event.type === "charge.refunded" &&
      s.refunded === true &&
      s.payment_intent
    )
      await run(
        "UPDATE orders SET status=? WHERE payment_intent=? AND status=?",
        "refunded",
        s.payment_intent,
        "paid",
      );
    if (
      order &&
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type) &&
      s.payment_status === "paid" &&
      s.amount_total === order.total &&
      s.currency === "brl"
    )
      await run(
        "UPDATE orders SET status=?,payment_intent=? WHERE id=? AND status=?",
        "paid",
        s.payment_intent || null,
        order.id,
        "pending",
      );
    if (
      order &&
      [
        "checkout.session.expired",
        "checkout.session.async_payment_failed",
      ].includes(event.type)
    )
      await run(
        "UPDATE orders SET status=? WHERE id=? AND status=?",
        "failed",
        order.id,
        "pending",
      );
    if (
      affected &&
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "charge.refunded",
      ].includes(event.type)
    ) {
      try {
        await reconcile(runtime(), affected);
      } catch (e) {
        console.warn("Finance pending", affected, (e as Error).message);
      }
    }
    if (
      order &&
      (
        await all<{ status: string }>(
          "SELECT status FROM orders WHERE id=?",
          order.id,
        )
      )[0]?.status === "paid" &&
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type)
    ) {
      const owner = (
        await all<{ user_id: string }>(
          "SELECT user_id FROM orders WHERE id=?",
          order.id,
        )
      )[0];
      if (s.metadata?.nimbus_service_kind) {
        const id = "service-paid:" + order.id;
        await notify(
          runtime(),
          id,
          owner.user_id,
          "Serviço confirmado",
          "Seu pagamento foi confirmado. Acompanhe encontros e entregas na área Serviços.",
          "/#servicos",
        );
        await deliver(runtime(), id);
      } else await purchaseNotice(runtime(), order.id, owner.user_id);
    }
    if (typeof event.id === "string")
      await run(
        "INSERT OR IGNORE INTO webhook_events(id,kind,created) VALUES(?,?,?)",
        event.id,
        event.type,
        now(),
      );
    return json({ received: true });
  }
  if (path[0] === "library" && method === "GET") {
    const u = await auth(req);
    const items = await all(
      `SELECT i.product_id,i.title,i.file_name,o.created,o.id order_id FROM order_items i JOIN orders o ON o.id=i.order_id WHERE ${orderAccess} AND o.status='paid' AND i.product_id NOT LIKE 'service:%' AND NOT EXISTS(SELECT 1 FROM order_assets a WHERE a.order_id=o.id AND a.parent_id=i.product_id) UNION ALL SELECT a.product_id,a.title,a.file_name,o.created,o.id order_id FROM order_assets a JOIN orders o ON o.id=a.order_id WHERE ${orderAccess} AND o.status='paid' ORDER BY created DESC`,
      u.id,
      u.id,
      u.id,
      u.id,
    );
    const subscribed = await all(
      "SELECT json_extract(a.value,'$.product_id') product_id,json_extract(a.value,'$.title') title,json_extract(a.value,'$.file_name') file_name,s.created,'subscription:'||s.id order_id FROM subscriptions s,json_each(s.assets) a WHERE s.user_id=? AND s.status='active' AND s.expires>?",
      u.id,
      now(),
    );
    items.push(...subscribed);
    const progress = await all("SELECT * FROM study WHERE user_id=?", u.id);
    return json({
      items: items
        .filter(
          (v, i, a) => a.findIndex((x) => x.product_id === v.product_id) === i,
        )
        .map((x) => ({
          ...x,
          ...progress.find((s) => s.product_id === x.product_id),
        })),
    });
  }
  if (path[0] === "orders" && method === "GET") {
    const u = await auth(req);
    const orders = await all(
      "SELECT * FROM orders WHERE user_id=? ORDER BY created DESC",
      u.id,
    );
    const items = await all(
      "SELECT i.* FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.user_id=?",
      u.id,
    );
    return json({
      orders: orders.map((o) => ({
        ...o,
        items: items
          .filter((i) => i.order_id === o.id)
          .map((i) => ({ title: i.title, price: i.price })),
      })),
    });
  }
  if (path[0] === "download" && path[1] && method === "GET") {
    const u = await auth(req);
    const item = await purchased(u.id, path[1]);
    if (!item) fail("Adquira o material para acessar o arquivo.", 403);
    const guide = freeGuides.find((g) => g.id === path[1]);
    if (guide) return Response.redirect(new URL(guide.url, req.url), 302);
    if (item.file_key) {
      const file = await BUCKET.get(String(item.file_key));
      if (!file) fail("Arquivo indisponível. Contate o suporte.", 404);
      const copy = await copyPdf(
        runtime(),
        u,
        path[1],
        String(item.file_key),
        String(item.file_name || "material.pdf"),
        file.body,
        item,
      );
      return new Response(copy.body as BodyInit, {
        headers: {
          "X-Nimbus-Watermark": copy.marked
            ? "applied"
            : copy.reason || "not_required",
          "Content-Type": fileMime(String(item.file_name || "material.pdf")),
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(String(item.file_name || "material.pdf"))}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return new Response(String(item.content), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="nimbus-guia.txt"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (path[0] === "study" && method === "POST") {
    const u = await auth(req),
      b = await body(req),
      id = clean(b.id, 100);
    if (!(await purchased(u.id, id))) fail("Material não adquirido.", 403);
    const progress = Math.max(
      0,
      Math.min(100, Math.round(Number(b.progress) || 0)),
    );
    await run(
      "INSERT INTO study(id,user_id,product_id,notes,progress) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET notes=excluded.notes,progress=excluded.progress",
      `${u.id}:${id}`,
      u.id,
      id,
      clean(b.notes, 20000),
      progress,
    );
    return json({ ok: true });
  }
  if (path[0] === "reviews" && method === "GET")
    return json({
      reviews: await all(
        "SELECT r.rating,r.comment,r.name,r.created,m.clarity,m.presentation,m.response FROM reviews r LEFT JOIN review_moderation m ON m.review_id=r.id WHERE r.product_id=? AND COALESCE(m.status,'visible')='visible' ORDER BY r.created DESC",
        url.searchParams.get("id") || "",
      ),
    });
  if (path[0] === "reviews" && method === "POST") {
    const u = await auth(req),
      b = await body(req),
      id = clean(b.id, 100);
    if (!(await purchased(u.id, id)))
      fail("Apenas compradores podem avaliar.", 403);
    if (!Number.isInteger(b.rating) || b.rating < 1 || b.rating > 5)
      fail("Avaliação inválida.");
    for (const value of [b.clarity, b.presentation])
      if (
        value !== undefined &&
        (!Number.isInteger(value) || value < 1 || value > 5)
      )
        fail("Avaliação por critério inválida.");
    const comment = clean(b.comment, 2000);
    if (comment.length < 10) fail("Escreva ao menos 10 caracteres.");
    const profile = (await all("SELECT name FROM users WHERE id=?", u.id))[0];
    await run(
      "INSERT INTO reviews(id,user_id,product_id,rating,comment,name,created) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET rating=excluded.rating,comment=excluded.comment",
      `${u.id}:${id}`,
      u.id,
      id,
      b.rating,
      comment,
      profile.name,
      now(),
    );
    await run(
      "INSERT INTO review_moderation(review_id,clarity,presentation,updated) VALUES(?,?,?,?) ON CONFLICT(review_id) DO UPDATE SET clarity=excluded.clarity,presentation=excluded.presentation,updated=excluded.updated",
      `${u.id}:${id}`,
      b.clarity || null,
      b.presentation || null,
      now(),
    );
    return json({ ok: true });
  }
  if (path[0] === "tickets") {
    const u = await auth(req);
    if (method === "GET")
      return json({
        tickets: await all(
          "SELECT * FROM tickets WHERE user_id=? ORDER BY created DESC",
          u.id,
        ),
      });
    if (method === "POST") {
      const b = await body(req);
      if (clean(b.subject).length < 3 || clean(b.message).length < 10)
        fail("Descreva o assunto e a solicitação.");
      const orderId = clean(b.order_id, 100);
      if (
        orderId &&
        !(
          await all(
            "SELECT id FROM orders WHERE id=? AND user_id=?",
            orderId,
            u.id,
          )
        ).length
      )
        fail("Pedido não encontrado em sua conta.", 403);
      await limitRate(runtime(), u.id, "new-ticket", 10);
      await run(
        "INSERT INTO tickets(id,user_id,subject,message,created,order_id) VALUES(?,?,?,?,?,?)",
        uid(),
        u.id,
        clean(b.subject, 150),
        clean(b.message, 5000),
        now(),
        orderId || null,
      );
      return json({ ok: true });
    }
  }
  if (path[0] === "author") {
    const u = await auth(req);
    if (method === "GET") {
      const products = (await catalog()).filter((p) => p.author_id === u.id);
      const sales = await all(
        "SELECT i.product_id,i.price,o.created FROM order_items i JOIN orders o ON o.id=i.order_id JOIN products p ON p.id=i.product_id WHERE p.author_id=? AND o.status='paid'",
        u.id,
      );
      return json({
        products,
        editorial: await all(
          "SELECT e.* FROM editorial_events e JOIN products p ON p.id=e.product_id WHERE p.author_id=? ORDER BY e.created DESC",
          u.id,
        ),
        sales,
        policy: await policy(runtime(), u.id),
        finance: await financialReport(runtime(), u.id),
      });
    }
    if (method === "POST") {
      const b = await body(req);
      if (b.id) {
        const previous = (
          await all<Product>(
            "SELECT * FROM products WHERE id=? AND author_id=?",
            b.id,
            u.id,
          )
        )[0];
        if (previous)
          await run(
            "INSERT INTO product_changes(id,product_id,actor,snapshot,created) VALUES(?,?,?,?,?)",
            uid(),
            b.id,
            u.id,
            JSON.stringify({
              title: previous.title,
              description: previous.description,
              price: previous.price,
              preview: previous.preview,
              objectives: previous.objectives,
              toc: previous.toc,
              sources: previous.sources,
            }),
            now(),
          );
      }
      validProduct({ ...b });
      const terms = await policy(runtime(), u.id);
      if (
        b.accepted_rate !== (terms.owned ? 0 : terms.commission_bps) ||
        b.accepted_owned !== terms.owned
      )
        fail(
          "As condições comerciais mudaram. Atualize a página e confirme a nova regra.",
          409,
        );
      if (b.commercial_accepted !== true)
        fail("Confirme as condições comerciais antes de salvar.");
      if (b.rights !== true)
        fail("Confirme a autoria ou autorização de publicação.");
      const legacyCourse = Object.values(areas).flat().includes(b.category)
        ? b.category
        : "";
      const normalized = normalizeProduct({
        category: b.category,
        format: b.format,
        course: b.course || legacyCourse,
        level: b.level,
        language: b.language,
        created: now(),
      });
      b.category = normalized.category;
      b.format = normalized.format;
      if (
        !categories.slice(1).includes(b.category) ||
        !formats.includes(b.format)
      )
        fail("Área ou formato inválido.");
      if (
        !areas[b.category].includes(normalized.course) ||
        !levels.includes(normalized.level) ||
        !languages.includes(normalized.language)
      )
        fail("Curso, nível ou idioma inválido.");
      const id = clean(b.id, 100) || uid();
      const existing = (await catalog()).find((p) => p.id === id);
      if (existing && existing.author_id !== u.id) fail("Acesso negado.", 403);
      if (
        clean(b.description, 5000).length < 30 ||
        clean(b.preview, 20000).length < 50
      )
        fail("Inclua descrição e prévia mais completas.");
      const profile = (await all("SELECT name FROM users WHERE id=?", u.id))[0];
      if (existing?.file_name?.toLowerCase().endsWith(".pdf")) {
        const check = (
          await all("SELECT result FROM upload_checks WHERE product_id=?", id)
        )[0];
        try {
          const pages = JSON.parse(String(check?.result || "{}")).pages;
          if (Number.isInteger(pages) && pages > 0) b.pages = pages;
        } catch {}
      }
      if (existing)
        await run(
          "UPDATE products SET title=?,description=?,category=?,subject=?,format=?,price=?,pages=?,preview=?,status=? WHERE id=?",
          clean(b.title, 150),
          clean(b.description, 5000),
          b.category,
          clean(b.subject, 100),
          b.format,
          b.price,
          b.pages,
          clean(b.preview, 20000),
          "draft",
          id,
        );
      else
        await run(
          "INSERT INTO products(id,author_id,title,description,category,subject,format,price,pages,author,preview,status,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
          id,
          u.id,
          clean(b.title, 150),
          clean(b.description, 5000),
          b.category,
          clean(b.subject, 100),
          b.format,
          b.price,
          b.pages,
          profile.name,
          clean(b.preview, 20000),
          "draft",
          now(),
        );
      await run(
        "UPDATE products SET reviewed_by=NULL,reviewed_at=NULL WHERE id=?",
        id,
      );
      await run(
        "UPDATE products SET course=?,level=?,language=?,updated=?,topic=? WHERE id=?",
        normalized.course,
        normalized.level,
        normalized.language,
        now(),
        clean(b.topic, 120),
        id,
      );
      await run(
        "UPDATE products SET accepted_bps=?,accepted_owned=? WHERE id=?",
        terms.owned ? 0 : terms.commission_bps,
        terms.owned,
        id,
      );
      await run(
        "INSERT INTO legal_acceptances(id,user_id,kind,version,details,created) VALUES(?,?,?,?,?,?)",
        uid(),
        u.id,
        "author_terms",
        POLICY_VERSION,
        JSON.stringify({
          product: id,
          rate: terms.owned ? 0 : terms.commission_bps,
          owned: terms.owned,
        }),
        now(),
      );
      const profileSlug = (
        await all<{ author_slug: string | null }>(
          "SELECT author_slug FROM users WHERE id=?",
          u.id,
        )
      )[0];
      if (!profileSlug.author_slug) {
        const digest = Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(u.id),
            ),
          ),
        )
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
        await run(
          "UPDATE users SET author_slug=? WHERE id=?",
          "autor-" + digest.slice(0, 16),
          u.id,
        );
      }
      await log(u.id, "product.saved", id);
      return json({ ok: true, id });
    }
  }
  if (path[0] === "upload" && method === "POST") {
    const u = await auth(req),
      form = await req.formData(),
      id = clean(form.get("id"), 100),
      file = form.get("file");
    const product = (await catalog()).find((p) => p.id === id);
    if (!product || (product.author_id !== u.id && !u.admin))
      fail("Acesso negado.", 403);
    if (
      !(file instanceof File) ||
      file.size > 20 * 1024 * 1024 ||
      file.size < 5 ||
      !fileTypes.includes(file.name.split(".").pop()?.toUpperCase() || "")
    )
      fail("Envie um arquivo de formato aceito com até 20 MB.");
    const buffer = await file.arrayBuffer();
    if (
      file.name.toLowerCase().endsWith(".pdf") &&
      new TextDecoder().decode(buffer.slice(0, 5)) !== "%PDF-"
    )
      fail("Arquivo PDF inválido.");
    const pdfInfo = file.name.toLowerCase().endsWith(".pdf")
      ? await inspectPdf(new Uint8Array(buffer))
      : null;
    const ext = file.name.split(".").pop()?.toUpperCase() || "";
    const bytes = new Uint8Array(buffer);
    const textHeader = new TextDecoder().decode(buffer.slice(0, 1024));
    if (
      ["ZIP", "DOCX", "XLSX", "PPTX"].includes(ext) &&
      !(bytes[0] === 80 && bytes[1] === 75)
    )
      fail("O arquivo não corresponde ao formato informado.");
    if (
      ext === "PNG" &&
      !(
        bytes[0] === 137 &&
        bytes[1] === 80 &&
        bytes[2] === 78 &&
        bytes[3] === 71
      )
    )
      fail("PNG inválido.");
    if (
      ["JPG", "JPEG"].includes(ext) &&
      !(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    )
      fail("JPEG inválido.");
    if (
      ["TXT", "CSV"].includes(ext) &&
      (/<script|<html|<iframe/i.test(textHeader) ||
        bytes.slice(0, 1024).some((x) => x === 0))
    )
      fail("Arquivo de texto inválido.");
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
    )
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const matches = await all<{ product_id: string }>(
      "SELECT product_id FROM upload_checks WHERE hash=? AND product_id!=?",
      hash,
      id,
    );
    await run(
      "INSERT INTO upload_checks(product_id,hash,size,extension,result,created) VALUES(?,?,?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET hash=excluded.hash,size=excluded.size,extension=excluded.extension,result=excluded.result,created=excluded.created",
      id,
      hash,
      file.size,
      ext,
      JSON.stringify({
        signature: true,
        duplicate: matches.length > 0,
        pages: pdfInfo?.pages ?? null,
        declared_pages: product.pages,
        mismatch: !!pdfInfo && pdfInfo.pages !== product.pages,
      }),
      now(),
    );
    if (matches.length)
      await run(
        "INSERT INTO operation_events(id,kind,message,created) VALUES(?,?,?,?)",
        uid(),
        "duplicate_upload",
        "Arquivo repetido detectado para análise editorial. Material " + id,
        now(),
      );
    const key = `materials/${id}/${uid()}.${file.name.split(".").pop()?.toLowerCase()}`;
    await BUCKET.put(key, buffer, {
      httpMetadata: { contentType: fileMime(file.name) },
    });
    await run(
      "UPDATE products SET file_key=?,file_name=?,status=?,updated=? WHERE id=?",
      key,
      file.name.slice(0, 180),
      "pending",
      now(),
      id,
    );
    if (pdfInfo)
      await run("UPDATE products SET pages=? WHERE id=?", pdfInfo.pages, id);
    const revision =
      clean(form.get("notes"), 4000) || "Arquivo enviado para revisão.";
    await run(
      "INSERT INTO product_versions(id,product_id,sequence,file_key,file_name,notes,status,created) SELECT ?,?,COALESCE(MAX(sequence),0)+1,?,?,?,'pending',? FROM product_versions WHERE product_id=?",
      uid(),
      id,
      key,
      file.name.slice(0, 180),
      revision,
      now(),
      id,
    );
    await run(
      "UPDATE products SET reviewed_by=NULL,reviewed_at=NULL WHERE id=?",
      id,
    );
    await log(u.id, "product.submitted", id);
    return json({ ok: true });
  }
  if (path[0] === "admin-file" && path[1] && method === "GET") {
    await admin(req);
    const p = (await catalog()).find((p) => p.id === path[1]);
    if (!p?.file_key) fail("Arquivo não encontrado.", 404);
    const file = await BUCKET.get(p.file_key);
    if (!file) fail("Arquivo não encontrado.", 404);
    return new Response(file.body, {
      headers: {
        "Content-Type": fileMime(p.file_name || "material.pdf"),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(p.file_name || "material")}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (path[0] === "finance") {
    const u = await admin(req);
    if (method === "GET") {
      const accounts = await all<{ id: string; email: string; name: string }>(
        "SELECT id,email,name FROM users",
      );
      return json({
        finance: await financialReport(runtime()),
        accounts: await Promise.all(
          accounts.map(async (a) => ({
            ...a,
            ...(await policy(runtime(), a.id)),
          })),
        ),
      });
    }
    const b = await body(req);
    if (b.action === "policy") {
      if (
        !Number.isInteger(b.commission_bps) ||
        b.commission_bps! < 0 ||
        b.commission_bps! > 10000 ||
        typeof b.owned !== "boolean"
      )
        fail("Comissão inválida.");
      if (!(await all("SELECT id FROM users WHERE id=?", b.id)).length)
        fail("Autor não encontrado.", 404);
      const old = await policy(runtime(), b.id);
      await DB.batch([
        DB.prepare(
          "INSERT INTO author_accounts(id,commission_bps,owned,updated) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET commission_bps=excluded.commission_bps,owned=excluded.owned,updated=excluded.updated",
        ).bind(b.id, b.commission_bps, b.owned ? 1 : 0, now()),
        DB.prepare(
          "UPDATE products SET status='draft' WHERE author_id=? AND (accepted_bps IS NULL OR accepted_bps!=? OR accepted_owned IS NULL OR accepted_owned!=?)",
        ).bind(b.id, b.owned ? 0 : b.commission_bps, b.owned ? 1 : 0),
      ]);
      await log(
        u.id,
        "author.policy",
        JSON.stringify({
          id: b.id,
          old,
          rate: b.commission_bps,
          owned: b.owned,
        }),
      );
    } else if (b.action === "reconcile") {
      await reconcile(runtime(), b.id);
      await log(u.id, "finance.reconciled", b.id);
    } else if (b.action === "payout") {
      const id = await recordPayout(
        runtime(),
        b.id,
        b.amount!,
        clean(b.reference, 180),
        u.id,
      );
      await log(u.id, "payout.recorded", id);
    } else fail("Ação inválida.");
    return json({ ok: true });
  }
  if (["staff-review", "staff-support", "review-file"].includes(path[0])) {
    const u = await auth(req),
      role = (
        await all<{ reviewer: number; support: number }>(
          "SELECT reviewer,support FROM staff_roles WHERE user_id=?",
          u.id,
        )
      )[0];
    const review = path[0] !== "staff-support";
    if (!u.admin && !(review ? role?.reviewer : role?.support))
      fail("Acesso restrito a esta função.", 403);
    if (path[0] === "review-file") {
      const p = (await catalog()).find((p) => p.id === path[1]);
      if (!p?.file_key) fail("Arquivo não encontrado.", 404);
      const file = await BUCKET.get(p.file_key);
      if (!file) fail("Arquivo não encontrado.", 404);
      return new Response(file.body, {
        headers: {
          "Content-Type": fileMime(p.file_name || "material.pdf"),
          "Cache-Control": "private,no-store",
          "Content-Disposition": 'attachment; filename="material-revisao"',
        },
      });
    }
    if (method === "GET")
      return review
        ? json({
            products: (await catalog())
              .filter(
                (p) =>
                  !p.demo &&
                  ["draft", "pending", "changes_requested"].includes(p.status),
              )
              .map((p) => ({
                ...publicDTO(p),
                status: p.status,
                author_id: p.author_id,
                file_key: p.file_key ? "available" : null,
                file_name: p.file_name,
              })),
          })
        : json({
            tickets: await all(
              "SELECT id,subject,message,response,status,created FROM tickets ORDER BY created DESC LIMIT 100",
            ),
          });
    const b = await body(req);
    if (review) {
      const p = (await catalog()).find((p) => p.id === b.id);
      if (!u.admin && p?.author_id === u.id)
        fail("A revisão de seu próprio material exige outro revisor.", 403);
      await moderateProduct(u, { ...b, action: "product" });
    } else await respondTicket(u, { ...b, action: "ticket" });
    return json({ ok: true });
  }
  if (path[0] === "admin") {
    const u = await admin(req);
    if (method === "GET") {
      if (url.searchParams.has("section")) {
        const section = url.searchParams.get("section") || "",
          page = Math.max(
            1,
            Math.min(10000, Number(url.searchParams.get("page")) || 1),
          ),
          limit = 20;
        const sources: Record<
          string,
          { key: string; sql: string; count: string }
        > = {
          produtos: {
            key: "products",
            sql: "SELECT p.*,u.author_slug FROM products p LEFT JOIN users u ON u.id=p.author_id ORDER BY p.created DESC",
            count: "SELECT COUNT(*) n FROM products",
          },
          aprovações: {
            key: "products",
            sql: "SELECT p.*,u.author_slug FROM products p LEFT JOIN users u ON u.id=p.author_id WHERE p.demo=0 AND p.status IN ('draft','pending','changes_requested') ORDER BY p.created DESC",
            count:
              "SELECT COUNT(*) n FROM products WHERE demo=0 AND status IN ('draft','pending','changes_requested')",
          },
          pessoas: {
            key: "users",
            sql: "SELECT id,name,email,created FROM users ORDER BY created DESC",
            count: "SELECT COUNT(*) n FROM users",
          },
          pedidos: {
            key: "orders",
            sql: "SELECT o.*,u.name,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created DESC",
            count: "SELECT COUNT(*) n FROM orders",
          },
          atendimento: {
            key: "tickets",
            sql: "SELECT t.*,u.email FROM tickets t JOIN users u ON u.id=t.user_id ORDER BY t.created DESC",
            count: "SELECT COUNT(*) n FROM tickets",
          },
          histórico: {
            key: "audit",
            sql: "SELECT * FROM audit ORDER BY created DESC",
            count: "SELECT COUNT(*) n FROM audit",
          },
        };
        const source = sources[section],
          result = {
            products: [],
            users: [],
            orders: [],
            tickets: [],
            audit: [],
          } as Record<string, unknown>;
        if (source) {
          result[source.key] = await all(
            source.sql + " LIMIT ? OFFSET ?",
            limit,
            (page - 1) * limit,
          );
          result.pagination = {
            page,
            limit,
            total: Number((await all(source.count))[0]?.n || 0),
          };
        }
        return json(result);
      }
      return json({
        products: await catalog(),
        users: await all(
          "SELECT id,name,email,created FROM users ORDER BY created DESC",
        ),
        orders: await all(
          "SELECT o.*,u.name,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created DESC",
        ),
        tickets: await all(
          "SELECT t.*,u.email FROM tickets t JOIN users u ON u.id=t.user_id ORDER BY t.created DESC",
        ),
        audit: await all("SELECT * FROM audit ORDER BY created DESC LIMIT 100"),
      });
    }
    if (method === "POST") {
      const b = await body(req);
      if (b.action === "product") await moderateProduct(u, b);
      else if (b.action === "ticket") await respondTicket(u, b);
      else fail("Ação inválida.");
      return json({ ok: true });
    }
  }
  fail("Recurso não encontrado.", 404);
}
async function handler(req: Request) {
  try {
    if (Number(req.headers.get("content-length")) > 21 * 1024 * 1024)
      return json({ error: "Solicitação muito grande." }, 413);
    return await dispatch(req);
  } catch (e) {
    const error = e as Error & { status?: number };
    if (error.status) return json({ error: error.message }, error.status);
    if (e instanceof SyntaxError)
      return json({ error: "Dados inválidos." }, 400);
    if (
      [
        "Referência de repasse",
        "Valores financeiros",
        "Rateio",
        "Dados de repasse",
        "Saldo não liberado",
        "Pedido sem pagamento",
        "Pedido anterior",
        "Aguardando dados",
        "Pagamento sem taxa",
        "Taxa alterada",
        "Não foi possível consultar",
      ].some((x) => error.message.startsWith(x)) ||
      error.message.startsWith("Carrinho") ||
      error.message.includes("inválido") ||
      error.message.startsWith("Título") ||
      error.message.startsWith("Número")
    )
      return json({ error: error.message }, 400);
    console.error("Nimbus API error", error.message);
    try {
      await run(
        "INSERT INTO operation_events(id,kind,message,created) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM operation_events WHERE created>=?)<100",
        uid(),
        "api_error",
        "Falha inesperada em " +
          new URL(req.url).pathname.split("/").slice(0, 3).join("/"),
        now(),
        now().slice(0, 10),
      );
    } catch {}
    return json(
      {
        error:
          "Não foi possível concluir. Tente novamente ou contate o suporte.",
      },
      500,
    );
  }
}
export const GET = handler;
export const POST = handler;
