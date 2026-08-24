ALTER TABLE `rebel_analytics_events` ADD `routerReason` varchar(40);--> statement-breakpoint
ALTER TABLE `rebel_analytics_events` ADD `routerOrder` varchar(255);--> statement-breakpoint
CREATE INDEX `rebel_analytics_router_reason_idx` ON `rebel_analytics_events` (`routerReason`,`occurredAt`);