CREATE TABLE `accounts` (
	`access_token` text,
	`access_token_expires_at` integer,
	`account_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`id_token` text,
	`password` text,
	`provider_id` text NOT NULL,
	`refresh_token` text,
	`refresh_token_expires_at` integer,
	`scope` text,
	`updated_at` integer NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_provider_id_account_id_uidx` ON `accounts` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`count` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limits_last_request_idx` ON `rate_limits` (`last_request`);--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limits_key_unique` ON `rate_limits` (`key`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`ip_address` text,
	`token` text NOT NULL,
	`updated_at` integer NOT NULL,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `users` (
	`avatar_key` text,
	`created_at` integer NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer,
	`id` text PRIMARY KEY NOT NULL,
	`image` text,
	`name` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`created_at` integer,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`updated_at` integer,
	`value` text NOT NULL
);
