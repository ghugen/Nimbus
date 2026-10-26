export type Workspace = "loja" | "estudante" | "autor" | "admin" | "staff";
export const adminGroups = [
  { label: "Visão geral", items: [["resumo", "Resumo"]] },
  {
    label: "Catálogo",
    items: [
      ["produtos", "Materiais"],
      ["aprovações", "Aprovações"],
      ["coleções", "Coleções"],
      ["cupons", "Cupons"],
      ["planos", "Planos e clubes"],
      ["serviços", "Encontros e serviços"],
    ],
  },
  {
    label: "Vendas",
    items: [
      ["pedidos", "Pedidos"],
      ["financeiro", "Financeiro"],
      ["reembolsos", "Reembolsos"],
      ["indicadores", "Indicadores"],
    ],
  },
  {
    label: "Relacionamento",
    items: [
      ["pessoas", "Pessoas"],
      ["atendimento", "Atendimento"],
      ["correções", "Correções"],
      ["sugestões", "Sugestões"],
      ["perguntas", "Perguntas"],
      ["denúncias", "Autoria e qualidade"],
      ["avaliações", "Avaliações"],
      ["verificações", "Credenciais"],
    ],
  },
  {
    label: "Gestão",
    items: [
      ["ideias", "Ideias e planejamento"],
      ["equipe", "Equipe e permissões"],
      ["melhorias", "100 melhorias"],
      ["tarefas", "Tarefas"],
      ["relatórios", "Relatórios e recuperação"],
      ["alertas", "Alertas"],
      ["operação", "Operação"],
      ["privacidade", "Privacidade"],
      ["histórico", "Histórico"],
    ],
  },
];
export const authorTabs = [
  "perguntas",
  "avaliacoes",
  "resumo",
  "materiais",
  "publicar",
  "perfil",
  "vendas",
  "indicadores",
  "correcoes",
];
const accountViews = [
  "licencas",
  "assinaturas",
  "servicos",
  "biblioteca",
  "favoritos",
  "pedidos",
  "perfil",
  "suporte",
  "notificacoes",
  "interesses",
  "correcoes",
];
export function workspaceFor(view: string): Workspace {
  return view === "equipe"
    ? "staff"
    : view === "admin"
      ? "admin"
      : view === "autores"
        ? "autor"
        : accountViews.includes(view)
          ? "estudante"
          : "loja";
}
export function homeFor(user: { admin: boolean } | null) {
  return user ? (user.admin ? "admin" : "biblioteca") : "inicio";
}
export function parseNavigation(hash: string) {
  let decoded = hash;
  try {
    decoded = decodeURIComponent(hash);
  } catch {}
  const [view, sub] = decoded.replace(/^#/, "").split("/");
  return {
    view: view || "inicio",
    adminTab:
      view === "admin" &&
      adminGroups.some((g) => g.items.some(([id]) => id === sub))
        ? sub
        : "resumo",
    authorTab: view === "autores" && authorTabs.includes(sub) ? sub : "resumo",
  };
}
export function safeReturnTarget(value: string | null) {
  if (!value) return "conta";
  const clean = value.replace(/^#/, "");
  const { view } = parseNavigation(clean);
  if (
    [
      "inicio",
      "catalogo",
      "colecoes",
      "gratuitos",
      "carrinho",
      "conta",
      ...accountViews,
    ].includes(clean)
  )
    return clean;
  if (["admin", "autores"].includes(view)) {
    const route = parseNavigation(clean);
    const valid =
      clean === view ||
      clean ===
        view + "/" + (view === "admin" ? route.adminTab : route.authorTab);
    if (valid) return clean;
  }
  return "conta";
}
