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
  orderId: text("order_id"),
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
  checks: text("checks").notNull().default("[]"),
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

export const readerStates = sqliteTable("reader_states", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: text("product_id").notNull(),
  page: integer("page").notNull().default(1),
  zoom: integer("zoom").notNull().default(100),
  folder: text("folder").notNull().default(""),
  status: text("status").notNull().default("not_started"),
  nextReview: text("next_review").notNull().default(""),
  updated: text("updated").notNull(),
});
export const pageAnnotations = sqliteTable("page_annotations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: text("product_id").notNull(),
  page: integer("page").notNull(),
  kind: text("kind").notNull(),
  text: text("text").notNull(),
  created: text("created").notNull(),
});
export const savedSearches = sqliteTable("saved_searches", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  filters: text("filters").notNull(),
  created: text("created").notNull(),
});
export const authorFollows = sqliteTable("author_follows", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  authorId: text("author_id").notNull(),
  notify: integer("notify").notNull().default(0),
  created: text("created").notNull(),
});
export const studentPreferences = sqliteTable("student_preferences", {
  userId: text("user_id").primaryKey(),
  interests: text("interests").notNull().default("[]"),
  updated: text("updated").notNull(),
});
export const productExtras = sqliteTable("product_extras", {
  productId: text("product_id").primaryKey(),
  prerequisites: text("prerequisites").notNull().default(""),
  audience: text("audience").notNull().default(""),
  exclusions: text("exclusions").notNull().default(""),
  requirements: text("requirements").notNull().default(""),
  faq: text("faq").notNull().default(""),
  checklist: text("checklist").notNull().default("{}"),
  updated: text("updated").notNull(),
});
export const authorDrafts = sqliteTable("author_drafts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(1),
  updated: text("updated").notNull(),
});
export const productChanges = sqliteTable("product_changes", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  actor: text("actor").notNull(),
  snapshot: text("snapshot").notNull(),
  created: text("created").notNull(),
});
export const productQuestions = sqliteTable("product_questions", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  userId: text("user_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull().default(""),
  status: text("status").notNull().default("pending"),
  created: text("created").notNull(),
  updated: text("updated").notNull(),
});
export const refundRequests = sqliteTable("refund_requests", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  userId: text("user_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("requested"),
  response: text("response").notNull().default(""),
  providerId: text("provider_id"),
  amount: integer("amount").notNull().default(0),
  created: text("created").notNull(),
  updated: text("updated").notNull(),
});
export const operationTasks = sqliteTable("operation_tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  owner: text("owner").notNull().default(""),
  deadline: text("deadline").notNull().default(""),
  status: text("status").notNull().default("open"),
  notes: text("notes").notNull().default(""),
  updated: text("updated").notNull(),
});
export const roadmapTasks = sqliteTable("roadmap_tasks", {
  id: integer("id").primaryKey(),
  owner: text("owner").notNull().default(""),
  deadline: text("deadline").notNull().default(""),
  status: text("status").notNull().default("open"),
  notes: text("notes").notNull().default(""),
  updated: text("updated").notNull(),
});
export const qualityReports = sqliteTable("quality_reports", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  userId: text("user_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  response: text("response").notNull().default(""),
  created: text("created").notNull(),
  updated: text("updated").notNull(),
});
export const reviewModeration = sqliteTable("review_moderation", {
  reviewId: text("review_id").primaryKey(),
  status: text("status").notNull().default("visible"),
  response: text("response").notNull().default(""),
  reason: text("reason").notNull().default(""),
  clarity: integer("clarity"),
  presentation: integer("presentation"),
  updated: text("updated").notNull(),
});
export const uploadChecks = sqliteTable("upload_checks", {
  productId: text("product_id").primaryKey(),
  hash: text("hash").notNull(),
  size: integer("size").notNull(),
  extension: text("extension").notNull(),
  result: text("result").notNull(),
  created: text("created").notNull(),
});
export const operationEvents = sqliteTable("operation_events", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  created: text("created").notNull(),
});
export const rateBuckets = sqliteTable("rate_buckets", {
  id: text("id").primaryKey(),
  count: integer("count").notNull().default(1),
  expires: text("expires").notNull(),
});

export const learningPackages = sqliteTable("learning_packages", {
  publishedCards: text("published_cards").notNull().default("[]"),
  publishedQuestions: text("published_questions").notNull().default("[]"),
  publishedLessons: text("published_lessons").notNull().default("[]"),
  productId: text("product_id").primaryKey(),
  cards: text("cards").notNull().default("[]"),
  questions: text("questions").notNull().default("[]"),
  lessons: text("lessons").notNull().default("[]"),
  updated: text("updated").notNull(),
});
export const lessonProgress = sqliteTable("lesson_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: text("product_id").notNull(),
  lessonId: text("lesson_id").notNull(),
  completed: integer("completed").notNull().default(0),
  updated: text("updated").notNull(),
});
export const cardReviews = sqliteTable("card_reviews", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: text("product_id").notNull(),
  cardId: text("card_id").notNull(),
  due: text("due").notNull(),
  level: text("level").notNull(),
  updated: text("updated").notNull(),
});
export const quizAttempts = sqliteTable("quiz_attempts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: text("product_id").notNull(),
  score: integer("score").notNull(),
  total: integer("total").notNull(),
  answers: text("answers").notNull(),
  created: text("created").notNull(),
});
export const serviceOffers = sqliteTable("service_offers", {
  id: text("id").primaryKey(),
  authorId: text("author_id").notNull(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  duration: integer("duration").notNull(),
  capacity: integer("capacity").notNull(),
  status: text("status").notNull().default("draft"),
  terms: text("terms").notNull(),
  requiredPlanId: text("required_plan_id").notNull().default(""),
  created: text("created").notNull(),
});
export const serviceSlots = sqliteTable("service_slots", {
  id: text("id").primaryKey(),
  offerId: text("offer_id").notNull(),
  starts: text("starts").notNull(),
  ends: text("ends").notNull(),
  meetingUrl: text("meeting_url").notNull().default(""),
  status: text("status").notNull().default("open"),
});
export const serviceBookings = sqliteTable("service_bookings", {
  id: text("id").primaryKey(),
  offerId: text("offer_id").notNull(),
  slotId: text("slot_id").notNull(),
  userId: text("user_id").notNull(),
  status: text("status").notNull().default("requested"),
  price: integer("price").notNull().default(0),
  sessionId: text("session_id"),
  checkoutUrl: text("checkout_url"),
  created: text("created").notNull(),
});
export const serviceQuotes = sqliteTable("service_quotes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  offerId: text("offer_id").notNull(),
  brief: text("brief").notNull(),
  status: text("status").notNull().default("requested"),
  price: integer("price"),
  response: text("response").notNull().default(""),
  delivery: text("delivery").notNull().default(""),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  sessionId: text("session_id"),
  checkoutUrl: text("checkout_url"),
  created: text("created").notNull(),
  updated: text("updated").notNull(),
});
export const subscriptionPlans = sqliteTable("subscription_plans", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull().default(0),
  interval: text("interval").notNull().default("month"),
  stripePriceId: text("stripe_price_id").notNull().default(""),
  productIds: text("product_ids").notNull().default("[]"),
  status: text("status").notNull().default("draft"),
  created: text("created").notNull(),
});
export const subscriptions = sqliteTable("subscriptions", {
  assets: text("assets").notNull().default("[]"),
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  planId: text("plan_id").notNull(),
  productIds: text("product_ids").notNull().default("[]"),
  providerId: text("provider_id"),
  customerId: text("customer_id"),
  sessionId: text("session_id"),
  checkoutUrl: text("checkout_url"),
  status: text("status").notNull().default("pending"),
  expires: text("expires").notNull().default(""),
  created: text("created").notNull(),
});
export const staffRoles = sqliteTable("staff_roles", {
  userId: text("user_id").primaryKey(),
  reviewer: integer("reviewer").notNull().default(0),
  support: integer("support").notNull().default(0),
  updated: text("updated").notNull(),
});
export const publicationSchedule = sqliteTable("publication_schedule", {
  productId: text("product_id").primaryKey(),
  releaseAt: text("release_at").notNull(),
  approved: integer("approved").notNull().default(0),
  created: text("created").notNull(),
});
export const orderLicenses = sqliteTable("order_licenses", {
  orderId: text("order_id").primaryKey(),
  seats: integer("seats").notNull().default(1),
  gift: integer("gift").notNull().default(0),
});
export const licenseInvites = sqliteTable("license_invites", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  email: text("email").notNull(),
  userId: text("user_id"),
  created: text("created").notNull(),
});

export const clubPosts = sqliteTable("club_posts", {
  id: text("id").primaryKey(),
  planId: text("plan_id").notNull(),
  title: text("title").notNull(),
  text: text("text").notNull(),
  created: text("created").notNull(),
});

export const profileVerifications = sqliteTable("profile_verifications", {
  userId: text("user_id").primaryKey(),
  status: text("status").notNull().default("unverified"),
  label: text("label").notNull().default(""),
  evidence: text("evidence").notNull().default(""),
  reviewer: text("reviewer").notNull(),
  updated: text("updated").notNull(),
});

export const demandIdeas = sqliteTable("demand_ideas", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  course: text("course").notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  response: text("response").notNull().default(""),
  productId: text("product_id"),
  created: text("created").notNull(),
  updated: text("updated").notNull(),
});
export const demandVotes = sqliteTable("demand_votes", {
  id: text("id").primaryKey(),
  ideaId: text("idea_id").notNull(),
  userId: text("user_id").notNull(),
  created: text("created").notNull(),
});
export const growthSettings = sqliteTable("growth_settings", {
  id: text("id").primaryKey(),
  value: text("value").notNull(),
  updated: text("updated").notNull(),
});
export const partnerAccounts = sqliteTable("partner_accounts", {
  userId: text("user_id").primaryKey(),
  code: text("code").unique().notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("pending"),
  rateBps: integer("rate_bps").notNull().default(0),
  terms: text("terms").notNull(),
  accepted: text("accepted").notNull(),
  updated: text("updated").notNull(),
});
export const referralSales = sqliteTable("referral_sales", {
  discount: integer("discount").notNull().default(0),
  orderId: text("order_id").primaryKey(),
  referrerId: text("referrer_id").notNull(),
  buyerId: text("buyer_id").unique().notNull(),
  code: text("code").notNull(),
  kind: text("kind").notNull(),
  rateBps: integer("rate_bps").notNull(),
  rewardCents: integer("reward_cents").notNull().default(0),
  minTotal: integer("min_total").notNull(),
  created: text("created").notNull(),
});
export const affiliatePayouts = sqliteTable("affiliate_payouts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: integer("amount").notNull(),
  reference: text("reference").unique().notNull(),
  actor: text("actor").notNull(),
  created: text("created").notNull(),
});
export const referralRewards = sqliteTable("referral_rewards", {
  orderId: text("order_id").primaryKey(),
  code: text("code").unique().notNull(),
  status: text("status").notNull(),
  created: text("created").notNull(),
});
export const institutionRequests = sqliteTable("institution_requests", {
  quotedItems: text("quoted_items").notNull().default("[]"),
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  organization: text("organization").notNull(),
  course: text("course").notNull(),
  message: text("message").notNull(),
  seats: integer("seats").notNull(),
  productIds: text("product_ids").notNull(),
  status: text("status").notNull().default("requested"),
  price: integer("price"),
  scope: text("scope").notNull().default(""),
  expires: text("expires").notNull().default(""),
  created: text("created").notNull(),
  updated: text("updated").notNull(),
});
export const productPolicies = sqliteTable("product_policies", {
  productId: text("product_id").primaryKey(),
  watermark: integer("watermark").notNull().default(1),
  aiEnabled: integer("ai_enabled").notNull().default(0),
  updated: text("updated").notNull(),
});
export const reviewSchedules = sqliteTable("review_schedules", {
  productId: text("product_id").primaryKey(),
  nextReview: text("next_review").notNull(),
  pauseSales: integer("pause_sales").notNull().default(0),
  lastReview: text("last_review").notNull().default(""),
  reviewer: text("reviewer").notNull().default(""),
  notes: text("notes").notNull().default(""),
  updated: text("updated").notNull(),
});
export const downloadCopies = sqliteTable("download_copies", {
  id: text("id").primaryKey(),
  copyCode: text("copy_code").unique().notNull(),
  userId: text("user_id").notNull(),
  orderId: text("order_id").notNull(),
  productId: text("product_id").notNull(),
  fileKey: text("file_key").notNull(),
  created: text("created").notNull(),
});
export const tutorUsage = sqliteTable("tutor_usage", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  day: text("day").notNull(),
  count: integer("count").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
});
export const launchTasks = sqliteTable("launch_tasks", {
  id: text("id").primaryKey(),
  productId: text("product_id"),
  status: text("status").notNull().default("planned"),
  notes: text("notes").notNull().default(""),
  updated: text("updated").notNull(),
});

export const couponRestrictions = sqliteTable("coupon_restrictions", {
  code: text("code").primaryKey(),
  userId: text("user_id").notNull(),
});
export const affiliateCredits = sqliteTable("affiliate_credits", {
  orderId: text("order_id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: integer("amount").notNull(),
  available: integer("available").notNull(),
  updated: text("updated").notNull(),
});

export const operationDocuments = sqliteTable("operation_documents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull(),
  orderId: text("order_id"),
  reference: text("reference").notNull().default(""),
  status: text("status").notNull().default("requested"),
  url: text("url").notNull().default(""),
  notes: text("notes").notNull().default(""),
  created: text("created").notNull(),
  updated: text("updated").notNull(),
});

export const ticketMessages = sqliteTable("ticket_messages", {
  id: text("id").primaryKey(),
  ticketId: text("ticket_id").notNull(),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  created: text("created").notNull(),
});

export const productExperience = sqliteTable("product_experience", {
  productId: text("product_id").primaryKey(),
  updatePolicy: text("update_policy").notNull(),
  sampleDescriptions: text("sample_descriptions").notNull().default("[]"),
  updated: text("updated").notNull(),
});
export const studyFeedback = sqliteTable("study_feedback", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  userId: text("user_id").notNull(),
  helpfulness: integer("helpfulness").notNull(),
  difficulty: text("difficulty").notNull(),
  missing: text("missing").notNull().default(""),
  created: text("created").notNull(),
  updated: text("updated").notNull(),
});
export const searchSignals = sqliteTable("search_signals", {
  id: text("id").primaryKey(),
  course: text("course").notNull(),
  subject: text("subject").notNull(),
  kind: text("kind").notNull(),
  created: text("created").notNull(),
});
export const usabilitySessions = sqliteTable("usability_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tasks: text("tasks").notNull(),
  device: text("device").notNull(),
  notes: text("notes").notNull(),
  created: text("created").notNull(),
});
export const orderUpdateTerms = sqliteTable("order_update_terms", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  productId: text("product_id").notNull(),
  terms: text("terms").notNull(),
  created: text("created").notNull(),
});
