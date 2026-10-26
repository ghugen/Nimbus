export const reviewChecks = [
  ["content", "Conteúdo, objetivos e explicações"],
  ["sources", "Referências e citações"],
  ["legibility", "Legibilidade e organização"],
  ["examples", "Exemplos e aplicações"],
  ["answers", "Gabaritos e justificativas"],
  ["rights", "Autoria e autorização declaradas"],
];
export const editorialCriteria: Record<string, string[]> = {
  "Resumos e apostilas": [
    "Objetivos e escopo definidos",
    "Conceitos explicados com fontes",
    "Estrutura e sumário coerentes",
  ],
  "Mapas mentais e esquemas": [
    "Conexões conceituais identificadas",
    "Legendas e hierarquia legíveis",
    "Fontes e autoria das imagens",
  ],
  "Questões e simulados": [
    "Enunciados originais e claros",
    "Gabarito e justificativas conferidos",
    "Adequação ao nível anunciado",
  ],
  Flashcards: [
    "Perguntas objetivas",
    "Respostas verificáveis",
    "Uma unidade de aprendizagem por cartão",
  ],
  "Atlas e materiais ilustrados": [
    "Imagens próprias ou licenciadas",
    "Legendas e identificação conferidas",
    "Qualidade e escala adequadas",
  ],
  "Cursos e trilhas": [
    "Sequência de aulas e objetivos",
    "Atividades e gabaritos conferidos",
    "Vídeos e materiais autorizados",
  ],
  default: [
    "Público e escopo claros",
    "Fontes identificadas",
    "Arquivo íntegro e amostra representativa",
    "Ausência de dados pessoais desnecessários",
  ],
};
