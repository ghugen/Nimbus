export const areas: Record<string, string[]> = {
  Saúde: [
    "Medicina Veterinária",
    "Medicina",
    "Enfermagem",
    "Odontologia",
    "Farmácia",
    "Nutrição",
    "Fisioterapia",
    "Psicologia",
  ],
  "Ciências Biológicas e Agrárias": [
    "Ciências Biológicas",
    "Agronomia",
    "Zootecnia",
    "Engenharia Florestal",
  ],
  "Direito e Ciências Sociais": [
    "Direito",
    "Relações Internacionais",
    "Ciências Sociais",
    "Serviço Social",
  ],
  "Engenharias e Exatas": [
    "Engenharia",
    "Matemática",
    "Física",
    "Química",
    "Estatística",
  ],
  "Tecnologia e Computação": [
    "Programação",
    "Ciência da Computação",
    "Sistemas de Informação",
    "Ciência de Dados",
  ],
  "Negócios e Gestão": [
    "Administração",
    "Contabilidade",
    "Economia",
    "Marketing",
    "Logística",
  ],
  "Educação e Humanidades": [
    "Pedagogia",
    "Letras",
    "História",
    "Geografia",
    "Filosofia",
  ],
  "Arquitetura, Design e Artes": ["Arquitetura", "Design", "Artes Visuais"],
  "Formação acadêmica geral": ["Formação acadêmica geral"],
};
export const materialTypes = [
  "Resumos e apostilas",
  "Mapas mentais e esquemas",
  "Questões e simulados",
  "Flashcards",
  "Atlas e materiais ilustrados",
  "Guias práticos",
  "Casos para estudo",
  "Modelos e ferramentas",
  "Revisões para provas",
  "Kits e coleções",
  "Cursos e trilhas",
];
export const levels = [
  "Graduação",
  "Ensino técnico",
  "Ensino médio",
  "Pós-graduação",
  "Concursos e residência",
  "Formação continuada",
];
export const languages = ["Português", "Inglês", "Espanhol"];
export const fileTypes = [
  "PDF",
  "TXT",
  "DOCX",
  "XLSX",
  "PPTX",
  "PNG",
  "JPG",
  "ZIP",
  "MP4",
  "MP3",
];
export const subjects: Record<string, string[]> = {
  "Medicina Veterinária": [
    "Anatomia",
    "Patologia",
    "Histologia",
    "Clínica Médica",
    "Toxicologia",
    "Cirurgia",
    "Doenças dos Suínos",
    "Medicina Veterinária Legal",
  ],
  Medicina: ["Anatomia", "Bioquímica", "Fisiologia", "Farmacologia"],
  Direito: ["Direito Constitucional", "Direito Civil", "Direito Penal"],
  Engenharia: ["Cálculo", "Física", "Estatística"],
  Administração: ["Gestão", "Finanças", "Marketing"],
};
export const legacyTypes: Record<string, string> = {
  Resumo: "Resumos e apostilas",
  "Mapa mental": "Mapas mentais e esquemas",
  "Questões comentadas": "Questões e simulados",
  "Guia prático": "Guias práticos",
  Atlas: "Atlas e materiais ilustrados",
};
export function areaOf(course: string) {
  return Object.keys(areas).find((a) => areas[a].includes(course)) || "";
}
export function normalizeProduct<
  T extends {
    category: string;
    format: string;
    file_name?: string | null;
    created: string;
    course?: string;
    level?: string;
    language?: string;
    updated?: string;
    file_format?: string;
  },
>(p: T) {
  const course = p.course || (areaOf(p.category) ? p.category : "");
  return {
    ...p,
    category: areaOf(p.category) || p.category,
    course,
    format: legacyTypes[p.format] || p.format,
    level: p.level || "Graduação",
    language: p.language || "Português",
    updated: p.updated || p.created,
    file_format:
      p.file_format || p.file_name?.split(".").pop()?.toUpperCase() || "PDF",
  };
}
export function topRated(p: {
  rating?: number;
  review_count?: number;
  demo: number;
}) {
  return !p.demo && (p.review_count || 0) >= 3 && (p.rating || 0) >= 4;
}
export function fileMime(name: string) {
  const map: Record<string, string> = {
    PDF: "application/pdf",
    TXT: "text/plain; charset=utf-8",
    DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    PNG: "image/png",
    JPG: "image/jpeg",
    ZIP: "application/zip",
    MP4: "video/mp4",
    MP3: "audio/mpeg",
  };
  return (
    map[name.split(".").pop()?.toUpperCase() || ""] ||
    "application/octet-stream"
  );
}
