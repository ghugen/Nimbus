import { notify, deliver } from "./notifications";
import {
  body,
  clean,
  fail,
  json,
  now,
  rows,
  run,
  owned,
  audit,
  rate,
  type FeatureRuntime,
  type FeatureUser,
} from "./feature-db";
import { editorialCriteria, reviewChecks } from "./editorial-criteria";
export async function editorialPlus(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  if (path === "editorial-criteria" && method === "GET")
    return json({ criteria: editorialCriteria, checks: reviewChecks });
  if (
    ![
      "review-moderation",
      "profile-verification",
      "publication-schedule",
      "correction-version",
      "editorial-versions",
    ].includes(path)
  )
    return null;
  const u = await auth(req);
  if (method !== "GET") await rate(e, u.id, path, 30);
  const b = method === "GET" ? null : await body(req);
  if (path === "editorial-versions" && method === "GET") {
    const id = clean(url.searchParams.get("id"), 100);
    await owned(e, u, id);
    return json({
      versions: await rows(
        e,
        "SELECT id,sequence,notes,released FROM product_versions WHERE product_id=? AND status='published' ORDER BY sequence DESC",
        id,
      ),
    });
  }
  if (path === "review-moderation") {
    if (method === "GET")
      return json({
        reviews: await rows(
          e,
          `SELECT r.id,r.product_id,r.name,r.comment,r.rating,r.created,p.title,COALESCE(m.status,'visible') status,m.response,m.clarity,m.presentation FROM reviews r JOIN products p ON p.id=r.product_id LEFT JOIN review_moderation m ON m.review_id=r.id ${u.admin ? "" : "WHERE p.author_id=?"} ORDER BY r.created DESC LIMIT 200`,
          ...(u.admin ? [] : [u.id]),
        ),
      });
    const r = (
      await rows(
        e,
        "SELECT r.id,p.author_id FROM reviews r JOIN products p ON p.id=r.product_id WHERE r.id=?",
        clean(b!.id, 100),
      )
    )[0];
    if (!r || (r.author_id !== u.id && !u.admin)) fail("Acesso negado.", 403);
    if (b!.action === "visibility") {
      if (!u.admin) fail("Somente a administração modera a visibilidade.", 403);
      if (
        !["visible", "hidden"].includes(String(b!.status)) ||
        clean(b!.reason).length < 10
      )
        fail("Informe decisão e justificativa.");
      await run(
        e,
        "INSERT INTO review_moderation(review_id,status,reason,updated) VALUES(?,?,?,?) ON CONFLICT(review_id) DO UPDATE SET status=excluded.status,reason=excluded.reason,updated=excluded.updated",
        r.id,
        b!.status,
        clean(b!.reason, 3000),
        now(),
      );
      await audit(e, u.id, "review.visibility_changed", String(r.id));
    } else {
      if (clean(b!.response).length < 5) fail("Informe uma resposta.");
      await run(
        e,
        "INSERT INTO review_moderation(review_id,response,updated) VALUES(?,?,?) ON CONFLICT(review_id) DO UPDATE SET response=excluded.response,updated=excluded.updated",
        r.id,
        clean(b!.response, 3000),
        now(),
      );
    }
    return json({ ok: true });
  }
  if (path === "profile-verification") {
    if (!u.admin) fail("Acesso restrito.", 403);
    if (method === "GET")
      return json({
        users: await rows(
          e,
          "SELECT u.id,u.name,u.public_name,u.credentials,v.status,v.label,v.evidence,v.updated FROM users u LEFT JOIN profile_verifications v ON v.user_id=u.id ORDER BY u.name",
        ),
      });
    const id = clean(b!.user_id, 150),
      status = String(b!.status);
    if (
      !["verified", "unverified"].includes(status) ||
      (status === "verified" &&
        (clean(b!.label).length < 3 || clean(b!.evidence).length < 10))
    )
      fail("Informe o que foi verificado e a evidência.");
    if (!(await rows(e, "SELECT id FROM users WHERE id=?", id)).length)
      fail("Conta não encontrada.", 404);
    await run(
      e,
      "INSERT INTO profile_verifications(user_id,status,label,evidence,reviewer,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET status=excluded.status,label=excluded.label,evidence=excluded.evidence,reviewer=excluded.reviewer,updated=excluded.updated",
      id,
      status,
      clean(b!.label, 500),
      clean(b!.evidence, 3000),
      u.id,
      now(),
    );
    await audit(e, u.id, "profile.verification_changed", id);
    return json({ ok: true });
  }
  if (path === "publication-schedule") {
    const id = clean(b?.id || url.searchParams.get("id"), 100);
    await owned(e, u, id);
    if (method === "GET")
      return json({
        schedule:
          (
            await rows(
              e,
              "SELECT release_at,approved FROM publication_schedule WHERE product_id=?",
              id,
            )
          )[0] || null,
      });
    if (b!.action === "remove") {
      await run(e, "DELETE FROM publication_schedule WHERE product_id=?", id);
      await run(
        e,
        "UPDATE products SET status='draft' WHERE id=? AND status='scheduled'",
        id,
      );
      return json({ ok: true });
    }
    const at = Date.parse(String(b!.release_at));
    if (
      !Number.isFinite(at) ||
      at <= Date.now() ||
      at > Date.now() + 366 * 86400000
    )
      fail("Escolha uma data futura em até um ano.");
    await run(
      e,
      "INSERT INTO publication_schedule(product_id,release_at,approved,created) VALUES(?,?,0,?) ON CONFLICT(product_id) DO UPDATE SET release_at=excluded.release_at,approved=0,created=excluded.created",
      id,
      new Date(at).toISOString(),
      now(),
    );
    await run(
      e,
      "UPDATE products SET status='draft',reviewed_by=NULL,reviewed_at=NULL WHERE id=?",
      id,
    );
    return json({ ok: true });
  }
  if (path === "correction-version" && method === "POST") {
    const issue = (
      await rows(
        e,
        "SELECT c.*,p.author_id FROM content_issues c JOIN products p ON p.id=c.product_id WHERE c.id=?",
        clean(b!.id, 100),
      )
    )[0];
    if (!issue || (issue.author_id !== u.id && !u.admin))
      fail("Acesso negado.", 403);
    const version = (
      await rows(
        e,
        "SELECT sequence FROM product_versions WHERE id=? AND product_id=? AND status='published'",
        clean(b!.version_id, 100),
        issue.product_id,
      )
    )[0];
    if (!version) fail("Selecione uma versão publicada deste material.");
    await run(
      e,
      "UPDATE content_issues SET status='resolved',response=?,updated=? WHERE id=?",
      "Correção incorporada à versão " +
        version.sequence +
        ". " +
        clean(b!.response, 3000),
      now(),
      issue.id,
    );
    await audit(e, u.id, "correction.version_linked", String(issue.id));
    const noticeId =
      "correction-version:" +
      String(issue.id) +
      ":" +
      clean(b!.version_id, 100);
    await notify(
      e,
      noticeId,
      String(issue.user_id),
      "Correção incorporada",
      "O relato foi vinculado à versão " +
        version.sequence +
        " do material. Consulte a biblioteca.",
      "/#correcoes",
    );
    await deliver(e, noticeId);
    return json({ ok: true });
  }
  return null;
}
