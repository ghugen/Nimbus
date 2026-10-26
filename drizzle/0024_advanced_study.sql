CREATE TABLE `academic_metadata` (
	`product_id` text PRIMARY KEY NOT NULL,
	`draft` text DEFAULT '{}' NOT NULL,
	`published` text DEFAULT '{}' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `adaptive_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`card_id` text NOT NULL,
	`interval` integer NOT NULL,
	`repetitions` integer NOT NULL,
	`lapses` integer NOT NULL,
	`due` text NOT NULL,
	`exam_date` text DEFAULT '' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_editorial_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`sources` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `personal_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`page` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `practice_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`questions` text NOT NULL,
	`answers` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`deadline` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	`finished` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`card_id` text NOT NULL,
	`result` text NOT NULL,
	`created` text NOT NULL
);
