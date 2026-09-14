CREATE TABLE `app_records` (
	`entity` text NOT NULL,
	`record_key` text NOT NULL,
	`payload` text NOT NULL,
	`updated_by` text DEFAULT 'web-user' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_app_records_entity` ON `app_records` (`entity`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_app_records_entity_key` ON `app_records` (`entity`,`record_key`);