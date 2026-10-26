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
import {
  publicProducts,
  publicProduct,
  bundleIds,
  validateBundle,
  entitlement,
} from "./catalog-services";
import { hasPackage } from "./learning-products";
import { policy } from "./finance";
import { searchMatches } from "./search";
import { paymentsReady } from "./payment-readiness";
export const defaultUpdatePolicy =
  "Inclui o arquivo adquirido e o acesso às versões posteriormente publicadas para este mesmo material na Nimbus. Não inclui novos produtos, mentorias nem suporte individual. O arquivo da compra é preservado no histórico. Consulte os avisos de correção e as condições da plataforma.";
export async function updateTerms(e: FeatureRuntime, id: string) {
  return String(
    (
      await rows(
        e,
        "SELECT update_policy FROM product_experience WHERE product_id=?",
        id,
      )
    )[0]?.update_policy || defaultUpdatePolicy,
  );
}
export async function updateTermStatements(
  e: FeatureRuntime,
  orderId: string,
  ids: string[],
  overrides: Record<string, string> = {},
) {
  const statements: D1PreparedStatement[] = [];
  for (const id of ids)
    statements.push(
      e.DB.prepare(
        "INSERT OR IGNORE INTO order_update_terms(id,order_id,product_id,terms,created) VALUES(?,?,?,?,?)",
      ).bind(
        orderId + ":" + id,
        orderId,
        id,
        overrides[id] || (await updateTerms(e, id)),
        now(),
      ),
    );
  return statements;
}
export const usabilityTasks = [
  {
    id: "find",
    title: "Encontre um material por curso e disciplina",
    href: "/#catalogo",
  },
  {
    id: "sample",
    title: "Abra a amostra e localize as referências",
    href: "/#gratuitos",
  },
  {
    id: "trial",
    title: "Leia o guia e responda às três questões",
    href: "/experimentar",
  },
  {
    id: "cart",
    title: "Localize o carrinho e confira as condições, sem pagar",
    href: "/#carrinho",
  },
  {
    id: "help",
    title: "Encontre o atendimento e a recuperação de acesso",
    href: "/#suporte",
  },
];
export async function productLaunchCheck(
  e: FeatureRuntime,
  u: FeatureUser,
  id: string,
) {
  const p = await owned(e, u, id),
    rule = await policy(e, String(p.author_id)),
    extra = (
      await rows(e, "SELECT * FROM product_extras WHERE product_id=?", id)
    )[0],
    experience = (
      await rows(e, "SELECT * FROM product_experience WHERE product_id=?", id)
    )[0],
    upload = (
      await rows(e, "SELECT result FROM upload_checks WHERE product_id=?", id)
    )[0];
  let files = false;
  try {
    files = p.file_key
      ? !!(await e.BUCKET.head(String(p.file_key)))
      : bundleIds({ bundle_ids: String(p.bundle_ids || "[]") }).length > 0
        ? (
            await validateBundle(
              e,
              id,
              String(p.author_id),
              bundleIds({ bundle_ids: String(p.bundle_ids || "[]") }),
            )
          ).length > 0
        : await hasPackage(e, id);
  } catch {
    /* Report an unmet check instead of revealing file keys. */
  }
  let pageCheck: { pages?: number } | null = null;
  try {
    pageCheck = JSON.parse(String(upload?.result || "null"));
  } catch {}
  const items = [
    {
      id: "real",
      label: "Material original, sem marca de demonstração",
      ready: p.demo !== 1,
    },
    {
      id: "metadata",
      label: "Título, descrição, disciplina e formato completos",
      ready:
        String(p.title).length >= 5 &&
        String(p.description).length >= 30 &&
        !!p.subject &&
        !!p.format,
    },
    {
      id: "terms",
      label: "Condições comerciais atuais aceitas",
      ready:
        p.accepted_owned === rule.owned &&
        p.accepted_bps === (rule.owned ? 0 : rule.commission_bps),
    },
    { id: "file", label: "Arquivo ou conteúdo disponível", ready: files },
    {
      id: "sample",
      label: "Prévia textual representativa cadastrada",
      ready: String(p.preview || "").length >= 30,
    },
    {
      id: "references",
      label: "Objetivos e referências informados",
      ready:
        String(p.sources || "").length >= 10 &&
        String(p.objectives || "").length >= 10,
    },
    {
      id: "price",
      label: "Preço válido em centavos",
      ready: Number.isSafeInteger(p.price) && Number(p.price) >= 0,
    },
    {
      id: "pages",
      label: "Páginas do PDF conferidas pelo sistema",
      ready:
        !String(p.file_name || "")
          .toLowerCase()
          .endsWith(".pdf") ||
        (!!pageCheck?.pages && pageCheck.pages === p.pages),
    },
    {
      id: "declarations",
      label: "Checklist de autoria e legibilidade preenchido",
      ready: (() => {
        try {
          const c = JSON.parse(String(extra?.checklist || "{}"));
          return [
            "original",
            "objectives",
            "references",
            "examples",
            "file",
            "preview",
          ].every((k) => c[k] === true);
        } catch {
          return false;
        }
      })(),
    },
    {
      id: "updates",
      label: "Condições de atualização e amostras conferidas pelo autor",
      ready: !!experience,
    },
    {
      id: "review",
      label: "Revisão editorial registrada",
      ready: !!p.reviewed_by && !!p.reviewed_at,
    },
  ];
  return {
    product_id: id,
    title: p.title,
    status: p.status,
    items,
    ready: items.every((i) => i.ready),
    notice:
      "Checklist orientativo. A publicação continua sujeita à moderação e não certifica qualidade científica ou acessibilidade.",
  };
}
export async function editorialTransparency(e: FeatureRuntime, id: string) {
  const p = await publicProduct(e, id);
  if (!p) fail("Material não encontrado.", 404);
  const event = (
    await rows(
      e,
      "SELECT checks,created FROM editorial_events WHERE product_id=? AND action='published' ORDER BY created DESC LIMIT 1",
      id,
    )
  )[0];
  let checks: string[] = [];
  try {
    const a = JSON.parse(String(event?.checks || "[]"));
    if (Array.isArray(a)) checks = a;
  } catch {}
  const current =
    !!p.reviewed_at &&
    !!p.reviewed_by &&
    (!p.updated || String(p.reviewed_at) >= String(p.updated));
  const observations = [
    ["sources", "Referências", String(p.sources || "").length >= 10],
    [
      "content",
      "Objetivos e conteúdo",
      String(p.objectives || "").length >= 10,
    ],
    ["legibility", "Legibilidade", !!p.file_name || !!p.public_download],
    ["examples", "Exemplos e exercícios", false],
    ["answers", "Respostas dos exercícios", false],
    ["rights", "Autoria e direitos", false],
  ] as const;
  return {
    items: observations.map(([id, label, registered]) => ({
      id,
      label,
      status:
        current && checks.includes(id)
          ? "reviewed"
          : registered
            ? "registered"
            : "not_recorded",
    })),
    reviewer: current ? p.reviewed_by : null,
    reviewed_at: current ? p.reviewed_at : null,
    notice:
      "Este quadro descreve registros editoriais. Não representa certificação, validação científica ou garantia de ausência de erros.",
  };
}
export async function studentExperience(
  req: Request,
  e: FeatureRuntime,
  auth: (r: Request) => Promise<FeatureUser>,
) {
  const url = new URL(req.url),
    path = url.pathname.slice(5),
    method = req.method;
  if (path === "usability-tasks" && method === "GET")
    return json({ tasks: usabilityTasks });
  if (path === "material-experience" && method === "GET") {
    const id = clean(url.searchParams.get("id"), 100),
      p = await publicProduct(e, id);
    if (!p) fail("Material não encontrado.", 404);
    const x = (
      await rows(e, "SELECT * FROM product_experience WHERE product_id=?", id)
    )[0];
    let descriptions: string[] = [];
    try {
      descriptions = JSON.parse(String(x?.sample_descriptions || "[]"));
    } catch {}
    return json({
      update_policy: x?.update_policy || defaultUpdatePolicy,
      sample_descriptions: descriptions,
      transparency: await editorialTransparency(e, id),
    });
  }
  if (path === "search-signal" && method === "POST") {
    const b = await body(req);
    if (b.consent !== true || !/^[-a-f0-9]{36}$/i.test(String(b.visitor)))
      fail("A medição exige consentimento e identificador válido.");
    const products = await publicProducts(e),
      q = clean(b.query, 100),
      course = clean(b.course, 100),
      subject = clean(b.subject, 100),
      format = clean(b.format, 100);
    if (!q && !course && !subject) return json({ ok: true, recorded: false });
    if (
      (course && !products.some((p) => p.course === course)) ||
      (subject && !products.some((p) => p.subject === subject)) ||
      (format && !products.some((p) => p.format === format))
    )
      fail("Filtro inválido.");
    const found = products.filter(
      (p) =>
        (!course || p.course === course) &&
        (!subject || p.subject === subject) &&
        (!format || p.format === format) &&
        searchMatches(
          [p.title, p.subject, p.topic, p.course, p.description].join(" "),
          q,
        ),
    );
    const day = now().slice(0, 10),
      hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(
              JSON.stringify([b.visitor, q, course, subject, format, day]),
            ),
          ),
        ),
      )
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
    await run(
      e,
      "DELETE FROM search_signals WHERE id IN (SELECT id FROM search_signals WHERE created<? LIMIT 500)",
      new Date(Date.now() - 90 * 86400000).toISOString(),
    );
    await run(
      e,
      "INSERT OR IGNORE INTO search_signals(id,course,subject,kind,created) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM search_signals WHERE created>=?)<5000",
      hash,
      course || "Não classificado",
      subject || "Não classificado",
      found.length ? "results" : "empty",
      now(),
      day,
    );
    return json({ ok: true, recorded: true });
  }
  if (
    ![
      "experience-editor",
      "launch-check",
      "study-feedback",
      "feedback-report",
      "demand-insights",
      "launch-readiness",
      "usability-feedback",
    ].includes(path)
  )
    return null;
  const u = await auth(req),
    b = method === "GET" ? null : await body(req);
  if (method !== "GET") await rate(e, u.id, path, 15);
  if (path === "experience-editor") {
    const id = clean(b?.product_id || url.searchParams.get("id"), 100);
    await owned(e, u, id);
    if (method === "GET")
      return json({
        experience: (
          await rows(
            e,
            "SELECT update_policy,sample_descriptions FROM product_experience WHERE product_id=?",
            id,
          )
        )[0] || {
          update_policy: defaultUpdatePolicy,
          sample_descriptions: "[]",
        },
      });
    const terms = clean(b!.update_policy, 3000),
      alts = b!.sample_descriptions;
    if (
      terms.length < 40 ||
      !Array.isArray(alts) ||
      alts.length > 6 ||
      alts.some((a) => typeof a !== "string" || a.length > 500) ||
      b!.confirmed !== true
    )
      fail("Descreva condições e amostras e confirme a conferência.");
    await run(
      e,
      "INSERT INTO product_experience(product_id,update_policy,sample_descriptions,updated) VALUES(?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET update_policy=excluded.update_policy,sample_descriptions=excluded.sample_descriptions,updated=excluded.updated",
      id,
      terms,
      JSON.stringify(alts),
      now(),
    );
    await run(
      e,
      "UPDATE products SET status='draft',reviewed_by=NULL,reviewed_at=NULL,updated=? WHERE id=?",
      now(),
      id,
    );
    await audit(e, u.id, "material.experience_updated", id);
    return json({ ok: true });
  }
  if (path === "launch-check") {
    if (method !== "GET") fail("Somente consulta.", 405);
    return json(
      await productLaunchCheck(e, u, clean(url.searchParams.get("id"), 100)),
    );
  }
  if (path === "study-feedback") {
    const id = clean(b?.product_id || url.searchParams.get("id"), 100);
    if (!(await entitlement(e, u.id, id)))
      fail("Disponível a estudantes com acesso ativo ao material.", 403);
    if (method === "GET")
      return json({
        feedback:
          (
            await rows(
              e,
              "SELECT helpfulness,difficulty,missing FROM study_feedback WHERE user_id=? AND product_id=?",
              u.id,
              id,
            )
          )[0] || null,
      });
    if (b!.action === "delete") {
      await run(
        e,
        "DELETE FROM study_feedback WHERE user_id=? AND product_id=?",
        u.id,
        id,
      );
      return json({ ok: true });
    }
    const helpfulness = Number(b!.helpfulness),
      difficulty = clean(b!.difficulty, 30);
    if (
      !Number.isInteger(helpfulness) ||
      helpfulness < 1 ||
      helpfulness > 5 ||
      !["too_easy", "adequate", "too_hard"].includes(difficulty) ||
      b!.consent !== true
    )
      fail("Informe utilidade, dificuldade e confirme o envio à equipe.");
    await run(
      e,
      "INSERT INTO study_feedback(id,product_id,user_id,helpfulness,difficulty,missing,created,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET helpfulness=excluded.helpfulness,difficulty=excluded.difficulty,missing=excluded.missing,updated=excluded.updated",
      u.id + ":" + id,
      id,
      u.id,
      helpfulness,
      difficulty,
      clean(b!.missing, 1500),
      now(),
      now(),
    );
    return json({ ok: true });
  }
  if (path === "usability-feedback") {
    if (method === "GET") {
      if (!u.admin) fail("Acesso restrito.", 403);
      return json({
        sessions: await rows(
          e,
          "SELECT id,tasks,device,notes,created FROM usability_sessions ORDER BY created DESC LIMIT 100",
        ),
      });
    }
    const tasks = b!.tasks;
    if (
      b!.consent !== true ||
      !Array.isArray(tasks) ||
      tasks.length !== usabilityTasks.length ||
      tasks.some(
        (t, i) =>
          !t ||
          t.id !== usabilityTasks[i].id ||
          !["easy", "difficult", "blocked", "not_tested"].includes(t.result),
      )
    )
      fail("Preencha as tarefas e confirme o envio.");
    const device = clean(b!.device, 30);
    if (!["mobile", "desktop", "tablet", "other"].includes(device))
      fail("Informe o dispositivo.");
    if (
      (
        await rows(
          e,
          "SELECT id FROM usability_sessions WHERE user_id=? AND created>=?",
          u.id,
          now().slice(0, 10),
        )
      ).length >= 3
    )
      fail("Limite de três avaliações por dia.", 429);
    await run(
      e,
      "INSERT INTO usability_sessions(id,user_id,tasks,device,notes,created) VALUES(?,?,?,?,?,?)",
      crypto.randomUUID(),
      u.id,
      JSON.stringify(tasks.map((t) => ({ id: t.id, result: t.result }))),
      device,
      clean(b!.notes, 2000),
      now(),
    );
    return json({ ok: true });
  }
  if (path === "feedback-report") {
    const id = clean(url.searchParams.get("id"), 100);
    if (id) await owned(e, u, id);
    else if (!u.admin) fail("Acesso restrito.", 403);
    return json({
      feedback: await rows(
        e,
        `SELECT f.product_id,p.title,f.helpfulness,f.difficulty,f.missing,f.updated FROM study_feedback f JOIN products p ON p.id=f.product_id ${id ? "WHERE f.product_id=?" : ""} ORDER BY f.updated DESC LIMIT 200`,
        ...(id ? [id] : []),
      ),
    });
  }
  if (!u.admin) fail("Acesso restrito.", 403);
  if (path === "demand-insights") {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    return json({
      since,
      searches: await rows(
        e,
        "SELECT course,subject,kind,COUNT(*) count FROM search_signals WHERE created>=? GROUP BY course,subject,kind ORDER BY count DESC LIMIT 100",
        since,
      ),
      favorites: await rows(
        e,
        "SELECT p.course,p.subject,COUNT(*) count FROM favorites f JOIN products p ON p.id=f.product_id GROUP BY p.course,p.subject ORDER BY count DESC LIMIT 30",
      ),
      requests: await rows(
        e,
        "SELECT course,subject,COUNT(*) requests,SUM((SELECT COUNT(*) FROM demand_votes v WHERE v.idea_id=d.id)) votes FROM demand_ideas d WHERE status NOT IN ('pending','hidden') GROUP BY course,subject ORDER BY votes DESC LIMIT 30",
      ),
      materials: await rows(
        e,
        "SELECT p.course,p.subject,a.kind,COUNT(*) count FROM analytics_events a JOIN products p ON p.id=a.product_id WHERE a.created>=? GROUP BY p.course,p.subject,a.kind ORDER BY count DESC LIMIT 60",
        since,
      ),
    });
  }
  const products = await publicProducts(e),
    commercial = products.filter((p) => !p.demo && p.price > 0),
    privacy = (
      await rows(
        e,
        "SELECT controller,contact,retention FROM privacy_settings WHERE id='nimbus'",
      )
    )[0],
    manual = (
      await rows(
        e,
        "SELECT value FROM growth_settings WHERE id='launch_checks'",
      )
    )[0];
  let saved: Record<
    string,
    { checked: boolean; notes: string; actor: string; date: string }
  > = {};
  try {
    saved = JSON.parse(String(manual?.value || "{}"));
  } catch {}
  if (method === "POST") {
    if (
      ![
        "payment_test",
        "support_test",
        "backup_restore",
        "content_review",
        "accessibility_test",
      ].includes(String(b!.id)) ||
      clean(b!.notes).length < 20
    )
      fail("Selecione uma conferência e descreva a evidência.");
    saved[String(b!.id)] = {
      checked: b!.checked === true,
      notes: clean(b!.notes, 2000),
      actor: u.name,
      date: now(),
    };
    await run(
      e,
      "INSERT INTO growth_settings(id,value,updated) VALUES('launch_checks',?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated=excluded.updated",
      JSON.stringify(saved),
      now(),
    );
    await audit(e, u.id, "launch.check_recorded", String(b!.id));
  }
  return json({
    automated: [
      {
        id: "payments",
        title: "Pagamento e confirmação configurados",
        ready: paymentsReady(e),
        detail: "Presença de credenciais e flag operacional; exige teste real.",
      },
      {
        id: "content",
        title: "Catálogo comercial real publicado",
        ready: commercial.length > 0,
        detail:
          commercial.length + " material(is) real(is) com preço positivo.",
      },
      {
        id: "email",
        title: "E-mail transacional configurado",
        ready: !!e.RESEND_API_KEY && !!e.EMAIL_FROM,
        detail: "Provedor e remetente; conferir entrega em contas reais.",
      },
      {
        id: "privacy",
        title: "Responsável e retenção informados",
        ready:
          !!privacy?.controller &&
          !!privacy?.contact &&
          String(privacy?.retention || "").length >= 50,
        detail: "Cadastro não substitui revisão jurídica.",
      },
    ],
    manual: saved,
    notice:
      "Este painel organiza evidências. Nenhuma marcação ativa pagamentos, publica materiais ou certifica conformidade.",
  });
}
