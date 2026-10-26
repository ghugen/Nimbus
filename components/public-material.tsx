"use client";
import { disciplineSlug } from "@/lib/discipline";
import { PreviewGallery } from "./preview-gallery";
import {
  ProductInformation,
  RelatedMaterials,
  FollowAuthor,
} from "./product-information";
import { useEffect, useState } from "react";
import { BrandGlyph } from "./brand-glyph";
import { MeasurementPreferences } from "./measurement-preferences";
import { metric } from "@/lib/client-auth";
import { money, type Product } from "@/lib/catalog";
export function PublicMaterial({ product: p }: { product: Product }) {
  const [error, setError] = useState("");
  useEffect(() => {
    metric(p.id, "view");
  }, [p.id]);
  function add() {
    try {
      const raw = JSON.parse(localStorage.getItem("nimbus-cart-v1") || "[]");
      const ids = Array.isArray(raw)
        ? raw.filter((x) => typeof x === "string")
        : [];
      localStorage.setItem(
        "nimbus-cart-v1",
        JSON.stringify([...new Set([...ids, p.id])].slice(0, 30)),
      );
      metric(p.id, "cart");
      location.href = "/#carrinho";
    } catch {
      setError("Não foi possível salvar o carrinho neste navegador.");
    }
  }
  const kit = JSON.parse(p.bundle_ids || "[]") as string[];
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
          <a className="text-link" href="/entrar">
            Minha conta
          </a>
        </div>
      </header>
      <main className="container page-section public-material">
        <nav className="breadcrumb">
          <a href="/#catalogo">Catálogo</a> / {p.course} / {p.subject}
        </nav>
        <div className="public-product-grid">
          <div>
            {p.has_cover ? (
              <img
                className="public-cover"
                src={"/api/asset/" + p.id + "/cover"}
                alt={"Capa de " + p.title}
              />
            ) : (
              <div className="public-cover fallback-cover">
                <BrandGlyph size={60} />
                <span>{p.format}</span>
                <strong>{p.title}</strong>
                <small>{p.author}</small>
              </div>
            )}
          </div>
          <div>
            <span className="eyebrow">
              {p.category} · {p.format}
            </span>
            <h1>{p.title}</h1>
            <p className="lead">{p.description}</p>
            <p>
              {p.author_slug ? (
                <a className="text-link" href={"/autores/" + p.author_slug}>
                  {p.author}
                </a>
              ) : (
                p.author
              )}
            </p>
            <p className="muted">
              {p.pages} páginas · {p.level} · {p.language}
              {p.file_format ? " · " + p.file_format.toUpperCase() : ""}
            </p>
            {p.reviewed_by && (
              <p className="notice">
                Revisado por {p.reviewed_by} ·{" "}
                {new Date(p.reviewed_at || "").toLocaleDateString("pt-BR")}
              </p>
            )}
            {p.public_download && (
              <a className="btn secondary" href={p.public_download} download>
                Baixar PDF gratuito · sem cadastro
              </a>
            )}
            <strong className="detail-price">
              {p.price ? money(p.price) : "Grátis"}
            </strong>
            {p.demo === 1 && p.price > 0 ? (
              <p className="notice">
                Material demonstrativo. A compra ainda não está disponível.
              </p>
            ) : (
              <button className="btn primary" onClick={add}>
                {p.price ? "Adicionar ao carrinho" : "Obter material gratuito"}
              </button>
            )}
            {error && <p className="error">{error}</p>}
            <p className="muted">
              Acesso na biblioteca após a confirmação do pedido. Atualizações
              publicadas pelo autor ficam disponíveis para quem já comprou.
            </p>
          </div>
        </div>
        <div className="public-content-grid">
          <section className="panel">
            <h2>Conheça o conteúdo.</h2>
            {p.objectives && (
              <>
                <h3>O que você vai aprender</h3>
                <p className="pre-line">{p.objectives}</p>
              </>
            )}
            {p.toc && (
              <>
                <h3>Sumário</h3>
                <p className="pre-line">{p.toc}</p>
              </>
            )}
            <h3>Trecho de amostra</h3>
            <pre className="free-reader">{p.preview}</pre>
            <PreviewGallery
              id={p.id}
              count={p.preview_count || 0}
              title={p.title}
            />
            {p.sources && (
              <>
                <h3>Referências e fontes</h3>
                <p className="pre-line">{p.sources}</p>
              </>
            )}
          </section>
          <aside>
            <section className="panel">
              <h3>Sobre o material</h3>
              <p>
                {p.course} · {p.subject}
                {p.topic ? " · " + p.topic : ""}
              </p>
              <p>
                Materiais de apoio à aprendizagem. Confira a adequação ao seu
                plano de ensino.
              </p>
              {kit.length > 0 && (
                <>
                  <h3>Este kit inclui</h3>
                  {kit.map((id) => (
                    <p key={id}>
                      <a className="text-link" href={"/materiais/" + id}>
                        Ver material do kit ↗
                      </a>
                    </p>
                  ))}
                  <p>
                    Os arquivos são entregues individualmente na sua biblioteca.
                  </p>
                </>
              )}
              <a className="text-link" href="/#suporte">
                Precisa de ajuda?
              </a>
            </section>
          </aside>
        </div>
      </main>
      <div className="container">
        <a
          className="text-link"
          href={"/disciplinas/" + disciplineSlug(p.subject)}
        >
          Mais materiais de {p.subject} ↗
        </a>
        <ProductInformation product={p} />
        {p.author_slug && <FollowAuthor slug={p.author_slug} />}
        <RelatedMaterials productId={p.id} />
      </div>
      <MeasurementPreferences />
      <footer className="container public-footer">
        <a href="/#privacidade">Privacidade</a>
        <a href="/#termos">Termos de uso</a>
        <a href="/brand/index.html">Identidade Nimbus</a>
      </footer>
    </>
  );
}
