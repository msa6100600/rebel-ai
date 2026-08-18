CREATE TABLE `rebel_analytics_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`provider` varchar(32),
	`model` varchar(128),
	`outcome` enum('ok','daily_limit','rate_limited','provider_error','fallback_error') NOT NULL,
	`fallbackUsed` int NOT NULL DEFAULT 0,
	`latencyMs` int,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rebel_analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `rebel_analytics_occurred_idx` ON `rebel_analytics_events` (`occurredAt`);--> statement-breakpoint
CREATE INDEX `rebel_analytics_account_occurred_idx` ON `rebel_analytics_events` (`accountId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `rebel_analytics_provider_occurred_idx` ON `rebel_analytics_events` (`provider`,`occurredAt`);