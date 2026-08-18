ALTER TABLE `rebel_accounts` ADD `email` varchar(320);--> statement-breakpoint
ALTER TABLE `rebel_accounts` ADD CONSTRAINT `rebel_accounts_email_unique` UNIQUE(`email`);