CREATE TABLE `annotation_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`annotation_id` text NOT NULL,
	`card_id` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`started` text NOT NULL,
	`finished` text DEFAULT '' NOT NULL,
	`finish_token` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`page` integer DEFAULT 1 NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`next_review` text DEFAULT '' NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX study_session_active ON study_sessions(user_id,product_id) WHERE finished='';
--> statement-breakpoint
CREATE INDEX study_session_history ON study_sessions(user_id,product_id,started);
