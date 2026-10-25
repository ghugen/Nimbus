export function parseCart(ids: unknown): string[] {
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 30 ||
    ids.some((x) => typeof x !== "string" || x.length > 100)
  )
    throw new Error("Carrinho inválido.");
  return [...new Set(ids)];
}
export function validProduct(p: Record<string, unknown>) {
  if (
    typeof p.title !== "string" ||
    p.title.trim().length < 5 ||
    p.title.length > 150
  )
    throw new Error("Título deve ter de 5 a 150 caracteres.");
  if (
    typeof p.price !== "number" ||
    !Number.isSafeInteger(p.price) ||
    p.price < 0 ||
    p.price > 1000000
  )
    throw new Error("Preço inválido.");
  if (
    typeof p.pages !== "number" ||
    !Number.isInteger(p.pages) ||
    p.pages < 1 ||
    p.pages > 5000
  )
    throw new Error("Número de páginas inválido.");
}
export async function verifyStripe(
  raw: string,
  header: string,
  secret: string,
  now = Date.now(),
) {
  const parts = header.split(",");
  const t = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!t || !/^\d+$/.test(t) || Math.abs(now / 1000 - Number(t)) > 300)
    return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${t}.${raw}`),
    ),
  );
  const hex = [...sig].map((x) => x.toString(16).padStart(2, "0")).join("");
  return signatures.some((s) => {
    if (s.length !== hex.length) return false;
    let diff = 0;
    for (let i = 0; i < s.length; i++)
      diff |= s.charCodeAt(i) ^ hex.charCodeAt(i);
    return diff === 0;
  });
}
