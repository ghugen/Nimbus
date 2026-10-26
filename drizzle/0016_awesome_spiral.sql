CREATE TABLE `affiliate_payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reference` text NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `affiliate_payouts_reference_unique` ON `affiliate_payouts` (`reference`);--> statement-breakpoint
CREATE TABLE `demand_ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`course` text NOT NULL,
	`subject` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`response` text DEFAULT '' NOT NULL,
	`product_id` text,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `demand_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`idea_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `download_copies` (
	`id` text PRIMARY KEY NOT NULL,
	`copy_code` text NOT NULL,
	`user_id` text NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`file_key` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `download_copies_copy_code_unique` ON `download_copies` (`copy_code`);--> statement-breakpoint
CREATE TABLE `growth_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `institution_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`organization` text NOT NULL,
	`course` text NOT NULL,
	`message` text NOT NULL,
	`seats` integer NOT NULL,
	`product_ids` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`price` integer,
	`scope` text DEFAULT '' NOT NULL,
	`expires` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `launch_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `partner_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`rate_bps` integer DEFAULT 0 NOT NULL,
	`terms` text NOT NULL,
	`accepted` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_accounts_code_unique` ON `partner_accounts` (`code`);--> statement-breakpoint
CREATE TABLE `product_policies` (
	`product_id` text PRIMARY KEY NOT NULL,
	`watermark` integer DEFAULT 1 NOT NULL,
	`ai_enabled` integer DEFAULT 0 NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `referral_rewards` (
	`order_id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_rewards_code_unique` ON `referral_rewards` (`code`);--> statement-breakpoint
CREATE TABLE `referral_sales` (
	`order_id` text PRIMARY KEY NOT NULL,
	`referrer_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`rate_bps` integer NOT NULL,
	`reward_cents` integer DEFAULT 0 NOT NULL,
	`min_total` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_sales_buyer_id_unique` ON `referral_sales` (`buyer_id`);--> statement-breakpoint
CREATE TABLE `review_schedules` (
	`product_id` text PRIMARY KEY NOT NULL,
	`next_review` text NOT NULL,
	`pause_sales` integer DEFAULT 0 NOT NULL,
	`last_review` text DEFAULT '' NOT NULL,
	`reviewer` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tutor_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL
);
