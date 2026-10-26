import guides from "../scripts/content/demo-guides.json";
export const demoCards = [
  {
    id: "plan",
    front: "Como transformar “ler um capítulo” em uma tarefa verificável?",
    back: "Defina um produto observável, como explicar duas ideias do capítulo e registrar uma dúvida com sua localização.",
    page: 2,
  },
  {
    id: "source",
    front: "Qual a diferença entre paráfrase e comentário pessoal?",
    back: "A paráfrase reformula uma ideia atribuída à fonte; o comentário registra sua interpretação e deve ser identificado como tal.",
    page: 2,
  },
  {
    id: "cause",
    front: "Uma diferença entre grupos prova, sozinha, uma relação de causa?",
    back: "Não. É preciso conferir o desenho, os procedimentos, a comparabilidade e as explicações alternativas.",
    page: 2,
  },
  {
    id: "feedback",
    front:
      "O que fazer quando a resposta parece correta, mas você não consegue justificá-la?",
    back: "Registre a lacuna, consulte a fonte indicada e tente explicar novamente sem copiar.",
    page: 2,
  },
  {
    id: "scope",
    front: "Como tratar uma pergunta que exige reproduzir uma página inteira?",
    back: "Divida a tarefa em unidades menores ou utilize uma questão discursiva separada.",
    page: 1,
  },
];
export const demoQuestions = [
  {
    id: "q1",
    prompt: "Qual tarefa permite conferir o que você aprendeu?",
    options: [
      "Ler por tempo indeterminado",
      "Explicar duas ideias e registrar uma dúvida localizada",
      "Ressaltar todas as frases",
    ],
    correct: 1,
    explanation:
      "A tarefa define um produto observável e uma dúvida que pode ser retomada.",
    page: 2,
  },
  {
    id: "q2",
    prompt: "Uma resposta parece familiar. Qual é o próximo passo indicado?",
    options: [
      "Marcar acerto imediatamente",
      "Conferir a resposta e identificar o que faltou",
      "Excluir a pergunta",
    ],
    correct: 1,
    explanation:
      "Familiaridade não substitui a conferência. O guia orienta registrar o feedback e a fonte.",
    page: 1,
  },
  {
    id: "q3",
    prompt: "Como registrar um comentário pessoal no fichamento?",
    options: [
      "Como se fosse uma fala do autor",
      "Sem indicar que é uma interpretação",
      "Identificando-o como interpretação do estudante",
    ],
    correct: 2,
    explanation:
      "O comentário pessoal é diferente da paráfrase atribuída à fonte.",
    page: 2,
  },
];
export function guidePages(id: string) {
  const guide = guides.find((g) => g.id === id);
  if (!guide) return [];
  return guide.pages.map((p, i) => ({
    page: i + 1,
    text: [
      p.title,
      p.intro,
      ...("sections" in p && p.sections ? p.sections.flat() : []),
      ...("worksheet" in p && p.worksheet ? p.worksheet : []),
    ].join("\n"),
  }));
}
