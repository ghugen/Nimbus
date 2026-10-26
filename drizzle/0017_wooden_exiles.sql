CREATE TABLE `affiliate_credits` (
	`order_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`available` integer NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `coupon_restrictions` (
	`code` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `referral_sales` ADD `discount` integer DEFAULT 0 NOT NULL;