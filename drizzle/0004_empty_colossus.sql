CREATE TABLE `author_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`commission_bps` integer DEFAULT 2500 NOT NULL,
	`owned` integer DEFAULT 0 NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `finance_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`type` text NOT NULL,
	`detail` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reference` text NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payouts_reference_unique` ON `payouts` (`reference`);--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`author_id` text NOT NULL,
	`gross` integer NOT NULL,
	`fee` integer NOT NULL,
	`rate` integer NOT NULL,
	`platform` integer NOT NULL,
	`author_net` integer NOT NULL,
	`refunded_gross` integer DEFAULT 0 NOT NULL,
	`refunded_author` integer DEFAULT 0 NOT NULL,
	`release_at` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `order_items` ADD `author_id` text;--> statement-breakpoint
ALTER TABLE `order_items` ADD `commission_bps` integer;--> statement-breakpoint
ALTER TABLE `order_items` ADD `owned` integer;--> statement-breakpoint
ALTER TABLE `order_items` ADD `policy_version` text;--> statement-breakpoint
ALTER TABLE `products` ADD `accepted_bps` integer;