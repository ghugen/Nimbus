import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import { growth } from "@/lib/growth";
import { BrandGlyph } from "@/components/brand-glyph";
import { money, type Product } from "@/lib/catalog";
import type { StoreRuntime } from "@/lib/catalog-services";
export const dynamic = "force-dynamic";
type Collection = {
  slug: string;
  title: string;
  description: string;
  course: string;
  products: Product[];
};
async function get(slug: string) {
  const r = await growth(
    new Request("https://nimbus.local/api/collections"),
    env as unknown as StoreRuntime,
    async () => {
      throw new Error("Não utilizado");
    },
  );
  const d = (await r!.json()) as { collections: Collection[] };
  return d.collections.find((c) => c.slug === slug);
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    c = await get(slug);
  return {
    title: c ? `${c.title} — Coleção Nimbus` : "Coleção | Nimbus",
    description: c?.description,
  };
}
export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    c = await get(slug);
  if (!c) notFound();
  return (
    <>
      <header>
        <div className="container public-header">
          <a className="logo" href="/">
            <BrandGlyph />
            nimbus.
          </a>
          <a className="btn secondary small" href="/#colecoes">
            Todas as coleções
          </a>
        </div>
      </header>
      <main className="container page-section">
        <span className="eyebrow">{c.course}</span>
        <h1>{c.title}.</h1>
        <p className="lead">{c.description}</p>
        <div className="author-public-grid">
          {c.products.map((p) => (
            <a
              className="panel author-product"
              key={p.id}
              href={"/materiais/" + p.id}
            >
              <span className="eyebrow">{p.format}</span>
              <h2>{p.title}</h2>
              <p>{p.description}</p>
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
        {!c.products.length && (
          <div className="panel">
            <h2>A coleção está sendo preparada.</h2>
            <p>
              Os materiais aparecerão aqui após publicação e aprovação. Conte
              quais temas você procura.
            </p>
            <a className="btn primary" href="/#interesses">
              Sugerir um material
            </a>
          </div>
        )}
      </main>
    </>
  );
}
