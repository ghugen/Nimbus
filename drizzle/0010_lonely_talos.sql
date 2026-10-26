CREATE TABLE `author_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `author_follows` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`author_id` text NOT NULL,
	`notify` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operation_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`deadline` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `page_annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`page` integer NOT NULL,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`actor` text NOT NULL,
	`snapshot` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_extras` (
	`product_id` text PRIMARY KEY NOT NULL,
	`prerequisites` text DEFAULT '' NOT NULL,
	`audience` text DEFAULT '' NOT NULL,
	`exclusions` text DEFAULT '' NOT NULL,
	`requirements` text DEFAULT '' NOT NULL,
	`faq` text DEFAULT '' NOT NULL,
	`checklist` text DEFAULT '{}' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`user_id` text NOT NULL,
	`question` text NOT NULL,
	`answer` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quality_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`response` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_buckets` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reader_states` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`page` integer DEFAULT 1 NOT NULL,
	`zoom` integer DEFAULT 100 NOT NULL,
	`folder` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`next_review` text DEFAULT '' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `refund_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`response` text DEFAULT '' NOT NULL,
	`provider_id` text,
	`amount` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refund_requests_order_id_unique` ON `refund_requests` (`order_id`);--> statement-breakpoint
CREATE TABLE `review_moderation` (
	`review_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`response` text DEFAULT '' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`clarity` integer,
	`presentation` integer,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roadmap_tasks` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`deadline` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved_searches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`filters` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `student_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`interests` text DEFAULT '[]' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `upload_checks` (
	`product_id` text PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`size` integer NOT NULL,
	`extension` text NOT NULL,
	`result` text NOT NULL,
	`created` text NOT NULL
);
