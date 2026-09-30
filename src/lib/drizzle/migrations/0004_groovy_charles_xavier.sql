CREATE TABLE `rate_limits` (
	`count` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limits_key_unique` ON `rate_limits` (`key`);--> statement-breakpoint
CREATE INDEX `rate_limits_last_request_idx` ON `rate_limits` (`last_request`);