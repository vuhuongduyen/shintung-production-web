CREATE TABLE `production_example_records` (
	`entity` text NOT NULL,
	`record_key` text NOT NULL,
	`payload` text NOT NULL,
	`updated_by` text DEFAULT 'web-user' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_production_examples_entity` ON `production_example_records` (`entity`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_production_examples_entity_key` ON `production_example_records` (`entity`,`record_key`);