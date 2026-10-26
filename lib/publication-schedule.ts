import { publicationNotices } from "./publication-notices";
import type { StoreRuntime } from "./catalog-services";
import { notify, deliver, type NotificationRuntime } from "./notifications";
export async function releaseDuePublications(
  e: StoreRuntime & NotificationRuntime,
) {
  const now = new Date().toISOString();
  const due = (
    await e.DB.prepare(
      "SELECT p.id,p.title,p.author_id,p.file_key,s.release_at FROM products p JOIN publication_schedule s ON s.product_id=p.id WHERE p.status='scheduled' AND s.approved=1 AND s.release_at<=? LIMIT 20",
    )
      .bind(now)
      .all<{
        id: string;
        title: string;
        author_id: string;
        file_key: string;
        release_at: string;
      }>()
  ).results;
  for (const p of due) {
    await e.DB.batch([
      e.DB.prepare(
        "UPDATE editorial_tools SET published=draft WHERE product_id=?",
      ).bind(p.id),
      e.DB.prepare(
        "UPDATE learning_packages SET published_cards=cards,published_questions=questions,published_lessons=lessons WHERE product_id=?",
      ).bind(p.id),
      e.DB.prepare(
        "UPDATE products SET status='published' WHERE id=? AND status='scheduled'",
      ).bind(p.id),
      e.DB.prepare(
        "UPDATE product_versions SET status='published',released=? WHERE product_id=? AND file_key=? AND status='pending'",
      ).bind(now, p.id, p.file_key),
    ]);
    await publicationNotices(e, p, p.release_at, true);
    const id = "scheduled:" + p.id + ":" + p.release_at;
    await notify(
      e,
      id,
      p.author_id,
      "Publicação liberada",
      p.title + " foi liberado após a data programada.",
      "/#autores",
    );
    await deliver(e, id);
  }
}
