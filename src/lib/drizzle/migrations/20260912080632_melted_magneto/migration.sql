PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`id_token` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`issuer` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_accounts`(
	`id`,
	`user_id`,
	`account_id`,
	`provider_id`,
	`access_token`,
	`refresh_token`,
	`access_token_expires_at`,
	`refresh_token_expires_at`,
	`scope`,
	`id_token`,
	`created_at`,
	`updated_at`,
	`issuer`
)
SELECT
	`id`,
	`user_id`,
	`account_id`,
	`provider_id`,
	`access_token`,
	`refresh_token`,
	`access_token_expires_at`,
	`refresh_token_expires_at`,
	`scope`,
	`id_token`,
	`created_at`,
	`updated_at`,
	CASE
		WHEN `provider_id` = 'google' THEN 'https://accounts.google.com'
		ELSE 'local:oauth:' || `provider_id`
	END
FROM `accounts`;--> statement-breakpoint
DROP TABLE `accounts`;--> statement-breakpoint
ALTER TABLE `__new_accounts` RENAME TO `accounts`;--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_issuer_account_id_uidx` ON `accounts` (`issuer`,`account_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
