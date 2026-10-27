import { tokens, type SofiaMaterial } from "./sofia-core.ts";
export function syllabusTopics(value: string) {
  if (value.length > 6000) throw new Error("Use até 6.000 caracteres.");
  const topics = [
    ...new Set(
      value
        .split(/[\n;]+/)
        .map((t) => t.replace(/^\s*(?:[-•]|\d+[.)])\s*/, "").trim())
        .filter(Boolean),
    ),
  ];
  if (
    !topics.length ||
    topics.length > 20 ||
    topics.some((t) => t.length > 120 || !tokens(t).length)
  )
    throw new Error(
      "Informe de 1 a 20 temas, até 120 caracteres cada, um por linha ou separados por ponto e vírgula.",
    );
  return topics;
}
export function coverage(topics: string[], materials: SofiaMaterial[]) {
  return topics.map((topic) => {
    const terms = tokens(topic);
    const items = materials
      .flatMap((p) => {
        const hay = new Set(
          tokens([p.title, p.description, p.subject, p.topic || ""].join(" ")),
        );
        const matched = terms.filter((t) => hay.has(t));
        if (!matched.length) return [];
        return [
          {
            id: p.id,
            title: p.title,
            format: p.format,
            price: p.price,
            matched,
            ratio: matched.length / terms.length,
          },
        ];
      })
      .sort(
        (a, b) =>
          b.ratio - a.ratio ||
          a.price - b.price ||
          a.title.localeCompare(b.title),
      )
      .slice(0, 5);
    return {
      topic,
      status: !items.length
        ? "absent"
        : items[0].ratio === 1
          ? "matched"
          : "partial",
      items,
    };
  });
}
export function overlap(a: SofiaMaterial, b: SofiaMaterial) {
  const x = new Set(
      tokens([a.title, a.subject, a.topic || "", a.description].join(" ")),
    ),
    y = new Set(
      tokens([b.title, b.subject, b.topic || "", b.description].join(" ")),
    );
  const shared = [...x].filter((t) => y.has(t));
  return {
    shared: shared.slice(0, 12),
    ratio: Math.round(
      (100 * shared.length) / Math.max(1, Math.min(x.size, y.size)),
    ),
    notice:
      "Semelhança entre termos do cadastro; não comprova duplicação nem equivalência dos arquivos.",
  };
}
export function acquisition(
  ticket: number,
  cost: number,
  profit: number,
  conversion: number,
) {
  if (
    [ticket, cost, profit, conversion].some((x) => !Number.isFinite(x)) ||
    ticket <= 0 ||
    cost < 0 ||
    profit < 0 ||
    conversion <= 0 ||
    conversion > 100 ||
    cost + profit > ticket
  )
    throw new Error("Confira receita, custos, lucro desejado e conversão.");
  const maxCac = Math.max(0, ticket - cost - profit);
  return {
    contribution: ticket - cost,
    maxCac,
    maxCpc: (maxCac * conversion) / 100,
    breakEvenRoas: ticket > cost ? ticket / (ticket - cost) : null,
  };
}
export const editorialTemplate = `# Título do material\n\n## Público e conhecimentos necessários\nPreencha a quem se destina e os conhecimentos prévios.\n\n## Objetivos de aprendizagem\nUse objetivos verificáveis, sem prometer aprovação.\n\n## Sumário e páginas\nRegistre cada seção e sua página.\n\n## Conteúdo e exemplos\nDesenvolva conceitos, exemplos autorais e limitações.\n\n## Revisão ativa\nInclua perguntas com respostas comentadas e páginas de referência.\n\n## Referências\nInforme fontes completas e confira as citações.\n\n## Autoria e direitos\nConfirme autoria e autorizações de imagens e trechos.\n\n## Histórico\nVersão, data, responsável pela revisão, mudanças e próxima revisão.\n`;
