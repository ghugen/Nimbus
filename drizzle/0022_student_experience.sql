CREATE TABLE `order_update_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`terms` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_experience` (
	`product_id` text PRIMARY KEY NOT NULL,
	`update_policy` text NOT NULL,
	`sample_descriptions` text DEFAULT '[]' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `search_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`course` text NOT NULL,
	`subject` text NOT NULL,
	`kind` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`user_id` text NOT NULL,
	`helpfulness` integer NOT NULL,
	`difficulty` text NOT NULL,
	`missing` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usability_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tasks` text NOT NULL,
	`device` text NOT NULL,
	`notes` text NOT NULL,
	`created` text NOT NULL
);
