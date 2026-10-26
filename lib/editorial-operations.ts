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
import { publicProducts } from "./catalog-services";
import { notify, deliver } from "./notifications";
export const launchTemplates = [
  {
    id: "patologia",
    title: "Patologia Veterinária — fundamentos para revisão",
    subject: "Patologia",
    format: "Resumos e apostilas",
    outline:
      "Objetivos e conhecimentos prévios\nConceitos e terminologia\nEsquemas de mecanismos\nExercícios originais\nReferências e data de revisão",
  },
  {
    id: "intoxicacoes",
    title: "Clínica das Intoxicações — roteiro de estudo",
    subject: "Toxicologia",
    format: "Guias práticos",
    outline:
      "Objetivos e recorte\nOrganização dos temas\nRoteiro de leitura das fontes\nQuadros de revisão\nQuestões de estudo\nReferências",
  },
  {
    id: "suinos",
    title: "Doenças dos Suínos — organização por sistemas",
    subject: "Doenças dos Suínos",
    format: "Mapas mentais e esquemas",
    outline:
      "Objetivos e recorte\nOrganização dos sistemas\nConexões entre conceitos\nQuadros de comparação\nPerguntas de revisão\nReferências",
  },
];
export async function assertSaleAvailable(
  e: FeatureRuntime,
  productId: string,
) {
  const s = (
    await rows(
      e,
      "SELECT next_review,pause_sales FROM review_schedules WHERE product_id=?",
      productId,
    )
  )[0];
  if (s?.pause_sales === 1 && String(s.next_review) < now().slice(0, 10))
    fail("Este material aguarda revisão editorial antes de novas vendas.", 409);
}
async function remindReviews(e: FeatureRuntime, userId?: string) {
  const due = await rows(
    e,
    `SELECT s.*,p.title,p.author_id FROM review_schedules s JOIN products p ON p.id=s.product_id WHERE s.next_review<=? ${userId ? "AND p.author_id=?" : ""}`,
    now().slice(0, 10),
    ...(userId ? [userId] : []),
  );
  for (const p of due) {
    const id = "review-due:" + p.product_id + ":" + p.next_review;
    await notify(
      e,
      id,
      String(p.author_id),
      "Revisão editorial programada",
      String(p.title) +
        " chegou à data de revisão. Confira o material e solicite nova análise.",
      "/#autores/materiais",
    );
    await deliver(e, id);
  }
  return due;
}
export async function editorialOperations(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  if (
    ![
      "review-schedule",
      "review-queue",
      "product-policy",
      "copy-lookup",
      "launch-plan",
      "permission-review",
      "file-check",
    ].includes(path)
  )
    return null;
  const u = await auth(req);
  if (method !== "GET") await rate(e, u.id, path, 20);
  const b = method === "GET" ? null : await body(req);
  if (path === "file-check") {
    const id = clean(url.searchParams.get("id"), 100),
      p = (await rows(e, "SELECT author_id FROM products WHERE id=?", id))[0],
      role = (
        await rows(e, "SELECT reviewer FROM staff_roles WHERE user_id=?", u.id)
      )[0];
    if (!p || (!u.admin && p.author_id !== u.id && !role?.reviewer))
      fail("Acesso restrito.", 403);
    return json({
      check:
        (
          await rows(
            e,
            "SELECT size,extension,result,created FROM upload_checks WHERE product_id=?",
            id,
          )
        )[0] || null,
    });
  }
  if (path === "review-schedule" || path === "product-policy") {
    const id = clean(b?.product_id || url.searchParams.get("id"), 100);
    await owned(e, u, id);
    if (path === "product-policy") {
      if (method === "GET")
        return json({
          policy: (
            await rows(
              e,
              "SELECT watermark,ai_enabled,updated FROM product_policies WHERE product_id=?",
              id,
            )
          )[0] || { watermark: 1, ai_enabled: 0 },
        });
      if (b!.ai_enabled === true && b!.accepted !== true)
        fail(
          "Confirme que autoriza o envio de trechos ao provedor escolhido pelo estudante.",
        );
      await run(
        e,
        "INSERT INTO product_policies(product_id,watermark,ai_enabled,updated) VALUES(?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET watermark=excluded.watermark,ai_enabled=excluded.ai_enabled,updated=excluded.updated",
        id,
        b!.watermark === false ? 0 : 1,
        b!.ai_enabled === true ? 1 : 0,
        now(),
      );
      await audit(e, u.id, "product.policy_changed", id);
      return json({ ok: true });
    }
    if (method === "GET")
      return json({
        schedule:
          (
            await rows(
              e,
              "SELECT * FROM review_schedules WHERE product_id=?",
              id,
            )
          )[0] || null,
      });
    const due = clean(b!.next_review, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(due) ||
      isNaN(Date.parse(due)) ||
      due > new Date(Date.now() + 730 * 86400000).toISOString().slice(0, 10)
    )
      fail("Informe uma data válida de revisão em até dois anos.");
    await run(
      e,
      "INSERT INTO review_schedules(product_id,next_review,pause_sales,updated) VALUES(?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET next_review=excluded.next_review,pause_sales=excluded.pause_sales,updated=excluded.updated",
      id,
      due,
      b!.pause_sales === true ? 1 : 0,
      now(),
    );
    await audit(e, u.id, "review.scheduled", id);
    return json({ ok: true });
  }
  if (path === "review-queue") {
    const role = (
      await rows(e, "SELECT reviewer FROM staff_roles WHERE user_id=?", u.id)
    )[0];
    if (!u.admin && !role?.reviewer) fail("Acesso restrito à revisão.", 403);
    if (method === "GET") {
      await remindReviews(e);
      return json({
        items: await rows(
          e,
          "SELECT s.*,p.title,p.author_id,p.status FROM review_schedules s JOIN products p ON p.id=s.product_id ORDER BY s.next_review LIMIT 200",
        ),
      });
    }
    const id = clean(b!.product_id, 100),
      p = (await rows(e, "SELECT author_id FROM products WHERE id=?", id))[0],
      due = clean(b!.next_review, 10);
    if (!p || (!u.admin && p.author_id === u.id))
      fail("A revisão do próprio material exige outro revisor.", 403);
    if (
      clean(b!.notes).length < 20 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(due) ||
      due <= now().slice(0, 10) ||
      b!.checked !== true
    )
      fail(
        "Registre o que foi conferido, confirme a revisão e indique a próxima data.",
      );
    await run(
      e,
      "UPDATE review_schedules SET last_review=?,reviewer=?,notes=?,next_review=?,updated=? WHERE product_id=?",
      now(),
      u.name,
      clean(b!.notes, 4000),
      due,
      now(),
      id,
    );
    await audit(e, u.id, "review.periodic_completed", id);
    return json({ ok: true });
  }
  if (path === "copy-lookup") {
    if (!u.admin) fail("Acesso restrito.", 403);
    return json({
      copies: await rows(
        e,
        "SELECT c.copy_code,c.order_id,c.product_id,c.created,u.name,u.email FROM download_copies c JOIN users u ON u.id=c.user_id WHERE c.copy_code=?",
        clean(url.searchParams.get("code"), 40).toUpperCase(),
      ),
    });
  }
  if (path === "permission-review") {
    if (!u.admin) fail("Acesso restrito.", 403);
    if (method === "GET")
      return json({
        last:
          (
            await rows(
              e,
              "SELECT value,updated FROM growth_settings WHERE id='permissions_review'",
            )
          )[0] || null,
        roles: await rows(
          e,
          "SELECT u.name,u.email,r.reviewer,r.support,r.updated FROM staff_roles r JOIN users u ON u.id=r.user_id",
        ),
      });
    if (b!.checked !== true || clean(b!.notes).length < 20)
      fail("Confirme a conferência e registre suas observações.");
    const next = new Date(Date.now() + 90 * 86400000)
      .toISOString()
      .slice(0, 10);
    await run(
      e,
      "INSERT INTO growth_settings(id,value,updated) VALUES('permissions_review',?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated=excluded.updated",
      JSON.stringify({ reviewer: u.name, next, notes: clean(b!.notes, 3000) }),
      now(),
    );
    await audit(e, u.id, "permissions.reviewed", "staff");
    return json({ ok: true, next });
  }
  if (!u.admin) fail("Acesso restrito.", 403);
  if (method === "GET")
    return json({
      templates: launchTemplates,
      tasks: await rows(
        e,
        "SELECT t.*,p.title,p.status product_status,p.price,p.file_name FROM launch_tasks t LEFT JOIN products p ON p.id=t.product_id ORDER BY t.id",
      ),
      collection:
        (
          await rows(
            e,
            "SELECT slug,published FROM collections WHERE slug='professor-gustavo'",
          )
        )[0] || null,
    });
  if (b!.action === "prepare") {
    for (const t of launchTemplates) {
      if (
        (await rows(e, "SELECT id FROM launch_tasks WHERE id=?", t.id)).length
      )
        continue;
      const id = crypto.randomUUID();
      await e.DB.batch([
        e.DB.prepare(
          "INSERT INTO products(id,author_id,title,description,category,subject,course,format,price,pages,author,preview,status,created,updated,toc) VALUES(?,?,?,?,?,?,?,?,0,1,?,?,'draft',?,?,?)",
        ).bind(
          id,
          u.id,
          t.title,
          "Rascunho de preparação. Enviar o material autoral, definir preço, referências e escopo antes de publicar.",
          "Saúde",
          t.subject,
          "Medicina Veterinária",
          t.format,
          u.name,
          "Amostra ainda não enviada. Este rascunho não está à venda.",
          now(),
          now(),
          t.outline,
        ),
        e.DB.prepare(
          "INSERT INTO launch_tasks(id,product_id,status,notes,updated) VALUES(?,?,'planned','Conteúdo, preço, direitos e revisão aguardam o proprietário.',?)",
        ).bind(t.id, id, now()),
      ]);
    }
    await run(
      e,
      "INSERT OR IGNORE INTO collections(slug,title,description,course,subject,product_ids,published,created) VALUES('professor-gustavo','Acervo do Professor Gustavo','Materiais autorais de Veterinária organizados por disciplina. Consulte o recorte, as amostras e a revisão de cada publicação.','Medicina Veterinária','','[]',0,?)",
      now(),
    );
    await audit(e, u.id, "launch.prepared", "veterinary");
    return json({ ok: true });
  }
  if (b!.action === "publish") {
    const ids = (
        await rows(
          e,
          "SELECT product_id FROM launch_tasks WHERE product_id IS NOT NULL",
        )
      ).map((x) => String(x.product_id)),
      products = await publicProducts(e),
      valid = products.filter(
        (p) => ids.includes(p.id) && p.owned === 1 && !p.demo,
      );
    if (!valid.length || !valid.some((p) => p.price > 0))
      fail(
        "Publique pelo menos um material comercial real antes de abrir a coleção.",
      );
    await run(
      e,
      "UPDATE collections SET product_ids=?,published=1 WHERE slug='professor-gustavo'",
      JSON.stringify(valid.map((p) => p.id)),
    );
    await audit(e, u.id, "launch.collection_published", "professor-gustavo");
    return json({ ok: true });
  }
  if (!["planned", "producing", "review", "ready"].includes(String(b!.status)))
    fail("Estado inválido.");
  await run(
    e,
    "UPDATE launch_tasks SET status=?,notes=?,updated=? WHERE id=?",
    b!.status,
    clean(b!.notes, 5000),
    now(),
    clean(b!.id, 50),
  );
  return json({ ok: true });
}
