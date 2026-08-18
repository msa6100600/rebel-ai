CREATE TABLE `rebel_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(32) NOT NULL,
	`displayName` varchar(64) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`role` enum('user','owner') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastLoginAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rebel_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `rebel_accounts_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `rebel_daily_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`usageDate` varchar(10) NOT NULL,
	`requestCount` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rebel_daily_usage_id` PRIMARY KEY(`id`),
	CONSTRAINT `rebel_usage_account_day_unique` UNIQUE(`accountId`,`usageDate`)
);
--> statement-breakpoint
CREATE TABLE `rebel_provider_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`provider` enum('gemini','groq','mistral') NOT NULL,
	`encryptedKey` text NOT NULL,
	`iv` varchar(64) NOT NULL,
	`authTag` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rebel_provider_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `rebel_key_account_provider_unique` UNIQUE(`accountId`,`provider`)
);
