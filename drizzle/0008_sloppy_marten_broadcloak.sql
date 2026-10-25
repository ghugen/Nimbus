CREATE TABLE `collections` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`course` text NOT NULL,
	`subject` text NOT NULL,
	`product_ids` text DEFAULT '[]' NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `content_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`page` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`response` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `coupon_uses` (
	`order_id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`user_id` text NOT NULL,
	`discount` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`code` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`value` integer NOT NULL,
	`min_total` integer DEFAULT 0 NOT NULL,
	`max_uses` integer NOT NULL,
	`starts` text NOT NULL,
	`ends` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `material_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course` text NOT NULL,
	`subject` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`response` text DEFAULT '' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX coupon_once_per_user ON coupon_uses(code,user_id);
--> statement-breakpoint
CREATE INDEX content_issues_product ON content_issues(product_id,created);
--> statement-breakpoint
CREATE INDEX material_requests_user ON material_requests(user_id,created);
--> statement-breakpoint
CREATE TRIGGER coupon_capacity BEFORE INSERT ON coupon_uses BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM coupons c WHERE c.code=NEW.code AND c.active=1 AND c.starts<=NEW.created AND c.ends>=NEW.created AND (SELECT COUNT(*) FROM coupon_uses x JOIN orders o ON o.id=x.order_id WHERE x.code=c.code AND o.status NOT IN ('failed','expired'))<c.max_uses) THEN RAISE(ABORT,'Cupom indisponível ou limite atingido') END;
END;
--> statement-breakpoint
CREATE TRIGGER coupon_release_failed AFTER UPDATE OF status ON orders WHEN NEW.status IN ('failed','expired') BEGIN
 DELETE FROM coupon_uses WHERE order_id=NEW.id;
END;
