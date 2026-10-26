CREATE TABLE `card_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`card_id` text NOT NULL,
	`due` text NOT NULL,
	`level` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_packages` (
	`product_id` text PRIMARY KEY NOT NULL,
	`cards` text DEFAULT '[]' NOT NULL,
	`questions` text DEFAULT '[]' NOT NULL,
	`lessons` text DEFAULT '[]' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lesson_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `license_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`email` text NOT NULL,
	`user_id` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_licenses` (
	`order_id` text PRIMARY KEY NOT NULL,
	`seats` integer DEFAULT 1 NOT NULL,
	`gift` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `publication_schedule` (
	`product_id` text PRIMARY KEY NOT NULL,
	`release_at` text NOT NULL,
	`approved` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`score` integer NOT NULL,
	`total` integer NOT NULL,
	`answers` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `service_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` text NOT NULL,
	`slot_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `service_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`duration` integer NOT NULL,
	`capacity` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`terms` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `service_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`offer_id` text NOT NULL,
	`brief` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`price` integer,
	`response` text DEFAULT '' NOT NULL,
	`delivery` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `service_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` text NOT NULL,
	`starts` text NOT NULL,
	`ends` text NOT NULL,
	`meeting_url` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff_roles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`reviewer` integer DEFAULT 0 NOT NULL,
	`support` integer DEFAULT 0 NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`stripe_price_id` text DEFAULT '' NOT NULL,
	`product_ids` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`provider_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires` text DEFAULT '' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX license_invite_unique ON license_invites(order_id,email);
--> statement-breakpoint
CREATE UNIQUE INDEX active_service_booking ON service_bookings(slot_id,user_id) WHERE status IN ('requested','pending','confirmed');
--> statement-breakpoint
CREATE TRIGGER booking_capacity BEFORE INSERT ON service_bookings WHEN NEW.status IN ('requested','pending','confirmed') BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM service_offers o JOIN service_slots s ON s.offer_id=o.id WHERE o.id=NEW.offer_id AND s.id=NEW.slot_id AND o.status='published' AND s.status='open' AND (SELECT COUNT(*) FROM service_bookings b WHERE b.slot_id=s.id AND b.status IN ('requested','pending','confirmed'))<o.capacity) THEN RAISE(ABORT,'Vagas indisponíveis') END;
END;
