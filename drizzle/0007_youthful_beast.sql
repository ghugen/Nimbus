CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`kind` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `editorial_events` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`action` text NOT NULL,
	`feedback` text NOT NULL,
	`reviewer` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_id` text,
	`last_error` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	`sent` text
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`href` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`parent_id` text NOT NULL,
	`product_id` text NOT NULL,
	`title` text NOT NULL,
	`file_key` text,
	`file_name` text,
	`content` text NOT NULL,
	`version_id` text
);
--> statement-breakpoint
CREATE TABLE `product_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`file_key` text NOT NULL,
	`file_name` text NOT NULL,
	`notes` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created` text NOT NULL,
	`released` text
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `products` ADD `objectives` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `toc` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `sources` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `reviewed_by` text;--> statement-breakpoint
ALTER TABLE `products` ADD `reviewed_at` text;--> statement-breakpoint
ALTER TABLE `products` ADD `revision_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `cover_key` text;--> statement-breakpoint
ALTER TABLE `products` ADD `preview_keys` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `bundle_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `author_slug` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `credentials` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `public_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `profile_public` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_author_slug_unique` ON `users` (`author_slug`);