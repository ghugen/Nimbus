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
      <section className="panel open-library-next">
        <h2>Continue no seu ritmo.</h2>
        <p>
          Os downloads acima não exigem conta. Se quiser guardar materiais na
          biblioteca e salvar planos de estudo, você pode entrar na Nimbus.
        </p>
        <div className="studio-actions">
          <a className="btn secondary" href="/entrar">
            Usar minha conta (opcional)
          </a>
          <a className="text-link" href="/#sofia">
            Conhecer a Sofia
          </a>
        </div>
        <p>
          Esta coleção gratuita continua disponível. Novos materiais poderão ser
          oferecidos separadamente, com preço e condições visíveis.
        </p>
      </section>
      <p className="notice">
        Guias introdutórios de organização acadêmica, produzidos para a Nimbus.
        Uso pessoal e educacional. Os exemplos fictícios estão identificados nos
        PDFs.
      </p>
    </section>
  );
}
