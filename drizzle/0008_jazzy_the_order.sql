CREATE TABLE `rebel_project_artifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`projectId` int NOT NULL,
	`type` enum('document','plan','table','decision') NOT NULL,
	`title` varchar(180) NOT NULL,
	`content` text NOT NULL,
	`sourceConversationId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rebel_project_artifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `rebel_artifact_account_project_updated_idx` ON `rebel_project_artifacts` (`accountId`,`projectId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `rebel_artifact_account_type_idx` ON `rebel_project_artifacts` (`accountId`,`type`);