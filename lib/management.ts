import {
  rows,
  fail,
  json,
  now,
  audit,
  type FeatureRuntime,
  type FeatureUser,
} from "./feature-db";
export function period(url: URL) {
  const from = url.searchParams.get("from") || "2000-01-01",
    to = url.searchParams.get("to") || now().slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
    from > to
  )
    fail("Período inválido.");
  return { from, to, end: to + "T23:59:59.999Z" };
}
export async function management(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5);
  if (!["management-report", "backup-export"].includes(path)) return null;
  const u = await auth(req);
  if (!u.admin) fail("Acesso restrito à administração.", 403);
  if (req.method !== "GET") fail("Somente leitura.", 405);
  if (path === "management-report") {
    const { from, to, end } = period(url);
    const financial = await rows(
      e,
      `SELECT s.*,i.title,i.product_id,i.owned FROM settlements s JOIN order_items i ON i.id=s.id WHERE s.created>=? AND s.created<=? ORDER BY s.created`,
      from,
      end,
    );
    const group = (key: (x: Record<string, unknown>) => string) => {
      const map = new Map<
        string,
        {
          label: string;
          sales: number;
          gross: number;
          fees: number;
          refunds: number;
          nimbus: number;
          authors: number;
        }
      >();
      for (const x of financial) {
        const label = key(x),
          v = map.get(label) || {
            label,
            sales: 0,
            gross: 0,
            fees: 0,
            refunds: 0,
            nimbus: 0,
            authors: 0,
          };
        v.sales++;
        v.gross += Number(x.gross);
        v.fees += Number(x.fee);
        v.refunds += Number(x.refunded_gross);
        v.nimbus +=
          Number(x.platform) -
          Number(x.refunded_gross) +
          Number(x.refunded_author);
        v.authors += Number(x.author_net) - Number(x.refunded_author);
        map.set(label, v);
      }
      return [...map.values()];
    };
    const campaigns = await rows(
      e,
      `SELECT c.code,COUNT(*) orders,COALESCE(SUM(c.discount),0) discount,COALESCE(SUM(o.total),0) revenue FROM coupon_uses c JOIN orders o ON o.id=c.order_id WHERE o.status='paid' AND o.created>=? AND o.created<=? GROUP BY c.code`,
      from,
      end,
    );
    const alerts = await rows(
      e,
      `SELECT 'finance' kind,COUNT(*) count FROM finance_events WHERE type='hold' UNION ALL SELECT 'email',COUNT(*) FROM email_outbox WHERE status IN ('failed','pending') UNION ALL SELECT 'refund',COUNT(*) FROM refund_requests WHERE status IN ('failed','action_required') UNION ALL SELECT 'operation',COUNT(*) FROM operation_events WHERE status='open'`,
    );
    return json({
      from,
      to,
      products: group(
        (x) => String(x.title) + " · " + String(x.product_id).slice(0, 8),
      ),
      inventory: group((x) => (x.owned ? "Acervo próprio" : "Parceiros")),
      months: group((x) => String(x.created).slice(0, 7)),
      campaigns,
      alerts,
    });
  }
  const tables = await rows<{ name: string }>(
    e,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' AND name!='rate_buckets' ORDER BY name",
  );
  const data: Record<string, Record<string, unknown>[]> = {};
  let count = 0;
  for (const { name } of tables) {
    if (!/^[a-z_]+$/.test(name)) continue;
    const n = await rows<{ n: number }>(e, `SELECT COUNT(*) n FROM "${name}"`);
    count += n[0].n;
    if (count > 50000)
      fail(
        "O volume excede a exportação pelo navegador. Use a exportação D1 da hospedagem.",
        413,
      );
    data[name] = await rows(e, `SELECT * FROM "${name}"`);
  }
  await audit(e, u.id, "backup.exported", String(count));
  return new Response(
    JSON.stringify(
      {
        format: "nimbus-data-v1",
        exported_at: now(),
        warning:
          "Contém dados pessoais. Arquivos R2 não estão incluídos; preserve também os objetos citados no manifesto.",
        tables: data,
        object_manifest: [
          ...new Set(
            (data.products || [])
              .flatMap((r: Record<string, unknown>) => [
                r.file_key,
                r.cover_key,
                ...JSON.parse(String(r.preview_keys || "[]")),
              ])
              .concat(
                (data.subscriptions || []).flatMap((r) => {
                  try {
                    return (
                      JSON.parse(String(r.assets || "[]")) as {
                        file_key?: string;
                      }[]
                    ).map((a) => a.file_key);
                  } catch {
                    return [];
                  }
                }),
                (data.product_versions || []).map(
                  (r: Record<string, unknown>) => r.file_key,
                ),
                (data.order_assets || []).map(
                  (r: Record<string, unknown>) => r.file_key,
                ),
                (data.order_items || []).map((r) => r.file_key),
                (data.service_quotes || []).map((r) => {
                  try {
                    return JSON.parse(String(r.delivery || "{}")).key;
                  } catch {
                    return null;
                  }
                }),
              )
              .filter(Boolean),
          ),
        ],
      },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "Content-Disposition": "attachment; filename=nimbus-dados-backup.json",
        "Cache-Control": "private,no-store",
      },
    },
  );
}
