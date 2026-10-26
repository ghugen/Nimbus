export const normalizeSearch = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function distance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 100;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = old;
    }
  }
  return row[b.length];
}
export function searchMatches(text: string, query: string) {
  const terms = normalizeSearch(text),
    q = normalizeSearch(query.slice(0, 100));
  if (!q || terms.includes(q)) return true;
  const words = terms.split(/[^a-z0-9]+/);
  return q
    .split(/\s+/)
    .every((x) =>
      words.some((w) => w === x || (x.length >= 4 && distance(x, w) <= 1)),
    );
}
