CREATE TABLE `operation_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`order_id` text,
	`reference` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
