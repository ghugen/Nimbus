import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  course: text("course").notNull().default(""),
  institution: text("institution").notNull().default(""),
  created: text("created").notNull(),
});
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
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
