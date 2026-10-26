export type Workspace = "loja" | "estudante" | "autor" | "admin" | "staff";
export const adminGroups = [
  {
    label: "Visão geral",
    items: [
      ["resumo", "Resumo"],
      ["prontidao", "Prontidão para lançamento"],
    ],
  },
  {
    label: "Catálogo",
    items: [
      ["produtos", "Materiais"],
      ["aprovações", "Aprovações"],
      ["coleções", "Coleções"],
      ["lancamento", "Coleção inicial"],
      ["revisoes", "Revisões periódicas"],
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
      ["documentos", "Contratos e fiscal"],
      ["reembolsos", "Reembolsos"],
      ["indicadores", "Indicadores"],
      ["procura", "Procura por temas"],
      ["instituicoes", "Instituições"],
      ["parcerias", "Indicações e afiliados"],
    ],
  },
  {
    label: "Relacionamento",
    items: [
      ["pessoas", "Pessoas"],
      ["atendimento", "Atendimento"],
      ["correções", "Correções"],
      ["sugestões", "Sugestões"],
      ["mural", "Mural de pedidos"],
      ["perguntas", "Perguntas"],
      ["denúncias", "Autoria e qualidade"],
      ["avaliações", "Avaliações"],
      ["feedback", "Feedback de estudo"],
      ["usabilidade", "Usabilidade"],
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
      ["curadoria", "Calendário e continuidade"],
      ["relatórios", "Relatórios e recuperação"],
      ["alertas", "Alertas"],
      ["operação", "Operação"],
      ["conexoes", "Conexões"],
      ["privacidade", "Privacidade"],
      ["histórico", "Histórico"],
    ],
  },
];
export const authorTabs = [
  "comecar",
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
  "documentos",
  "parcerias",
  "instituicoes",
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
      "comecar",
      "trilhas",
      "catalogo",
      "colecoes",
      "gratuitos",
      "mural",
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
