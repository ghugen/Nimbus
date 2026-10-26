import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import { publicProducts, type StoreRuntime } from "@/lib/catalog-services";
import { disciplineSlug } from "@/lib/discipline";
import { money } from "@/lib/catalog";
import { BrandGlyph } from "@/components/brand-glyph";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const products = await publicProducts(env as unknown as StoreRuntime);
  const p = products.find((p) => disciplineSlug(p.subject) === slug);
  return {
    title: p ? `${p.subject} — Materiais | Nimbus` : "Disciplina | Nimbus",
    description: p
      ? `Explore materiais de ${p.subject} por assunto, nível e formato.`
      : undefined,
  };
}
export default async function DisciplinePage({ params }: Props) {
  const { slug } = await params;
  const products = (
    await publicProducts(env as unknown as StoreRuntime)
  ).filter((p) => disciplineSlug(p.subject) === slug);
  if (!products.length) notFound();
  const subjects = [...new Set(products.map((p) => p.topic).filter(Boolean))];
  return (
    <>
      <header>
        <div className="container public-header">
          <a className="logo" href="/">
            <BrandGlyph />
            nimbus.
          </a>
          <a className="btn secondary small" href="/#catalogo">
            Catálogo completo
          </a>
        </div>
      </header>
      <main className="container page-section">
        <span className="eyebrow">ESTUDE POR DISCIPLINA</span>
        <h1>{products[0].subject}.</h1>
        <p className="lead">
          Compare o recorte, os conhecimentos prévios e as amostras de cada
          material antes de escolher.
        </p>
        {subjects.length > 0 && (
          <p>Assuntos disponíveis: {subjects.join(" · ")}</p>
        )}
        <div className="author-public-grid">
          {products.map((p) => (
            <a
              className="panel author-product"
              href={"/materiais/" + p.id}
              key={p.id}
            >
              <span className="eyebrow">
                {p.course} · {p.level}
              </span>
              <h2>{p.title}</h2>
              <p>{p.topic || p.description}</p>
              <p>
                {p.format} · {p.pages} páginas · {p.author}
              </p>
              <strong>
                {p.demo && p.price > 0
                  ? "Demonstrativo · compra indisponível"
                  : p.price
                    ? money(p.price)
                    : "Grátis"}
              </strong>
              <span className="text-link">Conhecer material ↗</span>
            </a>
          ))}
        </div>
        <div className="panel">
          <h2>Faltou o assunto que você procura?</h2>
          <p>As sugestões ajudam a orientar as próximas publicações.</p>
          <a href="/#interesses" className="btn secondary">
            Sugerir material
          </a>
        </div>
      </main>
    </>
  );
}
