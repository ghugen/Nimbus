CREATE TABLE `sofia_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`profile` text DEFAULT '{}' NOT NULL,
	`plan` text DEFAULT '{}' NOT NULL,
	`plan_id` text DEFAULT '' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sofia_task_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`task_id` text NOT NULL,
	`created` text NOT NULL
);

--> statement-breakpoint
CREATE INDEX sofia_tasks_owner ON sofia_task_checks(user_id,plan_id);
