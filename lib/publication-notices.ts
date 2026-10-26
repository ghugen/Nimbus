import { type StoreRuntime } from "./catalog-services";
import { notify, deliver, type NotificationRuntime } from "./notifications";
export async function publicationNotices(
  e: StoreRuntime & NotificationRuntime,
  p: { id: string; title: string; author_id: string },
  revision: string,
  updated = false,
  includeFollowers = true,
) {
  const followers = (
    await e.DB.prepare(
      "SELECT user_id FROM author_follows WHERE author_id=? AND notify=1",
    )
      .bind(p.author_id)
      .all<{ user_id: string }>()
  ).results;
  if (includeFollowers)
    for (const f of followers) {
      const id = "publication:" + p.id + ":" + revision + ":" + f.user_id;
      await notify(
        e,
        id,
        f.user_id,
        "Publicação de autor seguido",
        p.title + " está disponível na Nimbus.",
        "/materiais/" + p.id,
      );
      await deliver(e, id);
    }
  if (!updated) return;
  const recipients = (
    await e.DB.prepare(
      `SELECT DISTINCT o.user_id FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.status='paid' AND i.product_id=? AND NOT EXISTS(SELECT 1 FROM order_licenses l WHERE l.order_id=o.id AND l.gift=1)
 UNION SELECT o.user_id FROM orders o JOIN order_assets a ON a.order_id=o.id WHERE o.status='paid' AND a.product_id=? AND NOT EXISTS(SELECT 1 FROM order_licenses l WHERE l.order_id=o.id AND l.gift=1)
 UNION SELECT li.user_id FROM license_invites li JOIN orders o ON o.id=li.order_id WHERE o.status='paid' AND li.user_id IS NOT NULL AND (EXISTS(SELECT 1 FROM order_items i WHERE i.order_id=o.id AND i.product_id=?) OR EXISTS(SELECT 1 FROM order_assets a WHERE a.order_id=o.id AND a.product_id=?))
 UNION SELECT s.user_id FROM subscriptions s WHERE s.status='active' AND s.expires>? AND EXISTS(SELECT 1 FROM json_each(s.product_ids) j WHERE j.value=?)`,
    )
      .bind(p.id, p.id, p.id, p.id, new Date().toISOString(), p.id)
      .all<{ user_id: string }>()
  ).results;
  for (const r of recipients) {
    const id = "update:" + p.id + ":" + revision + ":" + r.user_id;
    await notify(
      e,
      id,
      r.user_id,
      "Nova versão disponível",
      p.title + " recebeu uma atualização aprovada. Consulte a biblioteca.",
      "/#biblioteca",
    );
    await deliver(e, id);
  }
}
