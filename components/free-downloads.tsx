import { freeGuides } from "@/lib/free-guides";
export function FreeDownloads() {
  return (
    <section className="container page-section">
      <span className="eyebrow">COLEÇÃO ABERTA NIMBUS</span>
      <h1>Conhecimento para começar.</h1>
      <p className="lead">
        Quatro materiais originais e gratuitos. Cada PDF traz orientações, um
        exemplo e uma folha de atividade. Baixe sem cadastro.
      </p>
      <div className="author-public-grid">
        {freeGuides.map((g, i) => (
          <article className="panel author-product" key={g.id}>
            <span className="eyebrow">
              PDF / 0{i + 1} / {g.pages} PÁGINAS
            </span>
            <h2>{g.title}</h2>
            <p>{g.description}</p>
            <a className="btn primary" href={g.url} download>
              Baixar PDF gratuito ↓
            </a>
            <a className="text-link" href={"/materiais/" + g.id}>
              Conhecer o material
            </a>
          </article>
        ))}
      </div>
      <p className="notice">
        Materiais demonstrativos de organização acadêmica, produzidos para a
        Nimbus. Uso pessoal e educacional. Os exemplos fictícios estão
        identificados nos PDFs.
      </p>
    </section>
  );
}
