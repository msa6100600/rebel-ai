CREATE TABLE `rebel_memory_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`autoSaveAllowed` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rebel_memory_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `rebel_memory_settings_account_unique` UNIQUE(`accountId`)
);
--> statement-breakpoint
CREATE TABLE `rebel_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`instructions` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rebel_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `rebel_conversations` ADD `projectId` int;--> statement-breakpoint
ALTER TABLE `rebel_memory_items` ADD `projectId` int;--> statement-breakpoint
ALTER TABLE `rebel_memory_items` ADD `importance` int DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `rebel_memory_items` ADD `expiresAt` timestamp;--> statement-breakpoint
CREATE INDEX `rebel_project_account_updated_idx` ON `rebel_projects` (`accountId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `rebel_memory_account_project_idx` ON `rebel_memory_items` (`accountId`,`projectId`);