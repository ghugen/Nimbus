CREATE TABLE `editorial_tools` (
	`product_id` text PRIMARY KEY NOT NULL,
	`draft` text DEFAULT '{}' NOT NULL,
	`published` text DEFAULT '{}' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `evolution_records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`course` text DEFAULT '' NOT NULL,
	`semester` text DEFAULT '' NOT NULL,
	`product_ids` text DEFAULT '[]' NOT NULL,
	`due` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
