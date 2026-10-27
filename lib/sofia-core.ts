// Nimbus Sofia: deterministic discovery and planning. No LLM, external inference or chat storage.
export const SOFIA_VERSION = "sofia-rules-v1";
export type SofiaProfile = {
  course: string;
  topic: string;
  goal: string;
  format: string;
  budget: number | null;
  freeOnly: boolean;
  examDate: string;
  dailyMinutes: number;
  topics: string;
  time: string;
  timezone: string;
};
export const emptyProfile: SofiaProfile = {
  course: "",
  topic: "",
  goal: "understand",
  format: "",
  budget: null,
  freeOnly: false,
  examDate: "",
  dailyMinutes: 30,
  topics: "",
  time: "19:00",
  timezone: "America/Sao_Paulo",
};
export type SofiaMaterial = {
  id: string;
  title: string;
  description: string;
  course?: string;
  subject: string;
  topic?: string;
  format: string;
  price: number;
  pages: number;
};
export type SofiaTask = {
  id: string;
  date: string;
  topic: string;
  kind: "read" | "practice" | "review";
  label: string;
  minutes: number;
};
export type SofiaPlan = {
  version: string;
  start: string;
  end: string;
  timezone: string;
  time: string;
  dailyMinutes: number;
  tasks: SofiaTask[];
  uncovered: string[];
  notice: string;
};
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const stop = new Set(
  "a o as os um uma de da do das dos e em no na nos nas para por com sem eu meu minha meus minhas quero preciso material materiais sobre estudar estudo ajudar ajuda gostaria favor tenho dificuldade me mostre encontrar ate reais r so que sou nao prova revisao pode ser voce sofia busque buscar procure recomendar recomenda indique indicar entender aprender saber conteudo assunto tema todos outros apenas mais menos guia guias minhas preferencias preferencias estas estes buscar".split(
    " ",
  ),
);
const related = [
  ["necrose", "lesao celular", "morte celular", "patologia"],
  ["anatomia", "anatomico", "estruturas"],
  ["histologia", "tecidos", "microscopia"],
  ["calculo", "derivada", "integral", "matematica"],
  ["fichamento", "anotacoes", "referencias"],
  ["leitura cientifica", "artigo", "artigos", "pesquisa"],
  ["planejamento", "organizacao", "rotina", "cronograma"],
  ["flashcards", "cartoes", "memorizacao", "revisao ativa"],
];
export function tokens(text: string) {
  return [
    ...new Set(
      normalize(text)
        .split(" ")
        .filter((t) => t.length > 2 && !stop.has(t)),
    ),
  ].slice(0, 40);
}
export function recommend(
  materials: SofiaMaterial[],
  profile: SofiaProfile,
  owned: string[] = [],
) {
  const q = normalize(profile.topic),
    need = tokens(q),
    course = normalize(profile.course),
    groups = related.filter((g) => g.some((word) => q.includes(word))),
    own = new Set(owned);
  const matches = materials
    .filter(
      (p) =>
        Number.isSafeInteger(p.price) &&
        p.price >= 0 &&
        (!profile.freeOnly || p.price === 0) &&
        (profile.budget === null || p.price <= profile.budget) &&
        (!profile.format || p.format === profile.format) &&
        (!course || normalize(p.course || "") === course),
    )
    .map((p) => {
      const title = normalize(
          p.title + " " + p.subject + " " + (p.topic || ""),
        ),
        all = title + " " + normalize(p.description),
        hits = need.filter((t) => all.includes(t)),
        direct = need.length ? hits.length / need.length : 0,
        phrase = q.length > 2 && all.includes(q),
        semantic = groups.filter((g) => g.some((t) => all.includes(t))).length;
      let score =
        (phrase ? 20 : 0) +
        direct * 12 +
        semantic * 3 +
        (need.length === 0 ? 1 : 0);
      if (need.length && hits.length === 0 && semantic === 0) score = 0;
      const reasons: string[] = [];
      if (phrase) reasons.push("O tema aparece na descrição do material.");
      else if (hits.length)
        reasons.push(
          "Termos encontrados no cadastro: " +
            hits.slice(0, 4).join(", ") +
            ".",
        );
      else if (semantic)
        reasons.push(
          "O cadastro aborda assuntos relacionados à sua busca; confira a prévia.",
        );
      if (course) reasons.push("Curso corresponde ao filtro escolhido.");
      if (profile.format) reasons.push("Formato escolhido: " + p.format + ".");
      if (own.has(p.id))
        reasons.push("Já está na sua biblioteca; aproveite seu acesso.");
      else if (p.price === 0) reasons.push("Material gratuito.");
      const goalMatch =
        profile.goal === "practice"
          ? [
              "Questões e simulados",
              "Flashcards",
              "Casos para estudo",
            ].includes(p.format)
          : profile.goal === "review"
            ? [
                "Resumos e apostilas",
                "Mapas mentais e esquemas",
                "Revisões para provas",
              ].includes(p.format)
            : ["Guias práticos", "Resumos e apostilas"].includes(p.format);
      if (score > 0 && goalMatch) {
        score += 2;
        reasons.push("O formato combina com o objetivo de estudo escolhido.");
      }
      return { material: p, score, reasons, owned: own.has(p.id) };
    })
    .filter((r) => r.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.owned) - Number(a.owned) ||
        a.material.price - b.material.price ||
        a.material.title.localeCompare(b.material.title, "pt-BR"),
    );
  return matches.slice(0, 5);
}
export function understand(
  message: string,
  previous: SofiaProfile,
  courses: string[] = [],
) {
  const text = normalize(message),
    profile = { ...previous };
  let intent:
    | "help"
    | "recommend"
    | "continue"
    | "reviews"
    | "plan"
    | "limits"
    | "hello" = "recommend";
  if (
    /\b(quem e voce|quem e (a )?sofia|qual seu nome|como (voce )?funciona|o que voce faz|ajuda|pagamento|download|reembolso|privacidade|login)\b/.test(
      text,
    )
  )
    intent = "help";
  if (
    /\b(oi|ola|bom dia|boa tarde|boa noite)\b/.test(text) &&
    text.split(" ").length < 6
  )
    intent = "hello";
  if (/\b(continuar|retomar|onde parei|ultima pagina)\b/.test(text))
    intent = "continue";
  if (
    /\b(minhas revisoes|revisoes pendentes|cartoes hoje|revisar hoje|o que revisar|pendencias)\b/.test(
      text,
    )
  )
    intent = "reviews";
  if (
    /\b(plano|cronograma|organizar|planejar|rotina|calendario|agenda|lembrete|lembretes|me lembre)\b/.test(
      text,
    )
  )
    intent = "plan";
  if (
    /\b(explique|diagnostico|diagnosticar|qual a dose|como tratar|resolva|escreva uma redacao|o que e)\b/.test(
      text,
    )
  )
    intent = "limits";
  const course = courses
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((c) => text.includes(normalize(c)));
  if (course) profile.course = course;
  else if (/\bveterinaria\b/.test(text))
    profile.course = "Medicina Veterinária";
  if (
    /\b(gratis|gratuito|gratuitos|gratuita|gratuitas|sem pagar)\b/.test(text) &&
    !/(nao precisa|nao so|pode ser pago)/.test(text)
  )
    profile.freeOnly = true;
  if (
    /\b(pode ser pago|todos os precos|nao precisa ser gratis|nao precisa ser gratuito)\b/.test(
      text,
    )
  )
    profile.freeOnly = false;
  const amount = message.match(
    /(?:até|ate|orçamento|orcamento)\s*(?:de\s*)?(?:R\$\s*)?(\d{1,5}(?:[.,]\d{1,2})?)/i,
  );
  if (amount) {
    const value = Math.round(Number(amount[1].replace(",", ".")) * 100);
    if (Number.isSafeInteger(value) && value >= 0) profile.budget = value;
  }
  if (/\b(questoes|simulados|exercicios)\b/.test(text)) {
    profile.format = "Questões e simulados";
    profile.goal = "practice";
  } else if (/\b(imagens|atlas|ilustracoes)\b/.test(text))
    profile.format = "Atlas e materiais ilustrados";
  else if (/\b(resumo|resumos|apostila|apostilas)\b/.test(text))
    profile.format = "Resumos e apostilas";
  else if (/\b(flashcards|cartoes)\b/.test(text)) profile.format = "Flashcards";
  if (/\b(todos os formatos|qualquer formato)\b/.test(text))
    profile.format = "";
  if (intent === "recommend") {
    let topic = message
      .replace(
        /(?:até|ate|orçamento|orcamento)\s*(?:de\s*)?(?:R\$\s*)?\d{1,5}(?:[.,]\d{1,2})?/gi,
        "",
      )
      .trim();
    for (const c of courses)
      topic = topic.replace(
        new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
        "",
      );
    const words = tokens(topic).filter(
      (t) =>
        ![
          "gratis",
          "gratuito",
          "gratuitos",
          "gratuita",
          "gratuitas",
          "pago",
          "pagos",
          "formatos",
          "todos",
          "qualquer",
          "resumo",
          "resumos",
          "apostila",
          "apostilas",
          "questoes",
          "simulados",
          "imagens",
          "atlas",
          "veterinaria",
          "medicina",
          "prova",
        ].includes(t),
    );
    if (words.length) profile.topic = words.join(" ").slice(0, 160);
  }
  return { intent, profile };
}
export function todayAt(timezone = "America/Sao_Paulo", date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";
  return part("year") + "-" + part("month") + "-" + part("day");
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !isNaN(Date.parse(value)) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
  );
}
const advance = (date: string, n: number) =>
  new Date(Date.parse(date + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
export function buildPlan(
  profile: SofiaProfile,
  start = todayAt(profile.timezone),
): SofiaPlan {
  if (
    !validDate(start) ||
    !Number.isInteger(profile.dailyMinutes) ||
    profile.dailyMinutes < 10 ||
    profile.dailyMinutes > 180 ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(profile.time)
  )
    throw Error("Escolha de 10 a 180 minutos e um horário válido.");
  const topics = [
    ...new Set(
      profile.topics
        .split(/[,;\n]/)
        .map((t) => t.trim().slice(0, 120))
        .filter(Boolean),
    ),
  ];
  if (!topics.length || topics.length > 20)
    throw Error("Informe de 1 a 20 temas, separados por vírgulas ou linhas.");
  if (
    profile.examDate &&
    (!validDate(profile.examDate) || profile.examDate < start)
  )
    throw Error("A data da prova deve ser hoje ou uma data futura.");
  const days = profile.examDate
    ? Math.min(
        14,
        Math.floor(
          (Date.parse(profile.examDate) - Date.parse(start)) / 86400000,
        ) + 1,
      )
    : Math.min(14, Math.max(7, topics.length));
  const tasks: SofiaTask[] = [];
  for (let d = 0; d < days; d++) {
    const topic = topics[d % topics.length],
      entries: { topic: string; kind: SofiaTask["kind"]; label: string }[] = [
        {
          topic,
          kind: d < topics.length ? "read" : "review",
          label:
            (d < topics.length
              ? "Ler e registrar dúvidas: "
              : "Revisar com a fonte: ") + topic,
        },
        {
          topic,
          kind: "practice",
          label: "Tentar explicar sem consultar e conferir a fonte: " + topic,
        },
      ];
    const revisit =
      d >= 3
        ? topics[(d - 3) % topics.length]
        : d >= 1
          ? topics[(d - 1) % topics.length]
          : null;
    if (revisit && revisit !== topic)
      entries.push({
        topic: revisit,
        kind: "review",
        label: "Retomar o tema anterior e conferir dúvidas: " + revisit,
      });
    entries.forEach((t, i) =>
      tasks.push({
        ...t,
        id: "d" + d + "-t" + i,
        date: advance(start, d),
        minutes:
          Math.floor(profile.dailyMinutes / entries.length) +
          (i < profile.dailyMinutes % entries.length ? 1 : 0),
      }),
    );
  }
  return {
    version: SOFIA_VERSION,
    start,
    end: advance(start, days - 1),
    timezone: profile.timezone,
    time: profile.time,
    dailyMinutes: profile.dailyMinutes,
    tasks,
    uncovered: topics.slice(days),
    notice:
      "Roteiro sugerido por regras, de até 14 dias. Ajuste ao seu ritmo e às orientações da disciplina. Não mede domínio nem garante desempenho.",
  };
}
const calendarEscape = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\r/g, "");
export function planCalendar(plan: SofiaPlan, alarm = false) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nimbus//Sofia//PT-BR",
    "CALSCALE:GREGORIAN",
  ];
  for (const date of [...new Set(plan.tasks.map((t) => t.date))]) {
    const tasks = plan.tasks.filter((t) => t.date === date);
    const start =
      date.replace(/-/g, "") + "T" + plan.time.replace(":", "") + "00";
    lines.push(
      "BEGIN:VEVENT",
      "UID:sofia-" + date + "-" + plan.time.replace(":", "") + "@nimbus",
      "DTSTAMP:" + plan.start.replace(/-/g, "") + "T120000Z",
      "DTSTART:" + start,
      "DURATION:PT" + plan.dailyMinutes + "M",
      "SUMMARY:" + calendarEscape("Estudo Nimbus: " + tasks[0].topic),
      "DESCRIPTION:" +
        calendarEscape(
          tasks.map((t) => t.label + " (" + t.minutes + " min)").join("\n"),
        ),
    );
    if (alarm)
      lines.push(
        "BEGIN:VALARM",
        "TRIGGER:-PT10M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Revisão do plano Sofia",
        "END:VALARM",
      );
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  // Floating local times: calendar uses the importing device's time zone; UI explicitly discloses this.
  return (
    lines
      .map((line) => {
        let result = "",
          part = "";
        for (const c of line) {
          if (new TextEncoder().encode(part + c).length > 73) {
            result += part + "\r\n ";
            part = c;
          } else part += c;
        }
        return result + part;
      })
      .join("\r\n") + "\r\n"
  );
}
