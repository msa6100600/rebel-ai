CREATE TABLE `rebel_evidence_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`projectId` int NOT NULL,
	`kind` enum('claim','evidence','assumption','decision') NOT NULL,
	`title` varchar(180) NOT NULL,
	`content` text NOT NULL,
	`confidence` int NOT NULL DEFAULT 50,
	`verificationStatus` enum('unverified','reviewing','verified','rejected') NOT NULL DEFAULT 'unverified',
	`sourceMemoryId` int,
	`sourceConversationId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rebel_evidence_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `rebel_evidence_account_project_updated_idx` ON `rebel_evidence_items` (`accountId`,`projectId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `rebel_evidence_account_status_idx` ON `rebel_evidence_items` (`accountId`,`verificationStatus`);