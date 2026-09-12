CREATE TABLE `organizer_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`subject` text,
	`due_at` text,
	`created_at` text NOT NULL,
	`operation_key` text NOT NULL,
	`request_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizer_entries_operation_key_unique` ON `organizer_entries` (`operation_key`);--> statement-breakpoint
CREATE INDEX `idx_entries_user_time` ON `organizer_entries` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `event_facts` (
	`key` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`retrieved_at` text NOT NULL,
	`as_of` text,
	`layer` text NOT NULL,
	`value_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `live_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_time` ON `live_sessions` (`user_id`,`created_at`);