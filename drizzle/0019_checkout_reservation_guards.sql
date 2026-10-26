CREATE INDEX demand_votes_idea ON demand_votes(idea_id);
--> statement-breakpoint
CREATE INDEX affiliate_credits_user ON affiliate_credits(user_id,available);
--> statement-breakpoint
CREATE INDEX review_schedules_due ON review_schedules(next_review);
--> statement-breakpoint
CREATE INDEX download_copies_user ON download_copies(user_id);
--> statement-breakpoint
CREATE TRIGGER orders_coupon_reactivation BEFORE UPDATE OF status ON orders
WHEN OLD.status IN ('failed','expired') AND NEW.status='pending' AND EXISTS(
 SELECT 1 FROM coupon_uses u JOIN coupons c ON c.code=u.code WHERE u.order_id=NEW.id AND (
 c.active!=1 OR c.ends<strftime('%Y-%m-%dT%H:%M:%fZ','now') OR
 (SELECT COUNT(*) FROM coupon_uses x JOIN orders o ON o.id=x.order_id WHERE x.code=c.code AND o.status NOT IN ('failed','expired') AND o.id!=NEW.id)>=c.max_uses OR
 EXISTS(SELECT 1 FROM coupon_uses x JOIN orders o ON o.id=x.order_id WHERE x.code=c.code AND x.user_id=NEW.user_id AND o.status NOT IN ('failed','expired') AND o.id!=NEW.id)
 ))
BEGIN SELECT RAISE(ABORT,'coupon_reservation_unavailable'); END;
--> statement-breakpoint
CREATE TRIGGER booking_reactivation_capacity BEFORE UPDATE OF status ON service_bookings
WHEN OLD.status NOT IN ('requested','pending','confirmed') AND NEW.status IN ('pending','confirmed') AND NOT EXISTS(
 SELECT 1 FROM service_slots s JOIN service_offers o ON o.id=s.offer_id WHERE s.id=NEW.slot_id AND o.status='published' AND s.status='open' AND s.starts>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND
 (SELECT COUNT(*) FROM service_bookings b WHERE b.slot_id=NEW.slot_id AND b.status IN ('requested','pending','confirmed') AND b.id!=NEW.id)<o.capacity
)
BEGIN SELECT RAISE(ABORT,'booking_capacity_unavailable'); END;
