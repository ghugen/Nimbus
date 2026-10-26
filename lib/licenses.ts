import {
  body,
  clean,
  fail,
  json,
  now,
  rows,
  run,
  rate,
  type FeatureRuntime,
  type FeatureUser,
} from "./feature-db";
export const orderAccess =
  "((o.user_id=? AND NOT EXISTS(SELECT 1 FROM order_licenses l WHERE l.order_id=o.id AND l.gift=1)) OR EXISTS(SELECT 1 FROM license_invites li WHERE li.order_id=o.id AND li.user_id=?))";
export async function claimLicenses(e: FeatureRuntime, u: FeatureUser) {
  await run(
    e,
    "UPDATE license_invites SET user_id=? WHERE user_id IS NULL AND lower(email)=lower(?) AND EXISTS(SELECT 1 FROM orders o WHERE o.id=license_invites.order_id AND o.status='paid')",
    u.id,
    u.email,
  );
}
export async function licenses(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5);
  if (path !== "licenses") return null;
  const u = await auth(req);
  if (req.method === "GET")
    return json({
      pools: await rows(
        e,
        "SELECT l.*,o.created FROM order_licenses l JOIN orders o ON o.id=l.order_id WHERE o.user_id=? AND o.status='paid'",
        u.id,
      ),
      invites: await rows(
        e,
        "SELECT li.id,li.order_id,li.email,CASE WHEN li.user_id IS NULL THEN 0 ELSE 1 END claimed FROM license_invites li JOIN orders o ON o.id=li.order_id WHERE o.user_id=?",
        u.id,
      ),
    });
  await rate(e, u.id, "license-invite", 20);
  const b = await body(req),
    order = clean(b.order_id, 100),
    email = clean(b.email, 200).toLowerCase();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email === u.email.toLowerCase()
  )
    fail("Informe o e-mail de outra pessoa que receberá a licença.");
  const p = (
    await rows(
      e,
      "SELECT l.* FROM order_licenses l JOIN orders o ON o.id=l.order_id WHERE l.order_id=? AND o.user_id=? AND o.status='paid'",
      order,
      u.id,
    )
  )[0];
  if (!p || Number(p.seats) <= 1 || p.gift)
    fail("Pedido sem licenças para distribuir.", 403);
  if (
    (
      await rows(
        e,
        "SELECT id FROM license_invites WHERE order_id=? AND email=?",
        order,
        email,
      )
    ).length
  )
    fail("Esta pessoa já recebeu uma licença deste pedido.", 409);
  const id = crypto.randomUUID();
  await run(
    e,
    "INSERT INTO license_invites(id,order_id,email,created) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM license_invites WHERE order_id=?)<?",
    id,
    order,
    email,
    now(),
    order,
    Number(p.seats) - 1,
  );
  if (!(await rows(e, "SELECT id FROM license_invites WHERE id=?", id)).length)
    fail("Todas as licenças deste pedido já foram distribuídas.", 409);
  return json({
    ok: true,
    message:
      "Licença reservada. A pessoa deve entrar na Nimbus com esse e-mail verificado para acessar.",
  });
}
