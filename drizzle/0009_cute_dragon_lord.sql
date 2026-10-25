CREATE TABLE `commercial_plan` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'evaluate' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated` text NOT NULL
);
