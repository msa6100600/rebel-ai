CREATE TABLE `rebel_conversation_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`conversationId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`model` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rebel_conversation_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rebel_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rebel_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rebel_memory_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`category` enum('profile','preference','goal','project','decision','temporary') NOT NULL,
	`title` varchar(180) NOT NULL,
	`content` text NOT NULL,
	`sourceConversationId` int,
	`approvedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rebel_memory_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rebel_rate_windows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`windowKey` varchar(20) NOT NULL,
	`requestCount` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rebel_rate_windows_id` PRIMARY KEY(`id`),
	CONSTRAINT `rebel_rate_account_window_unique` UNIQUE(`accountId`,`windowKey`)
);
--> statement-breakpoint
CREATE INDEX `rebel_message_account_conversation_idx` ON `rebel_conversation_messages` (`accountId`,`conversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `rebel_conversation_account_updated_idx` ON `rebel_conversations` (`accountId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `rebel_memory_account_category_idx` ON `rebel_memory_items` (`accountId`,`category`);--> statement-breakpoint
CREATE INDEX `rebel_memory_account_updated_idx` ON `rebel_memory_items` (`accountId`,`updatedAt`);