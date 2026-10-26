let provider: (() => Promise<string | null>) | null = null;
export function setTokenProvider(value: (() => Promise<string | null>) | null) {
  provider = value;
}
export async function signedFetch(input: string, init?: RequestInit) {
  if (!input.startsWith("/api/")) return fetch(input, init);
  const token = provider ? await provider() : null;
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", "Bearer " + token);
  return fetch(input, { ...init, headers });
}
export async function downloadPrivate(path: string) {
  const r = await signedFetch(path);
  if (!r.ok) {
    const d = (await r.json()) as { error?: string };
    throw new Error(d.error || "Arquivo indisponível.");
  }
  const blob = await r.blob(),
    url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const h = r.headers.get("content-disposition") || "";
  const raw = h.match(/filename\*=UTF-8''([^;]+)/)?.[1];
  a.download = raw
    ? decodeURIComponent(raw)
    : h.match(/filename="?([^";]+)/)?.[1] || "material";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function metric(
  productId: string,
  kind: "view" | "preview" | "cart",
) {
  if (localStorage.getItem("nimbus-analytics") !== "yes") return;
  let visitor = sessionStorage.getItem("nimbus-visitor");
  if (!visitor) {
    visitor = crypto.randomUUID();
    sessionStorage.setItem("nimbus-visitor", visitor);
  }
  await signedFetch("/api/metric", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, kind, visitor, consent: true }),
  }).catch(() => {});
}

export async function searchSignal(filters: {
  query: string;
  course: string;
  subject: string;
  format: string;
}) {
  if (
    localStorage.getItem("nimbus-analytics") !== "yes" ||
    localStorage.getItem("nimbus-search-analytics-v1") !== "yes"
  )
    return;
  let visitor = sessionStorage.getItem("nimbus-visitor");
  if (!visitor) {
    visitor = crypto.randomUUID();
    sessionStorage.setItem("nimbus-visitor", visitor);
  }
  await signedFetch("/api/search-signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...filters, visitor, consent: true }),
  });
}
