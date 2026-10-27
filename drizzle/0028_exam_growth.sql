CREATE TABLE `recommendation_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`reason` text NOT NULL,
	`updated` text NOT NULL
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS recommendation_feedback_user ON recommendation_feedback(user_id);
