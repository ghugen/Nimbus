import { verifyToken } from "@clerk/backend";
export type IdentityRuntime = {
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  ADMIN_EMAILS?: string;
};
export async function emailIdentity(req: Request, env: IdentityRuntime) {
  if (!env.CLERK_SECRET_KEY || !env.CLERK_PUBLISHABLE_KEY) return null;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("__session="))
    ?.slice(10);
  const token = bearer || cookie;
  if (!token) return null;
  try {
    const claims = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      authorizedParties: [new URL(req.url).origin],
    });
    if (!claims.sub || typeof claims.sub !== "string" || !claims.sid)
      return null;
    const r = await fetch(
      "https://api.clerk.com/v1/users/" + encodeURIComponent(claims.sub),
      { headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` } },
    );
    if (!r.ok) return null;
    const user = (await r.json()) as {
      primary_email_address_id: string;
      email_addresses: {
        id: string;
        email_address: string;
        verification?: { status: string };
      }[];
      first_name?: string;
      last_name?: string;
    };
    const email = user.email_addresses?.find(
      (e) =>
        e.id === user.primary_email_address_id &&
        e.verification?.status === "verified",
    )?.email_address;
    if (!email) return null;
    return {
      id: "clerk:" + claims.sub,
      email,
      name:
        [user.first_name, user.last_name].filter(Boolean).join(" ") ||
        email.split("@")[0],
      admin: (env.ADMIN_EMAILS || "")
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .includes(email.toLowerCase()),
    };
  } catch {
    return null;
  }
}
