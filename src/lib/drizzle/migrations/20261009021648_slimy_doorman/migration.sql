DROP INDEX IF EXISTS `accounts_issuer_account_id_uidx`;--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_provider_id_account_id_uidx` ON `accounts` (`provider_id`,`account_id`);--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `issuer`;