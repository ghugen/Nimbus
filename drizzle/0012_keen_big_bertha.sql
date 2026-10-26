CREATE TABLE `club_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`title` text NOT NULL,
	`text` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `service_bookings` ADD `price` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `service_bookings` ADD `session_id` text;--> statement-breakpoint
ALTER TABLE `service_bookings` ADD `checkout_url` text;--> statement-breakpoint
ALTER TABLE `service_offers` ADD `required_plan_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `service_quotes` ADD `payment_status` text DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE `service_quotes` ADD `session_id` text;--> statement-breakpoint
ALTER TABLE `service_quotes` ADD `checkout_url` text;--> statement-breakpoint
ALTER TABLE `subscription_plans` ADD `amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `subscription_plans` ADD `interval` text DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `customer_id` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `session_id` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `checkout_url` text;--> statement-breakpoint
CREATE TRIGGER service_slots_no_overlap BEFORE INSERT ON service_slots BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM service_slots s JOIN service_offers old ON old.id=s.offer_id JOIN service_offers newoffer ON newoffer.id=NEW.offer_id WHERE old.author_id=newoffer.author_id AND s.status='open' AND s.starts<NEW.ends AND s.ends>NEW.starts) THEN RAISE(ABORT,'Horários sobrepostos') END;
END;
