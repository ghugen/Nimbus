import {
  body,
  clean,
  fail,
  json,
  now,
  rows,
  run,
  rate,
  audit,
  owned,
  type FeatureRuntime,
  type FeatureUser,
} from "./feature-db";
import { publicProducts, entitlement } from "./catalog-services";
import { indexPdf } from "./pdf-tools";
import { publicationNotices } from "./publication-notices";
export async function assertSalesOpen(e: FeatureRuntime) {
  const s = (
    await rows(e, "SELECT value FROM growth_settings WHERE id='sales_pause'")
  )[0];
  if (s && JSON.parse(String(s.value)).paused === true)
    fail(
      "Novas compras estão temporariamente suspensas. Consulte a situação do serviço. Sua biblioteca continua disponível.",
      503,
    );
}
export async function editorialEvolution(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  if (path === "service-status" && method === "GET") {
    const s = (
      await rows(
        e,
        "SELECT value,updated FROM growth_settings WHERE id='sales_pause'",
      )
    )[0];
    return json({
      sales: s ? JSON.parse(String(s.value)) : { paused: false, message: "" },
      updated: s?.updated || null,
      incidents: await rows(
        e,
        "SELECT id,title,body,status,updated FROM evolution_records WHERE kind='incident' AND status IN ('published','resolved') ORDER BY updated DESC LIMIT 30",
      ),
      notice:
        "Atualização manual da operação. Esta página compartilha a hospedagem e pode ficar indisponível em uma falha total.",
    });
  }
  if (path === "study-paths" && method === "GET") {
    const products = await publicProducts(e);
    const records = await rows(
      e,
      "SELECT id,title,body,course,semester,product_ids FROM evolution_records WHERE kind='path' AND status='published' ORDER BY course,semester,title",
    );
    return json({
      paths: records.map((r) => ({
        ...r,
        product_ids: undefined,
        items: (JSON.parse(String(r.product_ids)) as string[])
          .map((id) => products.find((p) => p.id === id && !p.demo))
          .filter(Boolean)
          .map((p) => ({ id: p!.id, title: p!.title, format: p!.format })),
      })),
    });
  }
  if (
    ![
      "editorial-tools",
      "editorial-tools-edit",
      "evolution-admin",
      "sales-maintenance",
      "recurring-questions",
      "version-compare",
      "material-errata",
    ].includes(path)
  )
    return null;
  if (path === "material-errata" && method === "GET") {
    const id = clean(url.searchParams.get("id"), 100);
    if (!(await publicProducts(e)).some((p) => p.id === id))
      fail("Material não encontrado.", 404);
    return json({
      errata: await rows(
        e,
        "SELECT id,title,body,updated FROM evolution_records WHERE kind='errata' AND status='published' AND EXISTS(SELECT 1 FROM json_each(product_ids) j WHERE j.value=?) ORDER BY updated DESC",
        id,
      ),
    });
  }
  const u = await auth(req),
    b = method === "GET" ? null : await body(req);
  if (method !== "GET") await rate(e, u.id, path, 15);
  if (path === "editorial-tools" || path === "editorial-tools-edit") {
    const id = clean(b?.product_id || url.searchParams.get("id"), 100);
    if (path === "editorial-tools") {
      if (!(await entitlement(e, u.id, id)))
        fail("Adquira o material para acessar o glossário e o atlas.", 403);
      const row = (
        await rows(
          e,
          "SELECT published FROM editorial_tools WHERE product_id=?",
          id,
        )
      )[0];
      return json({ tools: JSON.parse(String(row?.published || "{}")) });
    }
    const product = await owned(e, u, id);
    if (method === "GET")
      return json({
        tools: JSON.parse(
          String(
            (
              await rows(
                e,
                "SELECT draft FROM editorial_tools WHERE product_id=?",
                id,
              )
            )[0]?.draft || "{}",
          ),
        ),
      });
    const glossary = b!.glossary,
      atlas = b!.atlas;
    if (
      !Array.isArray(glossary) ||
      glossary.length > 100 ||
      glossary.some(
        (x) =>
          !x ||
          clean(x.term, 100).length < 2 ||
          clean(x.definition, 2000).length < 5,
      ) ||
      !Array.isArray(atlas) ||
      atlas.length > 6 ||
      atlas.some(
        (x) =>
          !x ||
          !Number.isInteger(x.image) ||
          x.image < 0 ||
          x.image > 5 ||
          clean(x.caption, 2000).length < 10 ||
          clean(x.source, 1000).length < 5 ||
          x.image >= JSON.parse(String(product.preview_keys || "[]")).length ||
          !Array.isArray(x.points) ||
          x.points.length > 20 ||
          x.points.some(
            (p: { x: number; y: number; label: string }) =>
              !Number.isFinite(p.x) ||
              p.x < 0 ||
              p.x > 100 ||
              !Number.isFinite(p.y) ||
              p.y < 0 ||
              p.y > 100 ||
              clean(p.label, 200).length < 2,
          ),
      ) ||
      b!.rights !== true ||
      b!.deidentified !== true
    )
      fail("Confira termos, descrições, pontos, direitos e anonimização.");
    const data = JSON.stringify({
      glossary: glossary.map((x) => ({
        term: clean(x.term, 100),
        definition: clean(x.definition, 2000),
      })),
      atlas: atlas.map((x) => ({
        image: x.image,
        caption: clean(x.caption, 2000),
        question: clean(x.question, 1000),
        answer: clean(x.answer, 2000),
        source: clean(x.source, 1000),
        points: x.points.map((p: { x: number; y: number; label: string }) => ({
          x: p.x,
          y: p.y,
          label: clean(p.label, 200),
        })),
      })),
    });
    await e.DB.batch([
      e.DB.prepare(
        "INSERT INTO editorial_tools(product_id,draft,updated) VALUES(?,?,?) ON CONFLICT(product_id) DO UPDATE SET draft=excluded.draft,updated=excluded.updated",
      ).bind(id, data, now()),
      e.DB.prepare(
        "UPDATE products SET status='draft',reviewed_by=NULL,reviewed_at=NULL,updated=? WHERE id=?",
      ).bind(now(), id),
    ]);
    await audit(e, u.id, "editorial.tools_saved", id);
    return json({ ok: true });
  }
  if (path === "version-compare") {
    const id = clean(url.searchParams.get("id"), 100);
    if (!(await entitlement(e, u.id, id)))
      fail("Acesso restrito aos titulares do material.", 403);
    await rate(e, u.id, "version-compare", 4);
    const a = clean(url.searchParams.get("a"), 100),
      b = clean(url.searchParams.get("b"), 100);
    const versions = await rows(
      e,
      "SELECT id,sequence,file_key,file_name FROM product_versions WHERE product_id=? AND status='published' AND id IN (?,?)",
      id,
      a,
      b,
    );
    const old = versions.find((v) => v.id === a),
      next = versions.find((v) => v.id === b);
    if (
      !old ||
      !next ||
      a === b ||
      versions.some((v) => !String(v.file_name).toLowerCase().endsWith(".pdf"))
    )
      fail("Escolha duas versões publicadas em PDF.");
    const p = await indexPdf(e, String(old.file_key)),
      q = await indexPdf(e, String(next.file_key));
    const changes = Array.from(
      { length: Math.max(p.length, q.length) },
      (_, i) => ({
        page: i + 1,
        before: p[i]?.text || "",
        after: q[i]?.text || "",
      }),
    ).filter(
      (x) => x.before.replace(/\s+/g, " ") !== x.after.replace(/\s+/g, " "),
    );
    return json({
      from: old.sequence,
      to: next.sequence,
      total: changes.length,
      changes: changes.slice(0, 30).map((x) => ({
        ...x,
        before: x.before.slice(0, 1800),
        after: x.after.slice(0, 1800),
      })),
      notice:
        "Comparação automática de texto extraível, por posição de página. Imagens, paginação e alterações de layout exigem conferência manual. Até trinta páginas alteradas são exibidas.",
    });
  }
  if (!u.admin) fail("Acesso restrito à administração.", 403);
  if (path === "recurring-questions")
    return json({
      questions: await rows(
        e,
        "SELECT product_id,MIN(question) question,COUNT(*) count FROM product_questions WHERE status!='hidden' GROUP BY product_id,lower(trim(question)) ORDER BY count DESC,MAX(created) DESC LIMIT 100",
      ),
    });
  if (path === "sales-maintenance") {
    if (method === "GET")
      return json({
        settings: JSON.parse(
          String(
            (
              await rows(
                e,
                "SELECT value FROM growth_settings WHERE id='sales_pause'",
              )
            )[0]?.value || '{"paused":false,"message":""}',
          ),
        ),
      });
    if (clean(b!.message).length < 10)
      fail("Informe uma mensagem pública para os estudantes.");
    await run(
      e,
      "INSERT INTO growth_settings(id,value,updated) VALUES('sales_pause',?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated=excluded.updated",
      JSON.stringify({
        paused: b!.paused === true,
        message: clean(b!.message, 1000),
      }),
      now(),
    );
    await audit(e, u.id, "sales.maintenance_changed", "store");
    return json({ ok: true });
  }
  if (method === "GET")
    return json({
      records: await rows(
        e,
        "SELECT * FROM evolution_records ORDER BY updated DESC LIMIT 200",
      ),
    });
  const kind = clean(b!.kind, 30),
    status = clean(b!.status, 30),
    ids = b!.product_ids;
  if (
    !["path", "calendar", "errata", "incident"].includes(kind) ||
    !["draft", "published", "resolved", "archived"].includes(status) ||
    clean(b!.title).length < 5 ||
    clean(b!.body).length < 20 ||
    !Array.isArray(ids) ||
    ids.length > 30 ||
    ids.some((id) => typeof id !== "string") ||
    new Set(ids).size !== ids.length
  )
    fail("Confira tipo, título, descrição e materiais.");
  const products = await publicProducts(e);
  if (ids.some((id) => !products.some((p) => p.id === id && !p.demo)))
    fail("Selecione materiais reais publicados.");
  if (
    (kind === "path" && !ids.length) ||
    (kind === "errata" && ids.length !== 1)
  )
    fail("Defina os materiais da trilha ou um material para a correção.");
  const due = clean(b!.due, 10);
  if (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || isNaN(Date.parse(due))))
    fail("Data inválida.");
  const id = clean(b!.id, 100) || crypto.randomUUID(),
    previous = (
      await rows(e, "SELECT * FROM evolution_records WHERE id=?", id)
    )[0];
  if (previous && previous.kind !== kind)
    fail("O tipo do registro não pode ser alterado.", 409);
  if (previous?.kind === "errata" && previous.status === "published")
    fail(
      "Correções já publicadas são preservadas. Registre uma nova correção complementar.",
      409,
    );
  await run(
    e,
    "INSERT INTO evolution_records(id,kind,title,body,course,semester,product_ids,due,status,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,course=excluded.course,semester=excluded.semester,product_ids=excluded.product_ids,due=excluded.due,status=excluded.status,updated=excluded.updated",
    id,
    kind,
    clean(b!.title, 150),
    clean(b!.body, 6000),
    clean(b!.course, 100),
    clean(b!.semester, 100),
    JSON.stringify(ids),
    due,
    status,
    now(),
    now(),
  );
  if (kind === "errata" && status === "published") {
    const p = products.find((p) => p.id === ids[0])!;
    await publicationNotices(e, p, "errata:" + id, true, false, {
      title: "Correção importante: " + clean(b!.title, 150),
      message: clean(b!.body, 1500),
    });
  }
  await audit(e, u.id, "evolution.saved", id);
  return json({ ok: true, id });
}
