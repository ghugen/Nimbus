CREATE TABLE `profile_verifications` (
	`user_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'unverified' NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`reviewer` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `editorial_events` ADD `checks` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `product_ids` text DEFAULT '[]' NOT NULL;