import {
  body,
  clean,
  fail,
  json,
  now,
  rows,
  run,
  audit,
  type FeatureRuntime,
  type FeatureUser,
} from "./feature-db";
export async function staff(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  if (new URL(req.url).pathname !== "/api/staff-roles") return null;
  const u = await auth(req);
  if (!u.admin) fail("Somente administradores podem gerenciar a equipe.", 403);
  if (req.method === "GET")
    return json({
      users: await rows(
        e,
        "SELECT u.id,u.name,u.email,COALESCE(r.reviewer,0) reviewer,COALESCE(r.support,0) support,r.updated FROM users u LEFT JOIN staff_roles r ON r.user_id=u.id ORDER BY u.name",
      ),
    });
  const b = await body(req),
    id = clean(b.user_id, 150);
  if (!(await rows(e, "SELECT id FROM users WHERE id=?", id)).length)
    fail("Conta não encontrada.", 404);
  await run(
    e,
    "INSERT INTO staff_roles(user_id,reviewer,support,updated) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET reviewer=excluded.reviewer,support=excluded.support,updated=excluded.updated",
    id,
    b.reviewer === true ? 1 : 0,
    b.support === true ? 1 : 0,
    now(),
  );
  await audit(e, u.id, "staff.permissions_changed", id);
  return json({ ok: true });
}
