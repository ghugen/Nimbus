CREATE TABLE `editorial_adoptions` (
	`id` text PRIMARY KEY NOT NULL,
	`created` text NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX practice_one_active ON practice_sessions(user_id,product_id) WHERE status='active';
--> statement-breakpoint
CREATE INDEX practice_history ON practice_sessions(user_id,product_id,created);
--> statement-breakpoint
CREATE INDEX personal_cards_owner ON personal_cards(user_id,product_id);
--> statement-breakpoint
CREATE INDEX review_queue_owner ON adaptive_reviews(user_id,product_id,due);
