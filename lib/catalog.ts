import { areas, materialTypes, normalizeProduct } from "./taxonomy";
export const categories = ["Todas as áreas", ...Object.keys(areas)];
export const formats = materialTypes;
export type Product = {
  id: string;
  author_id: string;
  owned?: number;
  accepted_bps?: number | null;
  accepted_owned?: number | null;
  title: string;
  description: string;
  category: string;
  subject: string;
  format: string;
  price: number;
  pages: number;
  author: string;
  preview: string;
  status: string;
  file_key: string | null;
  file_name: string | null;
  demo: number;
  created: string;
  topic?: string;
  course?: string;
  level?: string;
  language?: string;
  updated?: string;
  file_format?: string;
  rating?: number;
  review_count?: number;
};
const items = [
  [
    "patologia-geral",
    "Patologia geral: o começo de tudo",
    "Lesão celular, adaptações e inflamação em uma revisão organizada para conectar conceitos.",
    "Medicina Veterinária",
    "Patologia",
    "Resumo",
    2490,
    28,
    "violet",
  ],
  [
    "anatomia",
    "Anatomia em conexões",
    "Uma visão organizada dos sistemas para orientar sua revisão de anatomia.",
    "Medicina Veterinária",
    "Anatomia",
    "Mapa mental",
    1990,
    16,
    "peach",
  ],
  [
    "constitucional",
    "Constitucional, sem complicar",
    "Princípios fundamentais e organização do Estado para estruturar os estudos.",
    "Direito",
    "Direito Constitucional",
    "Resumo",
    2990,
    36,
    "blue",
  ],
  [
    "bioquimica",
    "Bioquímica: conecte as vias",
    "Um roteiro para revisar metabolismo e reconhecer relações entre as principais vias.",
    "Medicina",
    "Bioquímica",
    "Guia prático",
    2290,
    24,
    "green",
  ],
  [
    "calculo",
    "Cálculo I: do conceito à prática",
    "Limites e derivadas organizados em uma sequência de revisão.",
    "Engenharia",
    "Cálculo",
    "Questões comentadas",
    3490,
    42,
    "yellow",
  ],
  [
    "gestao",
    "Fundamentos de gestão",
    "Um roteiro visual de planejamento, organização, direção e controle.",
    "Administração",
    "Gestão",
    "Flashcards",
    1490,
    20,
    "pink",
  ],
  [
    "metodo",
    "Estudar com intenção",
    "Guia gratuito e original para organizar sessões de estudo, revisão e prática.",
    "Ciências Biológicas",
    "Métodos de estudo",
    "Guia prático",
    0,
    1,
    "violet",
  ],
  [
    "histologia",
    "Histologia: aprenda a observar",
    "Guia introdutório de observação de lâminas e descrição de estruturas.",
    "Medicina Veterinária",
    "Histologia",
    "Atlas",
    2790,
    32,
    "green",
  ],
];
export const seed: Product[] = items.map(
  ([id, title, description, category, subject, format, price, pages]) =>
    normalizeProduct({
      id: String(id),
      title: String(title),
      description: String(description),
      category: id === "metodo" ? "Formação acadêmica geral" : String(category),
      course: id === "metodo" ? "Formação acadêmica geral" : String(category),
      subject: String(subject),
      format: String(format),
      price: Number(price),
      pages: Number(pages),
      author: "Equipe Nimbus · demonstração",
      author_id: "nimbus",
      preview:
        id === "metodo"
          ? `ESTUDAR COM INTENÇÃO\n\nUm guia introdutório da Nimbus\n\n1. Defina um objetivo observável\nAntes de começar, escreva o que deseja conseguir explicar ou resolver ao final da sessão. Divida um tema amplo em perguntas menores.\n\n2. Tente recordar antes de consultar\nApós a leitura, feche o material e escreva o que lembra. Compare sua resposta com a fonte e marque as lacunas.\n\n3. Distribua a revisão\nReserve novas sessões para retomar o assunto. Ajuste o intervalo conforme sua dificuldade, em vez de repetir apenas o que já domina.\n\n4. Pratique com feedback\nResolva uma questão, explique sua escolha e confira o raciocínio. Transforme erros em perguntas para a próxima revisão.\n\nPLANO DE SESSÃO\nObjetivo: ______\nPerguntas principais: ______\nO que consegui explicar: ______\nO que preciso retomar: ______\nPróxima revisão: ______\n\nEste guia é um material demonstrativo original de organização de estudos; não representa garantia de desempenho.`
          : `${title}\n\n${description}\n\nPRÉVIA DE DEMONSTRAÇÃO\nEste item ilustra a organização do catálogo Nimbus. O material comercial completo ainda não está disponível. O número de páginas e o preço são ilustrativos.\n\nO que um material publicado deverá apresentar:\n• Objetivos de aprendizagem\n• Conceitos explicados com clareza\n• Exemplos e aplicações\n• Perguntas para revisão\n• Referências e data de atualização\n\nNenhuma avaliação ou credencial profissional foi atribuída a este conteúdo.`,
      status: "published",
      file_key: null,
      file_name: null,
      file_format: id === "metodo" ? "TXT" : "PDF",
      demo: 1,
      created: "2026-10-25T00:00:00.000Z",
    }),
);
export function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}
