import { publicProducts, publicDTO } from "./catalog-services";
import {
  body,
  clean,
  fail,
  json,
  now,
  rows,
  run,
  owned,
  rate,
  audit,
  type FeatureRuntime,
  type FeatureUser,
} from "./feature-db";
import { normalizeSearch, distance } from "./search";
export async function discovery(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  if (path === "discover" && method === "GET") {
    const q = normalizeSearch(clean(url.searchParams.get("q"), 100)),
      products = await publicProducts(e),
      id = url.searchParams.get("related"),
      base = products.find((p) => p.id === id);
    const ranked = products
      .map((p) => {
        const title = normalizeSearch(p.title),
          terms = normalizeSearch(
            [p.title, p.subject, p.topic, p.course, p.description].join(" "),
          ),
          words = terms.split(/\W+/);
        let score = q
          ? title.includes(q)
            ? 100
            : terms.includes(q)
              ? 60
              : q
                    .split(/\s+/)
                    .every((x) =>
                      words.some(
                        (w) =>
                          w === x || (x.length >= 4 && distance(x, w) <= 1),
                      ),
                    )
                ? 30
                : 0
          : 1;
        if (base) {
          const relevance =
            (p.subject === base.subject ? 20 : 0) +
            (p.course === base.course ? 10 : 0) +
            (p.category === base.category ? 4 : 0);
          score =
            p.id === base.id || !relevance
              ? 0
              : relevance + (p.author_id === base.author_id ? 2 : 0);
        }
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort(
        (a, b) => b.score - a.score || b.p.created.localeCompare(a.p.created),
      );
    const page = Math.max(
        1,
        Math.min(10000, Number(url.searchParams.get("page")) || 1),
      ),
      limit = 24;
    return json({
      products: ranked
        .slice((page - 1) * limit, page * limit)
        .map((x) => publicDTO(x.p)),
      total: ranked.length,
      page,
      suggestions: ranked.length
        ? []
        : [...new Set(products.map((p) => p.subject))].slice(0, 8),
    });
  }
  if (path === "product-info" && method === "GET") {
    const id = clean(url.searchParams.get("id"), 100),
      products = await publicProducts(e),
      p = products.find((x) => x.id === id);
    if (!p) fail("Material não encontrado.", 404);
    let ids: string[] = [];
    try {
      ids = JSON.parse(p.bundle_ids || "[]");
    } catch {}
    return json({
      extra:
        (
          await rows(
            e,
            "SELECT prerequisites,audience,exclusions,requirements,faq,updated FROM product_extras WHERE product_id=?",
            id,
          )
        )[0] || {},
      versions: await rows(
        e,
        "SELECT sequence,notes,released FROM product_versions WHERE product_id=? AND status='published' ORDER BY sequence DESC",
        id,
      ),
      components: products.filter((x) => ids.includes(x.id)).map(publicDTO),
      questions: await rows(
        e,
        "SELECT id,question,answer,created FROM product_questions WHERE product_id=? AND status='published' AND answer!='' ORDER BY created DESC",
        id,
      ),
    });
  }
  if (
    ![
      "saved-searches",
      "preferences",
      "author-follow",
      "product-extra",
      "product-questions",
      "author-draft",
      "product-changes",
      "duplicate-product",
    ].includes(path)
  )
    return null;
  const u = await auth(req);
  if (method !== "GET") await rate(e, u.id, path, 30);
  const b = method === "GET" ? null : await body(req);
  if (path === "preferences") {
    if (method === "GET")
      return json({
        interests: JSON.parse(
          String(
            (
              await rows(
                e,
                "SELECT interests FROM student_preferences WHERE user_id=?",
                u.id,
              )
            )[0]?.interests || "[]",
          ),
        ),
      });
    if (
      !Array.isArray(b!.interests) ||
      b!.interests.length > 15 ||
      b!.interests.some((x) => typeof x !== "string" || x.length > 100)
    )
      fail("Escolha até 15 assuntos.");
    await run(
      e,
      "INSERT INTO student_preferences(user_id,interests,updated) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET interests=excluded.interests,updated=excluded.updated",
      u.id,
      JSON.stringify(b!.interests),
      now(),
    );
    return json({ ok: true });
  }
  if (path === "saved-searches") {
    if (method === "GET")
      return json({
        searches: await rows(
          e,
          "SELECT id,title,filters FROM saved_searches WHERE user_id=? ORDER BY created DESC",
          u.id,
        ),
      });
    if (b!.action === "delete") {
      await run(
        e,
        "DELETE FROM saved_searches WHERE id=? AND user_id=?",
        clean(b!.id, 100),
        u.id,
      );
      return json({ ok: true });
    }
    if (
      !b!.filters ||
      typeof b!.filters !== "object" ||
      JSON.stringify(b!.filters).length > 5000 ||
      clean(b!.title, 100).length < 2
    )
      fail("Nome ou filtros inválidos.");
    if (
      (await rows(e, "SELECT id FROM saved_searches WHERE user_id=?", u.id))
        .length >= 20
    )
      fail("Limite de 20 buscas salvas.");
    await run(
      e,
      "INSERT INTO saved_searches(id,user_id,title,filters,created) VALUES(?,?,?,?,?)",
      crypto.randomUUID(),
      u.id,
      clean(b!.title, 100),
      JSON.stringify(b!.filters),
      now(),
    );
    return json({ ok: true });
  }
  if (path === "author-follow") {
    if (method === "GET")
      return json({
        follows: await rows(
          e,
          "SELECT f.author_id,f.notify,u.public_name,u.author_slug FROM author_follows f JOIN users u ON u.id=f.author_id WHERE f.user_id=?",
          u.id,
        ),
      });
    const slug = clean(b!.slug, 60),
      author = (
        await rows(e, "SELECT id FROM users WHERE author_slug=?", slug)
      )[0];
    if (!author) fail("Autor não encontrado.", 404);
    const id = u.id + ":" + author.id;
    if (b!.following === false)
      await run(e, "DELETE FROM author_follows WHERE id=?", id);
    else
      await run(
        e,
        "INSERT INTO author_follows(id,user_id,author_id,notify,created) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET notify=excluded.notify",
        id,
        u.id,
        author.id,
        b!.notify === true ? 1 : 0,
        now(),
      );
    return json({ ok: true });
  }
  if (path === "product-extra") {
    const id = clean(b?.id || url.searchParams.get("id"), 100);
    await owned(e, u, id);
    if (method === "GET")
      return json({
        extra:
          (
            await rows(e, "SELECT * FROM product_extras WHERE product_id=?", id)
          )[0] || {},
      });
    const checklist = b!.checklist || {};
    if (
      typeof checklist !== "object" ||
      JSON.stringify(checklist).length > 3000
    )
      fail("Checklist inválido.");
    await run(
      e,
      "INSERT INTO product_extras(product_id,prerequisites,audience,exclusions,requirements,faq,checklist,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET prerequisites=excluded.prerequisites,audience=excluded.audience,exclusions=excluded.exclusions,requirements=excluded.requirements,faq=excluded.faq,checklist=excluded.checklist,updated=excluded.updated",
      id,
      ...["prerequisites", "audience", "exclusions", "requirements", "faq"].map(
        (k) => clean(b![k], 6000),
      ),
      JSON.stringify(checklist),
      now(),
    );
    await run(
      e,
      "UPDATE products SET status='draft',reviewed_by=NULL,reviewed_at=NULL WHERE id=?",
      id,
    );
    await audit(e, u.id, "product.extra_saved", id);
    return json({ ok: true });
  }
  if (path === "author-draft") {
    const key = clean(b?.key || url.searchParams.get("key") || "new", 100),
      id = u.id + ":" + key;
    if (method === "GET")
      return json({
        draft:
          (
            await rows(
              e,
              "SELECT data,revision,updated FROM author_drafts WHERE id=? AND user_id=?",
              id,
              u.id,
            )
          )[0] || null,
      });
    if (b!.action === "delete") {
      await run(
        e,
        "DELETE FROM author_drafts WHERE id=? AND user_id=?",
        id,
        u.id,
      );
      return json({ ok: true });
    }
    if (
      !b!.data ||
      typeof b!.data !== "object" ||
      JSON.stringify(b!.data).length > 80000
    )
      fail("Rascunho inválido.");
    const data = {
      ...(b!.data as Record<string, unknown>),
      rights: false,
      commercial_accepted: false,
    };
    await run(
      e,
      "INSERT INTO author_drafts(id,user_id,data,updated) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=revision+1,updated=excluded.updated",
      id,
      u.id,
      JSON.stringify(data),
      now(),
    );
    return json({ ok: true });
  }
  if (path === "product-changes") {
    const id = clean(url.searchParams.get("id"), 100);
    await owned(e, u, id);
    return json({
      changes: await rows(
        e,
        "SELECT id,snapshot,created FROM product_changes WHERE product_id=? ORDER BY created DESC LIMIT 20",
        id,
      ),
    });
  }
  if (path === "duplicate-product" && method === "POST") {
    const id = clean(b!.id, 100),
      p = await owned(e, u, id),
      next = crypto.randomUUID();
    await run(
      e,
      "INSERT INTO products(id,author_id,title,description,category,subject,course,topic,level,language,format,price,pages,author,preview,status,demo,created,updated,objectives,toc,sources) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',0,?,?,?,?,?)",
      next,
      u.id,
      ("Cópia: " + p.title).slice(0, 150),
      p.description,
      p.category,
      p.subject,
      p.course,
      p.topic,
      p.level,
      p.language,
      p.format,
      p.price,
      p.pages,
      p.author,
      p.preview,
      now(),
      now(),
      p.objectives,
      p.toc,
      p.sources,
    );
    await audit(e, u.id, "product.duplicated", next);
    return json({ id: next, ok: true });
  }
  if (path === "product-questions") {
    if (method === "GET") {
      return json({
        questions: await rows(
          e,
          `SELECT q.id,q.product_id,q.question,q.answer,q.status,q.created,p.title FROM product_questions q JOIN products p ON p.id=q.product_id ${u.admin ? "" : url.searchParams.get("scope") === "author" ? "WHERE p.author_id=?" : "WHERE q.user_id=?"} ORDER BY q.created DESC LIMIT 200`,
          ...(u.admin ? [] : [u.id]),
        ),
      });
    }
    if (b!.action === "respond") {
      const q = (
        await rows(
          e,
          "SELECT q.*,p.author_id FROM product_questions q JOIN products p ON p.id=q.product_id WHERE q.id=?",
          clean(b!.id, 100),
        )
      )[0];
      if (!q || (q.author_id !== u.id && !u.admin)) fail("Acesso negado.", 403);
      const status = String(b!.status);
      if (
        !["pending", "published", "hidden"].includes(status) ||
        (status === "published" && clean(b!.answer).length < 5)
      )
        fail("Informe uma resposta para publicar.");
      await run(
        e,
        "UPDATE product_questions SET answer=?,status=?,updated=? WHERE id=?",
        clean(b!.answer, 3000),
        status,
        now(),
        q.id,
      );
      return json({ ok: true });
    }
    const id = clean(b!.product_id, 100);
    if (!(await publicProducts(e)).some((p) => p.id === id))
      fail("Material não encontrado.", 404);
    if (clean(b!.question).length < 10)
      fail("Descreva sua dúvida com pelo menos 10 caracteres.");
    await run(
      e,
      "INSERT INTO product_questions(id,product_id,user_id,question,created,updated) VALUES(?,?,?,?,?,?)",
      crypto.randomUUID(),
      id,
      u.id,
      clean(b!.question, 3000),
      now(),
      now(),
    );
    return json({ ok: true });
  }
  return null;
}
