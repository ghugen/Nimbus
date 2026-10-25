import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  course: text("course").notNull().default(""),
  institution: text("institution").notNull().default(""),
  authorSlug: text("author_slug").unique(),
  bio: text("bio").notNull().default(""),
  credentials: text("credentials").notNull().default(""),
  publicName: text("public_name").notNull().default(""),
  profilePublic: integer("profile_public").notNull().default(0),
  created: text("created").notNull(),
});
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  acceptedBps: integer("accepted_bps"),
  acceptedOwned: integer("accepted_owned"),
  authorId: text("author_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  subject: text("subject").notNull(),
  topic: text("topic").notNull().default(""),
  course: text("course").notNull().default(""),
  level: text("level").notNull().default("Graduação"),
  language: text("language").notNull().default("Português"),
  updated: text("updated").notNull().default(""),
  format: text("format").notNull(),
  price: integer("price").notNull(),
  pages: integer("pages").notNull(),
  author: text("author").notNull(),
  preview: text("preview").notNull(),
  objectives: text("objectives").notNull().default(""),
  toc: text("toc").notNull().default(""),
  sources: text("sources").notNull().default(""),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  revisionNotes: text("revision_notes").notNull().default(""),
  coverKey: text("cover_key"),
  previewKeys: text("preview_keys").notNull().default("[]"),
  bundleIds: text("bundle_ids").notNull().default("[]"),
  status: text("status").notNull().default("draft"),
  fileKey: text("file_key"),
  fileName: text("file_name"),
  demo: integer("demo").notNull().default(0),
  created: text("created").notNull(),
});
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  status: text("status").notNull(),
  total: integer("total").notNull(),
  sessionId: text("session_id").unique(),
  checkoutUrl: text("checkout_url"),
  paymentIntent: text("payment_intent"),
  created: text("created").notNull(),
});
export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  productId: text("product_id").notNull(),
  authorId: text("author_id"),
  commissionBps: integer("commission_bps"),
  owned: integer("owned"),
  policyVersion: text("policy_version"),
  price: integer("price").notNull(),
  title: text("title").notNull(),
  fileKey: text("file_key"),
  fileName: text("file_name"),
  content: text("content"),
});
export const favorites = sqliteTable("favorites", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: text("product_id").notNull(),
});
export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: text("product_id").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  name: text("name").notNull(),
  created: text("created").notNull(),
});
export const study = sqliteTable("study", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: text("product_id").notNull(),
  notes: text("notes").notNull().default(""),
  progress: integer("progress").notNull().default(0),
});
export const tickets = sqliteTable("tickets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  response: text("response").notNull().default(""),
  created: text("created").notNull(),
});
export const audit = sqliteTable("audit", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  created: text("created").notNull(),
});

export const authorAccounts = sqliteTable("author_accounts", {
  id: text("id").primaryKey(),
  commissionBps: integer("commission_bps").notNull().default(2500),
  owned: integer("owned").notNull().default(0),
  updated: text("updated").notNull(),
});
export const settlements = sqliteTable("settlements", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  authorId: text("author_id").notNull(),
  gross: integer("gross").notNull(),
  fee: integer("fee").notNull(),
  rate: integer("rate").notNull(),
  platform: integer("platform").notNull(),
  authorNet: integer("author_net").notNull(),
  refundedGross: integer("refunded_gross").notNull().default(0),
  refundedAuthor: integer("refunded_author").notNull().default(0),
  releaseAt: integer("release_at").notNull(),
  created: text("created").notNull(),
});
export const payouts = sqliteTable("payouts", {
  id: text("id").primaryKey(),
  authorId: text("author_id").notNull(),
  amount: integer("amount").notNull(),
  reference: text("reference").notNull().unique(),
  actor: text("actor").notNull(),
  created: text("created").notNull(),
});
export const financeEvents = sqliteTable("finance_events", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  type: text("type").notNull(),
  detail: text("detail").notNull(),
  created: text("created").notNull(),
});

export const privacySettings = sqliteTable("privacy_settings", {
  id: text("id").primaryKey(),
  controller: text("controller").notNull().default(""),
  contact: text("contact").notNull().default(""),
  retention: text("retention").notNull().default(""),
  updated: text("updated").notNull(),
});
export const privacyRequests = sqliteTable("privacy_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  response: text("response").notNull().default(""),
  created: text("created").notNull(),
  updated: text("updated").notNull(),
});
export const legalAcceptances = sqliteTable("legal_acceptances", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull(),
  version: text("version").notNull(),
  details: text("details").notNull(),
  created: text("created").notNull(),
});

export const productVersions = sqliteTable("product_versions", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  sequence: integer("sequence").notNull(),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  notes: text("notes").notNull(),
  status: text("status").notNull().default("pending"),
  created: text("created").notNull(),
  released: text("released"),
});
export const editorialEvents = sqliteTable("editorial_events", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  action: text("action").notNull(),
  feedback: text("feedback").notNull(),
  reviewer: text("reviewer").notNull(),
  created: text("created").notNull(),
});
export const orderAssets = sqliteTable("order_assets", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  parentId: text("parent_id").notNull(),
  productId: text("product_id").notNull(),
  title: text("title").notNull(),
  fileKey: text("file_key"),
  fileName: text("file_name"),
  content: text("content").notNull(),
  versionId: text("version_id"),
});
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  href: text("href").notNull(),
  read: integer("read").notNull().default(0),
  created: text("created").notNull(),
});
export const emailOutbox = sqliteTable("email_outbox", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"),
  providerId: text("provider_id"),
  lastError: text("last_error").notNull().default(""),
  created: text("created").notNull(),
  sent: text("sent"),
});
export const analyticsEvents = sqliteTable("analytics_events", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  kind: text("kind").notNull(),
  created: text("created").notNull(),
});
export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  created: text("created").notNull(),
});

export const coupons = sqliteTable("coupons", {
  code: text("code").primaryKey(),
  kind: text("kind").notNull(),
  value: integer("value").notNull(),
  minTotal: integer("min_total").notNull().default(0),
  maxUses: integer("max_uses").notNull(),
  starts: text("starts").notNull(),
  ends: text("ends").notNull(),
  active: integer("active").notNull().default(1),
  created: text("created").notNull(),
});
export const couponUses = sqliteTable("coupon_uses", {
  orderId: text("order_id").primaryKey(),
  code: text("code").notNull(),
  userId: text("user_id").notNull(),
  discount: integer("discount").notNull(),
  created: text("created").notNull(),
});
export const collections = sqliteTable("collections", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  course: text("course").notNull(),
  subject: text("subject").notNull(),
  productIds: text("product_ids").notNull().default("[]"),
  published: integer("published").notNull().default(0),
  created: text("created").notNull(),
});
export const materialRequests = sqliteTable("material_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  course: text("course").notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  response: text("response").notNull().default(""),
  created: text("created").notNull(),
});
export const contentIssues = sqliteTable("content_issues", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: text("product_id").notNull(),
  page: text("page").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  response: text("response").notNull().default(""),
  created: text("created").notNull(),
  updated: text("updated").notNull(),
});

export const commercialPlan = sqliteTable("commercial_plan", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("evaluate"),
  priority: text("priority").notNull().default("normal"),
  notes: text("notes").notNull().default(""),
  updated: text("updated").notNull(),
});
