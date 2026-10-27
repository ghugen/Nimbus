import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyProfile,
  understand,
  recommend,
  buildPlan,
  planCalendar,
  todayAt,
  validDate,
  type SofiaMaterial,
} from "../lib/sofia-core.ts";
const catalog: SofiaMaterial[] = [
  {
    id: "p",
    title: "Lesão celular e necrose",
    description: "Resumo original de patologia para estudo.",
    course: "Medicina Veterinária",
    subject: "Patologia",
    format: "Resumos e apostilas",
    price: 2490,
    pages: 20,
  },
  {
    id: "q",
    title: "Questões sobre necrose",
    description: "Questões originais de lesão celular.",
    course: "Medicina Veterinária",
    subject: "Patologia",
    format: "Questões e simulados",
    price: 1500,
    pages: 10,
  },
  {
    id: "free",
    title: "Leitura de artigos",
    description: "Guia original para leitura científica.",
    course: "Formação acadêmica geral",
    subject: "Leitura científica",
    format: "Guias práticos",
    price: 0,
    pages: 3,
  },
];
test("Sofia entende tema, curso, formato e orçamento sem executar comandos", () => {
  const r = understand(
    "Quero resumos de necrose em Medicina Veterinária até R$ 30,50",
    emptyProfile,
    ["Medicina Veterinária"],
  );
  assert.equal(r.intent, "recommend");
  assert.equal(r.profile.course, "Medicina Veterinária");
  assert.equal(r.profile.budget, 3050);
  assert.equal(r.profile.format, "Resumos e apostilas");
  assert(r.profile.topic.includes("necrose"));
  assert.equal(understand("Onde parei?", emptyProfile).intent, "continue");
  assert.equal(
    understand("O que revisar hoje?", emptyProfile).intent,
    "reviews",
  );
  assert.equal(
    understand("Quero organizar meu plano", emptyProfile).intent,
    "plan",
  );
  assert.equal(understand("Qual a dose?", emptyProfile).intent, "limits");
});
test("Sofia combina filtros e não inventa produtos nem resultados para tema ausente", () => {
  assert.equal(
    recommend(catalog, { ...emptyProfile, topic: "necrose", budget: 2000 })[0]
      .material.id,
    "q",
  );
  assert.equal(
    recommend(catalog, { ...emptyProfile, topic: "necrose", freeOnly: true })
      .length,
    0,
  );
  assert.equal(
    recommend(catalog, { ...emptyProfile, topic: "necrose", course: "Direito" })
      .length,
    0,
  );
  assert.equal(
    recommend(catalog, { ...emptyProfile, topic: "astrobiologia exoplanetas" })
      .length,
    0,
  );
  assert(
    recommend(catalog, { ...emptyProfile, topic: "necrose" }, ["p"])
      .find((r) => r.material.id === "p")
      ?.reasons.some((s) => s.includes("biblioteca")),
  );
});
test("objetivo influencia ordenação, sem recuperar material sem relação temática", () => {
  assert.equal(
    recommend(catalog, {
      ...emptyProfile,
      topic: "necrose",
      goal: "practice",
    })[0].material.id,
    "q",
  );
  assert.equal(
    recommend(catalog, { ...emptyProfile, topic: "necrose", goal: "review" })[0]
      .material.id,
    "p",
  );
  assert.equal(
    recommend(catalog, { ...emptyProfile, topic: "saturno", goal: "practice" })
      .length,
    0,
  );
});
test("uma frase de refinamento não apaga o tema anterior", () => {
  const p = { ...emptyProfile, topic: "necrose", freeOnly: true };
  assert.equal(understand("Pode ser pago", p).profile.topic, "necrose");
  assert.equal(understand("Pode ser pago", p).profile.freeOnly, false);
  assert.equal(
    understand("Buscar com minhas preferências", p).profile.topic,
    "necrose",
  );
});
test("planos respeitam orçamento de minutos, prazo e identidade das tarefas", () => {
  for (let minutes = 10; minutes <= 180; minutes++) {
    const p = buildPlan(
      {
        ...emptyProfile,
        dailyMinutes: minutes,
        topics: "Lesão celular,Inflamação,Reparação",
        examDate: "2026-11-02",
      },
      "2026-10-26",
    );
    assert.equal(
      p.tasks.reduce((s, t) => s + t.minutes, 0),
      minutes * 8,
    );
    for (const date of new Set(p.tasks.map((t) => t.date))) {
      assert.equal(
        p.tasks
          .filter((t) => t.date === date)
          .reduce((s, t) => s + t.minutes, 0),
        minutes,
      );
      assert(date <= "2026-11-02");
    }
    assert.equal(new Set(p.tasks.map((t) => t.id)).size, p.tasks.length);
  }
});
test("plano curto informa lacunas e recusa datas ou parâmetros inválidos", () => {
  const p = buildPlan(
    { ...emptyProfile, topics: "A,B,C", examDate: "2026-10-26" },
    "2026-10-26",
  );
  assert.deepEqual(p.uncovered, ["B", "C"]);
  assert.throws(() =>
    buildPlan(
      { ...emptyProfile, topics: "A", examDate: "2027-02-30" },
      "2026-10-26",
    ),
  );
  assert.throws(() =>
    buildPlan({ ...emptyProfile, topics: "A", dailyMinutes: 0 }, "2026-10-26"),
  );
  assert.throws(() => buildPlan({ ...emptyProfile, topics: "" }, "2026-10-26"));
  assert.equal(validDate("2027-02-30"), false);
});
test("calendário escapa dados e só inclui alarme quando solicitado", () => {
  const p = buildPlan(
    {
      ...emptyProfile,
      topics: "Tópico técnico muito longo com acentuação avançada",
      dailyMinutes: 30,
    },
    "2026-10-26",
  );
  const raw = planCalendar(p);
  assert(raw.startsWith("BEGIN:VCALENDAR\r\n"));
  assert(!raw.includes("BEGIN:VALARM"));
  assert(planCalendar(p, true).includes("TRIGGER:-PT10M"));
  for (const line of raw.split("\r\n"))
    assert(new TextEncoder().encode(line).length <= 75);
  const injected = planCalendar({
    ...p,
    tasks: p.tasks.map((t) => ({ ...t, label: "Linha\r\nBEGIN:VEVENT,;" })),
  });
  assert(injected.includes("Linha\\nBEGIN:VEVENT\\,\\;"));
});
test("data da Sofia considera o fuso de planejamento", () => {
  const date = new Date("2026-10-27T01:00:00Z");
  assert.equal(todayAt("America/Sao_Paulo", date), "2026-10-26");
  assert.equal(todayAt("UTC", date), "2026-10-27");
});
