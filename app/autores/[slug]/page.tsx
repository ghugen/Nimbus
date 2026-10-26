import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import { publicProducts, type StoreRuntime } from "@/lib/catalog-services";
import { money } from "@/lib/catalog";
import { BrandGlyph } from "@/components/brand-glyph";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
type Author = {
  id: string;
  author_slug: string;
  public_name: string;
  bio: string;
  credentials: string;
  profile_public: number;
  verified_label?: string;
  verified_at?: string;
};
async function lookup(slug: string) {
  const runtime = env as unknown as StoreRuntime;
  const author = await runtime.DB.prepare(
    "SELECT u.id,u.author_slug,u.public_name,u.bio,u.credentials,u.profile_public,CASE WHEN v.status='verified' THEN v.label ELSE '' END verified_label,v.updated verified_at FROM users u LEFT JOIN profile_verifications v ON v.user_id=u.id WHERE u.author_slug=?",
  )
    .bind(slug)
    .first<Author>();
  const products = author
    ? (await publicProducts(runtime)).filter((p) => p.author_id === author.id)
    : [];
  return { author, products };
}
export async function generateMetadata({ params }: Props) {
  const { slug } = await params,
    { author, products } = await lookup(slug);
  const name = author?.profile_public
    ? author.public_name
    : products[0]?.author;
  return {
    title: name ? `${name} — materiais acadêmicos | Nimbus` : "Autor | Nimbus",
    description: `Conheça os materiais acadêmicos ${name ? "de " + name : "na Nimbus"}.`,
  };
}
export default async function AuthorPage({ params }: Props) {
  const { slug } = await params,
    { author: a, products } = await lookup(slug);
  if (!a || (!a.profile_public && !products.length)) notFound();
  return (
    <>
      <header>
        <div className="container public-header">
          <a className="logo" href="/">
            <BrandGlyph />
            nimbus.
          </a>
          <a className="btn secondary small" href="/#catalogo">
            Explorar materiais
          </a>
        </div>
      </header>
      <main className="container page-section">
        <span className="eyebrow">QUEM COMPARTILHA CONHECIMENTO</span>
        <h1>{a.profile_public ? a.public_name : products[0]?.author}</h1>
        {a.profile_public && (
          <div className="author-profile-copy">
            <p className="lead pre-line">{a.bio}</p>
            {a.credentials && (
              <>
                <h2>Formação e experiência</h2>
                <p className="pre-line">{a.credentials}</p>
                <small className="muted">
                  Informações declaradas pelo autor.
                </small>
              </>
            )}
          </div>
        )}
        {a.verified_label && (
          <div className="notice">
            <strong>Verificação administrativa</strong>
            <p>{a.verified_label}</p>
            <small>
              A verificação se limita ao que está descrito acima; não representa
              validação de todo o conteúdo publicado.
            </small>
          </div>
        )}
        <h2>Materiais publicados.</h2>
        <div className="author-public-grid">
          {products.map((p) => (
            <a
              className="panel author-product"
              key={p.id}
              href={"/materiais/" + p.id}
            >
              {p.cover_key && (
                <img
                  loading="lazy"
                  decoding="async"
                  className="author-product-cover"
                  src={"/api/asset/" + p.id + "/cover"}
                  alt={"Capa de " + p.title}
                />
              )}
              <span className="eyebrow">{p.format}</span>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              <strong>{p.price ? money(p.price) : "Grátis"}</strong>
              <span className="text-link"> Conhecer material ↗</span>
            </a>
          ))}
        </div>
        {!products.length && (
          <p className="notice">Este autor ainda não publicou materiais.</p>
        )}
      </main>
    </>
  );
}
