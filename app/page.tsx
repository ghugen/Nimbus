"use client";
import { PrivacyCenter } from "@/components/privacy-center";
import { FinancePanel, EarningsPreview } from "@/components/finance-panel";
import type {
  FinanceReport,
  FinanceAccount,
  AuthorPolicy,
} from "@/lib/finance-types";
import {
  areas,
  levels,
  languages,
  fileTypes,
  subjects,
  topRated,
} from "@/lib/taxonomy";

import { useState, useEffect, useMemo, type FormEvent } from "react";
import {
  Search,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  ShoppingBag,
  Heart,
  X,
  Check,
  ChevronDown,
  Cloud,
  GraduationCap,
  Stethoscope,
  Scale,
  Calculator,
  Briefcase,
  Leaf,
  ShieldCheck,
  Download,
  FileText,
  LayoutGrid,
  SlidersHorizontal,
  Plus,
  Star,
  Menu,
  LogOut,
  UserRound,
  Upload,
  Clock,
  CheckCircle2,
  MessageCircle,
  ChevronRight,
  Library,
  PenLine,
  Settings,
  BarChart3,
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  Sparkles,
  Layers,
  Bookmark,
} from "lucide-react";
import { categories, formats, money, type Product } from "@/lib/catalog";
type User = {
  id: string;
  email: string;
  name: string;
  course: string;
  institution: string;
  created: string;
  admin: boolean;
};
type LibraryItem = {
  product_id: string;
  title: string;
  created: string;
  order_id: string;
  file_name?: string;
  notes?: string;
  progress?: number;
};
type Order = {
  id: string;
  status: string;
  total: number;
  created: string;
  items: { title: string; price: number }[];
  name?: string;
  email?: string;
};
type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  response: string;
  created: string;
  email?: string;
};
type Review = {
  rating: number;
  comment: string;
  name: string;
  created: string;
};
type AuthorData = {
  policy?: AuthorPolicy;
  finance?: FinanceReport;
  products: Product[];
  sales: { product_id: string; price: number; created: string }[];
};
type AdminData = {
  products: Product[];
  users: User[];
  orders: Order[];
  tickets: Ticket[];
  audit: { id: string; action: string; target: string; created: string }[];
};
const date = (v: string) => new Date(v).toLocaleDateString("pt-BR");
const icons = [Layers, Stethoscope, Heart, Scale, Calculator, Briefcase, Leaf];
const initials = (name: string) =>
  (name || "N")
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
type ApiResponse = {
  error: string;
  products: Product[];
  payments: boolean;
  user: User | null;
  favorites: string[];
  items: LibraryItem[];
  orders: Order[];
  tickets: Ticket[];
  sales: AuthorData["sales"];
  users: User[];
  audit: AdminData["audit"];
  reviews: Review[];
  url?: string;
  id: string;
  policy: AuthorPolicy;
  finance: FinanceReport;
  accounts: FinanceAccount[];
};
async function api(path: string, data?: unknown) {
  const r = await fetch(
    "/api/" + path,
    data
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      : undefined,
  );
  const result = (await r.json()) as ApiResponse;
  if (!r.ok) throw new Error(result.error || "Não foi possível concluir.");
  return result;
}
const emptyForm = {
  id: "",
  title: "",
  description: "",
  category: "Saúde",
  course: "Medicina Veterinária",
  level: "Graduação",
  language: "Português",
  subject: "",
  topic: "",
  format: "Resumos e apostilas",
  price: "",
  pages: "",
  preview: "",
  rights: false,
  commercial_accepted: false,
};
export default function Nimbus() {
  const [view, setView] = useState("inicio"),
    [products, setProducts] = useState<Product[]>([]),
    [user, setUser] = useState<User | null>(null),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState(categories[0]),
    [format, setFormat] = useState("Todos"),
    [sort, setSort] = useState("relevancia"),
    [free, setFree] = useState(false),
    [course, setCourse] = useState("Todos"),
    [subject, setSubject] = useState(""),
    [topic, setTopic] = useState(""),
    [level, setLevel] = useState("Todos"),
    [language, setLanguage] = useState("Todos"),
    [fileType, setFileType] = useState("Todos"),
    [minPrice, setMinPrice] = useState(""),
    [maxPrice, setMaxPrice] = useState(""),
    [updatedAfter, setUpdatedAfter] = useState(""),
    [showcase, setShowcase] = useState("todos"),
    [favorites, setFavorites] = useState<string[]>([]),
    [cart, setCart] = useState<string[]>([]),
    [detail, setDetail] = useState<Product | null>(null),
    [reviews, setReviews] = useState<Review[]>([]),
    [library, setLibrary] = useState<LibraryItem[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [tickets, setTickets] = useState<Ticket[]>([]),
    [author, setAuthor] = useState<AuthorData>({ products: [], sales: [] }),
    [admin, setAdmin] = useState<AdminData | null>(null),
    [form, setForm] = useState(emptyForm),
    [reader, setReader] = useState<LibraryItem | null>(null),
    [notes, setNotes] = useState(""),
    [progress, setProgress] = useState(0),
    [accepted, setAccepted] = useState(false),
    [mobile, setMobile] = useState(false),
    [adminTab, setAdminTab] = useState("produtos"),
    [financeData, setFinanceData] = useState<{
      finance: FinanceReport;
      accounts: FinanceAccount[];
    } | null>(null),
    [rating, setRating] = useState(5),
    [comment, setComment] = useState(""),
    [payments, setPayments] = useState(false);
  function go(next: string) {
    window.location.hash = next;
    setView(next);
    setMobile(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function notify(s: string) {
    setToast(s);
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadCatalog() {
    const d = await api("catalog");
    setProducts(d.products);
    setPayments(d.payments);
  }
  async function refresh() {
    const [, d] = await Promise.all([loadCatalog(), api("me")]);
    setUser(d.user);
    setFavorites(d.favorites || []);
  }
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    const change = () => {
      setView(window.location.hash.slice(1) || "inicio");
      setMobile(false);
    };
    change();
    window.addEventListener("hashchange", change);
    try {
      {
        const saved: unknown = JSON.parse(
          localStorage.getItem("nimbus-cart-v1") || "[]",
        );
        if (Array.isArray(saved))
          setCart(
            saved.filter((v: unknown) => typeof v === "string").slice(0, 30),
          );
      }
    } catch {}
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem("nimbus-cart-v1", JSON.stringify(cart));
  }, [cart, loaded]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!user) return;
    action(async () => {
      if (view === "biblioteca") {
        setLibrary((await api("library")).items);
        setOrders((await api("orders")).orders);
      }
      if (view === "pedidos") setOrders((await api("orders")).orders);
      if (view === "suporte") setTickets((await api("tickets")).tickets);
      if (view === "autores") setAuthor(await api("author"));
      if (view === "admin" && user.admin) setAdmin(await api("admin"));
    });
  }, [view, user?.id]);
  useEffect(() => {
    if (!detail) return;
    setReviews([]);
    api("reviews?id=" + encodeURIComponent(detail.id))
      .then((d) => setReviews(d.reviews))
      .catch(() => {});
    setComment("");
    setRating(5);
  }, [detail?.id]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("payment") === "success")
      notify(
        "Pagamento recebido pelo checkout. A biblioteca será liberada após confirmação. Atualize em instantes.",
      );
    if (params.get("payment") === "cancelled")
      notify("Compra não concluída. Seu carrinho foi mantido.");
  }, []);
  useEffect(() => {
    if (!detail && !reader) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDetail(null);
        setReader(null);
      }
    };
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector(".modal") as HTMLElement | null;
    const backgrounds = Array.from(
      document.querySelectorAll(
        "header,main,footer,.announcement,.account-nav",
      ),
    ) as HTMLElement[];
    backgrounds.forEach((el) => (el.inert = true));
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modal) return;
      const nodes = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input:not([disabled]),select,textarea,[tabindex="0"]',
        ),
      ).filter((el) => el.offsetParent !== null);
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = old;
      backgrounds.forEach((el) => (el.inert = false));
      document.removeEventListener("keydown", key);
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [detail, reader]);
  const visible = useMemo(
    () =>
      products
        .filter(
          (p) =>
            (category === categories[0] || p.category === category) &&
            (format === "Todos" || p.format === format) &&
            (course === "Todos" || p.course === course) &&
            (!topic ||
              (p.topic || "").toLowerCase().includes(topic.toLowerCase())) &&
            (!subject ||
              p.subject.toLowerCase().includes(subject.toLowerCase())) &&
            (level === "Todos" || p.level === level) &&
            (language === "Todos" || p.language === language) &&
            (fileType === "Todos" || p.file_format === fileType) &&
            (!minPrice || p.price >= Number(minPrice) * 100) &&
            (!maxPrice || p.price <= Number(maxPrice) * 100) &&
            (!updatedAfter ||
              (p.updated || p.created).slice(0, 10) >= updatedAfter) &&
            (showcase !== "avaliados" || topRated(p)) &&
            (showcase !== "proprios" || (!p.demo && p.owned === 1)) &&
            (showcase !== "parceiros" || (!p.demo && !p.owned)) &&
            (!free || p.price === 0) &&
            (view !== "favoritos" || favorites.includes(p.id)) &&
            `${p.title} ${p.subject} ${p.author} ${p.category} ${p.course} ${p.topic || ""}`
              .toLocaleLowerCase("pt-BR")
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .includes(
                query
                  .toLocaleLowerCase("pt-BR")
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, ""),
              ),
        )
        .sort((a, b) =>
          showcase === "avaliados"
            ? (b.rating || 0) - (a.rating || 0) ||
              (b.review_count || 0) - (a.review_count || 0)
            : sort === "menor"
              ? a.price - b.price
              : sort === "maior"
                ? b.price - a.price
                : sort === "recentes"
                  ? (b.updated || b.created).localeCompare(
                      a.updated || a.created,
                    )
                  : 0,
        ),
    [
      products,
      category,
      format,
      free,
      query,
      sort,
      view,
      favorites,
      course,
      subject,
      topic,
      level,
      language,
      fileType,
      minPrice,
      maxPrice,
      updatedAfter,
      showcase,
    ],
  );
  const cartItems = cart
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean) as Product[];
  function add(p: Product) {
    if (cart.includes(p.id)) {
      go("carrinho");
      setDetail(null);
      return;
    }
    setCart([...cart, p.id]);
    notify("Material adicionado ao carrinho.");
  }
  function favorite(p: Product) {
    if (!user) {
      notify("Entre na sua conta para salvar favoritos.");
      return;
    }
    action(async () => {
      const active = !favorites.includes(p.id);
      await api("favorites", { id: p.id, active });
      setFavorites(
        active ? [...favorites, p.id] : favorites.filter((id) => id !== p.id),
      );
    });
  }
  function openReader(item: LibraryItem) {
    setReader(item);
    setNotes(item.notes || "");
    setProgress(item.progress || 0);
  }
  const signedOut = (title: string) => (
    <div className="auth-card">
      <div className="round-icon">
        <Lock size={26} />
      </div>
      <h2>{title}</h2>
      <p>
        Entre com sua conta para encontrar seus materiais, acompanhar pedidos e
        continuar estudando.
      </p>
      <a
        className="btn primary"
        href={
          "/signin-with-chatgpt?return_to=" + encodeURIComponent("/#" + view)
        }
        target="_top"
      >
        Entrar com ChatGPT <ArrowUpRight size={17} />
      </a>
      <small>
        Seu acesso é protegido. Não solicitamos sua senha do ChatGPT.
      </small>
    </div>
  );
  function renderCard(p: Product, index = 0) {
    return (
      <article className="product-card" key={p.id}>
        <button
          className="cover-link"
          onClick={() => setDetail(p)}
          aria-label={"Ver " + p.title}
        >
          <Cover p={p} index={index} />
        </button>
        <button
          className={"favorite " + (favorites.includes(p.id) ? "active" : "")}
          aria-label={
            favorites.includes(p.id)
              ? "Remover dos favoritos"
              : "Salvar nos favoritos"
          }
          onClick={() => favorite(p)}
        >
          <Heart
            size={17}
            fill={favorites.includes(p.id) ? "currentColor" : "none"}
          />
        </button>
        <div className="product-body">
          <div className="product-meta">
            {!p.demo && (
              <span>
                {p.owned ? "Acervo do Professor Gustavo" : "Autor parceiro"}
              </span>
            )}
            <span>{p.format}</span>
            {p.demo === 1 && (
              <span className="demo">
                {p.price === 0 ? "Amostra gratuita" : "Demonstração"}
              </span>
            )}
          </div>
          <button className="title-button" onClick={() => setDetail(p)}>
            <h3>{p.title}</h3>
          </button>
          <p className="author-line">{p.author}</p>
          <div className="product-info">
            <span>
              <FileText size={13} />
              {p.pages} pág.{p.demo === 1 && p.price > 0 ? " ilustrativas" : ""}
            </span>
            <span>
              {p.review_count ? (
                <>
                  <Star size={13} fill="currentColor" />
                  {Number(p.rating).toFixed(1)} ({p.review_count})
                </>
              ) : (
                "Sem avaliações"
              )}
            </span>
          </div>
          <div className="card-bottom">
            <div>
              <small>
                {p.price === 0 ? "Para começar" : "Material digital"}
              </small>
              <strong>{p.price === 0 ? "Grátis" : money(p.price)}</strong>
            </div>
            <button
              className="card-arrow"
              aria-label={"Conhecer " + p.title}
              onClick={() => setDetail(p)}
            >
              <ArrowUpRight size={21} />
            </button>
          </div>
        </div>
      </article>
    );
  }
  return (
    <>
      <div className="announcement">
        <span>
          <Sparkles size={13} /> Um novo espaço para suas próximas descobertas.
        </span>
        <button
          onClick={() => {
            setFree(true);
            go("catalogo");
          }}
        >
          Conheça o guia gratuito <ArrowRight size={13} />
        </button>
      </div>
      <header>
        <div className="header-inner">
          <a className="logo" href="#inicio" aria-label="Nimbus início">
            <span className="logo-mark">
              <Cloud size={23} />
            </span>
            nimbus<span className="logo-dot">.</span>
          </a>
          <nav
            className={mobile ? "mobile-open" : ""}
            aria-label="Navegação principal"
          >
            <button
              className={view === "inicio" ? "selected" : ""}
              onClick={() => go("inicio")}
            >
              Início
            </button>
            <button
              className={view === "catalogo" ? "selected" : ""}
              onClick={() => go("catalogo")}
            >
              Explorar materiais
            </button>
            <button
              className={view === "autores" ? "selected" : ""}
              onClick={() => go("autores")}
            >
              Para autores <ArrowUpRight size={12} />
            </button>
          </nav>
          <div className="header-actions">
            <button
              className="icon-btn favorites-nav"
              aria-label="Favoritos"
              onClick={() => go("favoritos")}
            >
              <Heart size={20} />
            </button>
            <button
              className="icon-btn cart-nav"
              aria-label={"Carrinho com " + cart.length + " materiais"}
              onClick={() => go("carrinho")}
            >
              <ShoppingBag size={20} />
              {cart.length > 0 && <span>{cart.length}</span>}
            </button>
            {user ? (
              <button className="account" onClick={() => go("biblioteca")}>
                <span className="avatar">{initials(user.name)}</span>
                <span>Minha biblioteca</span>
              </button>
            ) : (
              <a
                className="btn primary small"
                href="/signin-with-chatgpt?return_to=%2F%23biblioteca"
                target="_top"
              >
                Entrar <ArrowUpRight size={15} />
              </a>
            )}
            <button
              className="icon-btn hamburger"
              aria-label="Abrir menu"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </button>
          </div>
        </div>
      </header>
      {user && view !== "inicio" && (
        <div className="account-nav">
          <div className="container">
            <button
              onClick={() => go("biblioteca")}
              className={view === "biblioteca" ? "active" : ""}
            >
              <Library size={15} /> Biblioteca
            </button>
            <button
              onClick={() => go("favoritos")}
              className={view === "favoritos" ? "active" : ""}
            >
              <Heart size={15} /> Favoritos
            </button>
            <button
              onClick={() => go("pedidos")}
              className={view === "pedidos" ? "active" : ""}
            >
              <ShoppingBag size={15} /> Pedidos
            </button>
            <button
              onClick={() => go("perfil")}
              className={view === "perfil" ? "active" : ""}
            >
              <UserRound size={15} /> Meu perfil
            </button>
            <button
              onClick={() => go("suporte")}
              className={view === "suporte" ? "active" : ""}
            >
              <MessageCircle size={15} /> Suporte
            </button>
            {user.admin && (
              <button
                onClick={() => go("admin")}
                className={view === "admin" ? "active" : ""}
              >
                <Settings size={15} /> Administração
              </button>
            )}
          </div>
        </div>
      )}
      <main>
        {error && (
          <div className="container">
            <div className="error" role="alert">
              <AlertCircle size={18} />
              {error}
              <button aria-label="Fechar aviso" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          </div>
        )}
        {view === "inicio" && (
          <>
            <section className="hero container">
              <div className="hero-copy">
                <span className="eyebrow">
                  <span className="live-dot" /> SUA CURIOSIDADE TEM UM NOVO
                  LUGAR
                </span>
                <h1>
                  Menos ruído.
                  <br />
                  Mais <span>conhecimento.</span>
                  <svg viewBox="0 0 320 12" aria-hidden="true">
                    <path d="M3 9 Q140 -4 316 7" />
                  </svg>
                </h1>
                <p>
                  Encontre o essencial para entender de verdade.
                  <br className="desktop" /> Resumos, mapas e materiais para
                  acompanhar
                  <br className="desktop" /> cada passo da sua vida acadêmica.
                </p>
                <form
                  className="hero-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    go("catalogo");
                  }}
                >
                  <Search size={20} />
                  <input
                    aria-label="Buscar materiais"
                    placeholder="O que você quer aprender hoje?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button className="btn primary" type="submit">
                    Explorar <ArrowRight size={16} />
                  </button>
                </form>
                <div className="hero-tags">
                  <span>Comece por:</span>
                  {["Patologia", "Anatomia", "Cálculo"].map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setQuery(t);
                        go("catalogo");
                      }}
                    >
                      {t} <ArrowUpRight size={12} />
                    </button>
                  ))}
                </div>
                <div className="hero-foot">
                  <span>
                    <ShieldCheck size={17} /> Autoria identificada
                  </span>
                  <i />
                  <span>
                    <BookOpen size={17} /> No seu ritmo
                  </span>
                </div>
              </div>
              <div
                className="hero-art"
                aria-label="Ilustração de materiais de estudo Nimbus"
              >
                <div className="orbit orbit1" />
                <div className="orbit orbit2" />
                <span className="spark spark1">✳</span>
                <span className="spark spark2">✦</span>
                <div className="floating-note">
                  <span className="note-icon">
                    <Bookmark size={18} />
                  </span>
                  <div>
                    Seu próximo capítulo<small>começa com uma boa ideia.</small>
                  </div>
                </div>
                <div className="hero-book back-book">
                  <span>NIMBUS / CONEXÕES</span>
                  <div className="mini-lines" />
                  <h3>
                    Ideias que
                    <br />
                    se conectam.
                  </h3>
                  <div className="mindmap">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <small>MAPAS MENTAIS ↗</small>
                </div>
                <div className="hero-book front-book">
                  <span className="book-brand">
                    <Cloud size={16} /> nimbus.
                  </span>
                  <div className="book-label">COLEÇÃO ACADÊMICA / 01</div>
                  <h3>
                    Entender.
                    <br />
                    Conectar.
                    <br />
                    <em>Aprender.</em>
                  </h3>
                  <div className="book-rings">
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="book-bottom">
                    O essencial faz a diferença.
                    <ArrowUpRight size={20} />
                  </div>
                </div>
                <div className="floating-pill">
                  <span>
                    <Check size={16} />
                  </span>{" "}
                  Uma ideia de cada vez.
                </div>
                <div className="art-caption">
                  CONHECIMENTO QUE FICA. <span>↗</span>
                </div>
              </div>
            </section>
            <section className="benefits">
              <div className="container benefit-grid">
                <div>
                  <span>
                    <Layers size={23} />
                  </span>
                  <p>
                    <strong>Encontre seu conteúdo</strong>
                    <small>Por curso, assunto e formato</small>
                  </p>
                </div>
                <div>
                  <span>
                    <FileText size={23} />
                  </span>
                  <p>
                    <strong>Conheça antes de escolher</strong>
                    <small>Prévias e descrição dos materiais</small>
                  </p>
                </div>
                <div>
                  <span>
                    <Library size={23} />
                  </span>
                  <p>
                    <strong>Sua biblioteca, com você</strong>
                    <small>Acesso no computador e no celular</small>
                  </p>
                </div>
                <div>
                  <span>
                    <PenLine size={23} />
                  </span>
                  <p>
                    <strong>Conhecimento com autoria</strong>
                    <small>Um espaço para quem cria e aprende</small>
                  </p>
                </div>
              </div>
            </section>
            <section className="section container">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">CADA CAMINHO, UMA DESCOBERTA</span>
                  <h2>Qual é a sua área?</h2>
                </div>
                <button className="text-link" onClick={() => go("catalogo")}>
                  Explorar todas <ArrowUpRight size={17} />
                </button>
              </div>
              <div className="areas">
                {categories.slice(1).map((c, i) => {
                  const Icon = icons[(i + 1) % icons.length];
                  return (
                    <button
                      key={c}
                      onClick={() => {
                        setCategory(c);
                        setCourse("Todos");
                        setSubject("");
                        setTopic("");
                        go("catalogo");
                      }}
                    >
                      <span className={"area-icon tone" + (i % 6)}>
                        <Icon size={24} />
                      </span>
                      <strong>{c}</strong>
                      <ArrowUpRight size={15} />
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="section container featured">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">ABRA ESPAÇO PARA NOVAS IDEIAS</span>
                  <h2>Seu próximo material está aqui.</h2>
                </div>
                <button className="text-link" onClick={() => go("catalogo")}>
                  Ver catálogo <ArrowUpRight size={17} />
                </button>
              </div>
              <div className="catalog-notice">
                <span className="badge">Em construção</span> Conheça a
                experiência Nimbus. Os itens pagos abaixo são demonstrativos; o
                guia gratuito já pode ser adquirido.
              </div>
              <div className="tabs showcases">
                {[
                  ["gratuitos", "Gratuitos"],
                  ["novidades", "Novidades"],
                  ["avaliados", "Mais bem avaliados"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setShowcase(key);
                      setFree(key === "gratuitos");
                      setSort(key === "novidades" ? "recentes" : "relevancia");
                      go("catalogo");
                    }}
                  >
                    {label} <ArrowUpRight size={13} />
                  </button>
                ))}
              </div>
              <div className="product-grid">
                {[
                  ...products.filter(
                    (p) => p.course === "Medicina Veterinária",
                  ),
                  ...products.filter(
                    (p) => p.course !== "Medicina Veterinária",
                  ),
                ]
                  .slice(0, 4)
                  .map((p, i) => renderCard(p, i))}
              </div>
              {!loaded && (
                <div className="loading">
                  <Loader2 className="spin" /> Carregando materiais…
                </div>
              )}
            </section>
            <section className="container author-banner">
              <div>
                <span className="eyebrow">
                  SEU CONHECIMENTO PODE IR MAIS LONGE
                </span>
                <h2>
                  Você cria.
                  <br />
                  Alguém descobre.
                </h2>
                <p>
                  Transforme seu material autoral em uma nova
                  <br className="desktop" /> oportunidade de ensinar. Faça parte
                  da Nimbus.
                </p>
                <button className="btn dark" onClick={() => go("autores")}>
                  Quero publicar materiais <ArrowUpRight size={17} />
                </button>
              </div>
              <div className="author-art">
                <div className="sheet">
                  <span>
                    <PenLine size={20} /> FEITO POR VOCÊ
                  </span>
                  <h3>
                    Uma boa ideia
                    <br />
                    merece circular.
                  </h3>
                  <div />
                  <div />
                  <div />
                  <span className="sheet-sign">nimbus. ↗</span>
                </div>
                <span className="author-star">✳</span>
              </div>
            </section>
            <section className="section container how">
              <div>
                <span className="eyebrow">SIMPLES, DO SEU JEITO</span>
                <h2>
                  Da descoberta
                  <br />
                  ao aprendizado.
                </h2>
                <p>
                  Um caminho curto entre o conteúdo
                  <br />
                  que você procura e seu próximo estudo.
                </p>
              </div>
              <div className="how-steps">
                {[
                  [
                    "01",
                    "Encontre o que faz sentido",
                    "Explore por área e veja a prévia antes de escolher.",
                  ],
                  [
                    "02",
                    "Escolha seu próximo capítulo",
                    "Adicione os materiais ao carrinho e conclua a aquisição.",
                  ],
                  [
                    "03",
                    "Abra sua biblioteca",
                    "Acesse seus arquivos e acompanhe suas revisões.",
                  ],
                ].map(([n, t, d]) => (
                  <div key={n}>
                    <span>{n}</span>
                    <p>
                      <strong>{t}</strong>
                      <small>{d}</small>
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
        {(view === "catalogo" || view === "favoritos") && (
          <section className="container page-section">
            <div className="breadcrumb">
              <button onClick={() => go("inicio")}>Início</button>
              <ChevronRight size={13} />
              {view === "favoritos" ? "Favoritos" : "Explorar materiais"}
            </div>
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  {view === "favoritos"
                    ? "GUARDE SUAS PRÓXIMAS DESCOBERTAS"
                    : "SEU ACERVO DE POSSIBILIDADES"}
                </span>
                <h1>
                  {view === "favoritos"
                    ? "Seus favoritos."
                    : "Encontre sua próxima ideia."}
                </h1>
                <p>
                  {view === "favoritos"
                    ? "Os materiais que chamaram sua atenção, reunidos aqui."
                    : "Explore materiais por área, assunto e jeito de aprender."}
                </p>
              </div>
            </div>
            {view === "favoritos" && !user ? (
              signedOut("Suas ideias favoritas esperam por você.")
            ) : (
              <>
                <div className="catalog-layout">
                  <aside className="filters">
                    <h3>
                      <SlidersHorizontal size={17} /> Filtrar materiais
                    </h3>
                    <label>Área de conhecimento</label>
                    <div className="filter-options">
                      {categories.map((c) => (
                        <button
                          key={c}
                          className={category === c ? "active" : ""}
                          onClick={() => {
                            setCategory(c);
                            setCourse("Todos");
                            setSubject("");
                            setTopic("");
                          }}
                        >
                          <span className="radio" />
                          {c}
                        </button>
                      ))}
                    </div>
                    <label htmlFor="course-filter">Curso</label>
                    <select
                      id="course-filter"
                      value={course}
                      onChange={(e) => {
                        setCourse(e.target.value);
                        setSubject("");
                        setTopic("");
                      }}
                    >
                      <option>Todos</option>
                      {(category === categories[0]
                        ? Object.values(areas).flat()
                        : areas[category] || []
                      ).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <label htmlFor="subject-filter">Disciplina</label>
                    <input
                      id="subject-filter"
                      list="subject-suggestions"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Ex.: Patologia"
                    />
                    <datalist id="subject-suggestions">
                      {(subjects[course] || []).map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </datalist>
                    <label htmlFor="topic-filter">Assunto específico</label>
                    <input
                      id="topic-filter"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Ex.: Sistema respiratório"
                    />{" "}
                    <label htmlFor="format">Tipo de material</label>
                    <select
                      id="format"
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                    >
                      <option>Todos</option>
                      {formats.map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                    {[
                      {
                        label: "Nível de ensino",
                        value: level,
                        set: setLevel,
                        options: levels,
                      },
                      {
                        label: "Idioma",
                        value: language,
                        set: setLanguage,
                        options: languages,
                      },
                      {
                        label: "Formato do arquivo",
                        value: fileType,
                        set: setFileType,
                        options: fileTypes,
                      },
                    ].map((f) => (
                      <div className="extra-filter" key={f.label}>
                        <label>
                          {f.label}
                          <select
                            value={f.value}
                            onChange={(e) => f.set(e.target.value)}
                          >
                            <option>Todos</option>
                            {f.options.map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ))}
                    <div className="price-filters">
                      <label>
                        Preço mínimo (R$)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={minPrice}
                          onChange={(e) => setMinPrice(e.target.value)}
                        />
                      </label>
                      <label>
                        Preço máximo (R$)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(e.target.value)}
                        />
                      </label>
                    </div>
                    <label>
                      Atualizados a partir de
                      <input
                        type="date"
                        value={updatedAfter}
                        onChange={(e) => setUpdatedAfter(e.target.value)}
                      />
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={free}
                        onChange={(e) => setFree(e.target.checked)}
                      />{" "}
                      Apenas gratuitos
                    </label>
                    <button
                      className="text-link"
                      onClick={() => {
                        setCategory(categories[0]);
                        setFormat("Todos");
                        setCourse("Todos");
                        setSubject("");
                        setTopic("");
                        setLevel("Todos");
                        setLanguage("Todos");
                        setFileType("Todos");
                        setMinPrice("");
                        setMaxPrice("");
                        setUpdatedAfter("");
                        setShowcase("todos");
                        setFree(false);
                        setQuery("");
                      }}
                    >
                      Limpar filtros <X size={13} />
                    </button>
                    <div className="filter-note">
                      <BookOpen size={24} />
                      <strong>Uma boa escolha começa pela prévia.</strong>
                      <p>Conheça o conteúdo e a autoria de cada material.</p>
                    </div>
                  </aside>
                  <div>
                    <div
                      className="tabs showcases"
                      aria-label="Vitrines do catálogo"
                    >
                      {[
                        ["todos", "Todos os materiais"],
                        ["proprios", "Acervo do Professor Gustavo"],
                        ["parceiros", "Autores parceiros"],
                        ["gratuitos", "Gratuitos"],
                        ["novidades", "Novidades"],
                        ["avaliados", "Mais bem avaliados"],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          className={showcase === key ? "active" : ""}
                          onClick={() => {
                            setShowcase(key);
                            setFree(key === "gratuitos");
                            setSort(
                              key === "novidades" ? "recentes" : "relevancia",
                            );
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {showcase === "avaliados" && (
                      <p className="notice">
                        Materiais reais com pelo menos 3 avaliações e média
                        mínima de 4 estrelas. Ainda sem avaliações suficientes?
                        A vitrine permanece vazia.
                      </p>
                    )}{" "}
                    <div className="catalog-toolbar">
                      <div className="search-input">
                        <Search size={18} />
                        <input
                          aria-label="Pesquisar no catálogo"
                          placeholder="Busque um assunto, título ou autor"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        {query && (
                          <button
                            aria-label="Limpar busca"
                            onClick={() => setQuery("")}
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>
                      <select
                        aria-label="Ordenar materiais"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="relevancia">Relevância</option>
                        <option value="menor">Menor preço</option>
                        <option value="maior">Maior preço</option>
                        <option value="recentes">Mais recentes</option>
                      </select>
                    </div>
                    <div className="results-row">
                      <span>
                        {visible.length}{" "}
                        {visible.length === 1
                          ? "material encontrado"
                          : "materiais encontrados"}
                      </span>
                      <span>
                        <LayoutGrid size={14} /> Catálogo Nimbus
                      </span>
                    </div>
                    <div className="product-grid catalog-grid">
                      {visible.map((p, i) => renderCard(p, i))}
                    </div>
                    {visible.length === 0 && (
                      <Empty
                        icon={<Search />}
                        title="Nenhum material por aqui ainda."
                        text="Tente outro assunto ou ajuste os filtros da busca."
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        )}
        {view === "carrinho" && (
          <section className="container page-section">
            <div className="page-heading">
              <span className="eyebrow">SEU PRÓXIMO PASSO</span>
              <h1>Uma boa seleção.</h1>
              <p>Revise os materiais que vão acompanhar seus estudos.</p>
            </div>
            {cartItems.length ? (
              <div className="cart-layout">
                <div className="panel">
                  {cartItems.map((p, i) => (
                    <div className="cart-item" key={p.id}>
                      <div className="mini-cover">
                        <Cover p={p} index={i} />
                      </div>
                      <div>
                        <span className="eyebrow">{p.format}</span>
                        <h3>{p.title}</h3>
                        <small>
                          {p.category} · {p.course}
                        </small>
                        {p.demo === 1 && p.price > 0 && (
                          <span className="warning-label">
                            Demonstrativo · indisponível para compra
                          </span>
                        )}
                        <button
                          className="remove"
                          onClick={() => {
                            sessionStorage.removeItem(
                              "nimbus-checkout:" + cart.toSorted().join(","),
                            );
                            setCart(cart.filter((id) => id !== p.id));
                          }}
                        >
                          Remover
                        </button>
                      </div>
                      <strong>
                        {p.price === 0 ? "Grátis" : money(p.price)}
                      </strong>
                    </div>
                  ))}
                  <button className="text-link" onClick={() => go("catalogo")}>
                    Continuar explorando <ArrowRight size={16} />
                  </button>
                </div>
                <aside className="panel checkout">
                  <h2>Resumo do pedido</h2>
                  <div>
                    <span>Materiais ({cartItems.length})</span>
                    <strong>
                      {money(cartItems.reduce((s, p) => s + p.price, 0))}
                    </strong>
                  </div>
                  <div>
                    <span>Entrega digital</span>
                    <span>Na sua biblioteca</span>
                  </div>
                  <div className="total">
                    <span>Total</span>
                    <strong>
                      {money(cartItems.reduce((s, p) => s + p.price, 0))}
                    </strong>
                  </div>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                    />
                    <span>
                      Li as{" "}
                      <button
                        className="inline-link"
                        onClick={() => go("termos")}
                      >
                        condições de compra
                      </button>{" "}
                      e a{" "}
                      <button
                        className="inline-link"
                        onClick={() => go("privacidade")}
                      >
                        política de privacidade
                      </button>
                      .
                    </span>
                  </label>
                  {user ? (
                    <button
                      className="btn primary full"
                      disabled={
                        busy ||
                        !accepted ||
                        cartItems.some(
                          (p) => p.price > 0 && (p.demo || !payments),
                        )
                      }
                      onClick={() =>
                        action(async () => {
                          const key =
                            "nimbus-checkout:" + cart.toSorted().join(",");
                          let request_id = sessionStorage.getItem(key);
                          if (!request_id) {
                            request_id = crypto.randomUUID();
                            sessionStorage.setItem(key, request_id);
                          }
                          const result = await api("checkout", {
                            ids: cart,
                            accepted,
                            request_id,
                          });
                          if (result.url) {
                            window.location.assign(result.url);
                            return;
                          }
                          setCart([]);
                          notify("Material disponível na sua biblioteca!");
                          go("biblioteca");
                        })
                      }
                    >
                      {busy ? (
                        <Loader2 className="spin" size={18} />
                      ) : (
                        <Lock size={17} />
                      )}{" "}
                      {cartItems.every((p) => p.price === 0)
                        ? "Adicionar à minha biblioteca"
                        : "Ir para pagamento"}
                    </button>
                  ) : (
                    <a
                      className="btn primary full"
                      href="/signin-with-chatgpt?return_to=%2F%23carrinho"
                      target="_top"
                    >
                      Entrar para continuar <ArrowRight size={16} />
                    </a>
                  )}
                  <small className="checkout-hint">
                    <ShieldCheck size={16} /> Materiais pagos são liberados após
                    a confirmação do pagamento.
                  </small>
                  {cartItems.some((p) => p.price > 0 && p.demo === 1) && (
                    <p className="notice">
                      Os itens demonstrativos não estão à venda. Remova-os para
                      experimentar o guia gratuito.
                    </p>
                  )}
                </aside>
              </div>
            ) : (
              <Empty
                icon={<ShoppingBag />}
                title="Seu carrinho está aberto a ideias."
                text="Explore o catálogo e encontre seu próximo material."
                button="Explorar materiais"
                onClick={() => go("catalogo")}
              />
            )}
          </section>
        )}
        {view === "biblioteca" && (
          <section className="container page-section">
            <div className="page-heading with-action">
              <div>
                <span className="eyebrow">SEU ESPAÇO DE APRENDIZADO</span>
                <h1>
                  {user
                    ? `Olá, ${user.name.split(" ")[0]}. Vamos aprender?`
                    : "Sua biblioteca."}
                </h1>
                <p>Seus materiais, suas anotações e seu próximo passo.</p>
              </div>
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    setLibrary((await api("library")).items);
                    setOrders((await api("orders")).orders);
                  })
                }
              >
                <Clock size={16} /> Atualizar biblioteca
              </button>
            </div>
            {!user ? (
              signedOut("Seu conhecimento merece um lugar só.")
            ) : (
              <>
                <div className="stats">
                  <Stat
                    icon={<Library />}
                    value={library.length}
                    label="Materiais na biblioteca"
                  />
                  <Stat
                    icon={<CheckCircle2 />}
                    value={
                      library.filter((i) => (i.progress || 0) === 100).length
                    }
                    label="Revisões concluídas"
                  />
                  <Stat
                    icon={<ShoppingBag />}
                    value={orders.filter((o) => o.status === "paid").length}
                    label="Pedidos confirmados"
                  />
                </div>
                {orders.some((o) => o.status === "pending") && (
                  <div className="notice">
                    Você tem um pedido aguardando confirmação. A liberação
                    depende do retorno do provedor de pagamento.
                  </div>
                )}
                <h2 className="subheading">Continue de onde parou</h2>
                {library.length ? (
                  <div className="library-grid">
                    {library.map((item) => (
                      <article
                        className="panel library-card"
                        key={item.product_id}
                      >
                        <span className="library-icon">
                          <BookOpen size={28} />
                        </span>
                        <span className="eyebrow">
                          ADICIONADO EM {date(item.created)}
                        </span>
                        <h3>{item.title}</h3>
                        <div className="progress-label">
                          <span>Minha revisão</span>
                          <strong>{item.progress || 0}%</strong>
                        </div>
                        <div className="progress-track">
                          <span style={{ width: (item.progress || 0) + "%" }} />
                        </div>
                        <button
                          className="btn primary full"
                          onClick={() => openReader(item)}
                        >
                          Abrir material <ArrowUpRight size={16} />
                        </button>
                        <a
                          className="text-link"
                          href={"/api/download/" + item.product_id}
                        >
                          <Download size={15} /> Baixar arquivo
                        </a>
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon={<BookOpen />}
                    title="Sua primeira descoberta começa aqui."
                    text="Experimente nosso guia gratuito e conheça sua biblioteca Nimbus."
                    button="Encontrar materiais gratuitos"
                    onClick={() => {
                      setFree(true);
                      setCategory(categories[0]);
                      setQuery("");
                      go("catalogo");
                    }}
                  />
                )}
              </>
            )}
          </section>
        )}
        {view === "pedidos" && (
          <section className="container page-section">
            <div className="page-heading">
              <span className="eyebrow">TUDO ORGANIZADO</span>
              <h1>Seus pedidos.</h1>
              <p>Acompanhe suas aquisições e o status de cada pagamento.</p>
            </div>
            {!user ? (
              signedOut("Acompanhe seus pedidos.")
            ) : (
              <>
                {orders.length ? (
                  orders.map((o) => (
                    <div className="panel order" key={o.id}>
                      <div className="order-heading">
                        <div>
                          <strong>
                            Pedido {o.id.slice(0, 8).toUpperCase()}
                          </strong>
                          <small>{date(o.created)}</small>
                        </div>
                        <Status value={o.status} />
                      </div>
                      {o.items.map((i, n) => (
                        <div className="order-line" key={n}>
                          <span>{i.title}</span>
                          <strong>{money(i.price)}</strong>
                        </div>
                      ))}
                      <div className="order-line">
                        <strong>Total</strong>
                        <strong>{money(o.total)}</strong>
                      </div>
                      {o.status === "paid" && (
                        <button
                          className="text-link"
                          onClick={() => go("biblioteca")}
                        >
                          Acessar na biblioteca <ArrowRight size={15} />
                        </button>
                      )}
                      {o.status === "pending" && (
                        <p className="notice">
                          Pagamento em processamento. Atualize esta página após
                          a confirmação.
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <Empty
                    icon={<ShoppingBag />}
                    title="Seu histórico começa na próxima descoberta."
                    text="Os pedidos aparecerão aqui após a aquisição."
                    button="Explorar catálogo"
                    onClick={() => go("catalogo")}
                  />
                )}
              </>
            )}
          </section>
        )}
        {view === "perfil" && (
          <section className="container page-section narrow">
            <div className="page-heading">
              <span className="eyebrow">DO SEU JEITO</span>
              <h1>Meu perfil.</h1>
              <p>Informações essenciais para sua experiência Nimbus.</p>
            </div>
            {!user ? (
              signedOut("Entre para editar seu perfil.")
            ) : (
              <form
                className="panel form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  action(async () => {
                    await api("profile", Object.fromEntries(data));
                    await refresh();
                    notify("Perfil atualizado.");
                  });
                }}
              >
                <div className="profile-intro">
                  <span className="avatar large">{initials(user.name)}</span>
                  <div>
                    <strong>{user.name}</strong>
                    <small>Conta de estudante e autor</small>
                  </div>
                </div>
                <label>
                  Nome
                  <input
                    name="name"
                    defaultValue={user.name}
                    minLength={2}
                    maxLength={100}
                    required
                    autoComplete="name"
                  />
                </label>
                <label>
                  E-mail
                  <input value={user.email} disabled />
                  <small>
                    Seu e-mail é fornecido pela conta usada no acesso.
                  </small>
                </label>
                <label>
                  Curso <small>Opcional</small>
                  <input
                    name="course"
                    defaultValue={user.course}
                    maxLength={100}
                  />
                </label>
                <label>
                  Instituição <small>Opcional</small>
                  <input
                    name="institution"
                    defaultValue={user.institution}
                    maxLength={150}
                  />
                </label>
                <button className="btn primary" disabled={busy}>
                  Salvar alterações <Check size={16} />
                </button>
                <a
                  className="text-link"
                  href="/signout-with-chatgpt?return_to=%2F"
                  target="_top"
                >
                  <LogOut size={15} /> Sair da conta
                </a>
              </form>
            )}
          </section>
        )}
        {view === "autores" && (
          <section className="container page-section">
            <div className="page-heading with-action">
              <div>
                <span className="eyebrow">CRIE. COMPARTILHE. INSPIRE.</span>
                <h1>Seu conhecimento tem espaço.</h1>
                <p>
                  Publique materiais autorais e acompanhe suas vendas na Nimbus.
                </p>
              </div>
              {user && (
                <button
                  className="btn primary"
                  onClick={() => {
                    setForm(emptyForm);
                    document
                      .getElementById("author-form")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Plus size={17} /> Novo material
                </button>
              )}
            </div>
            {!user ? (
              <>
                <div className="author-benefits">
                  <Stat
                    icon={<PenLine />}
                    value="01"
                    label="Prepare seu material original"
                  />
                  <Stat
                    icon={<ShieldCheck />}
                    value="02"
                    label="Envie o arquivo para aprovação"
                  />
                  <Stat
                    icon={<BarChart3 />}
                    value="03"
                    label="Acompanhe vendas confirmadas"
                  />
                </div>
                {signedOut("Sua próxima publicação começa aqui.")}
                <p className="muted center">
                  Sem mensalidade ou taxa de envio. A Nimbus recebe 25% do
                  líquido após processamento nas vendas de parceiros, salvo
                  regra individual acordada. Repasses são controlados
                  mensalmente e realizados fora da plataforma.
                </p>
              </>
            ) : (
              <>
                <div className="stats">
                  <Stat
                    icon={<FileText />}
                    value={author.products.length}
                    label="Materiais enviados"
                  />
                  <Stat
                    icon={<ShoppingBag />}
                    value={author.sales.length}
                    label="Vendas confirmadas"
                  />
                  <Stat
                    icon={<BarChart3 />}
                    value={money(author.sales.reduce((s, x) => s + x.price, 0))}
                    label="Valor bruto dos materiais · não é saldo para saque"
                  />
                </div>
                <div className="notice">
                  Publicações passam por aprovação. O painel registra vendas
                  brutas. A comissão padrão é de 25% após custos de
                  processamento, com condições específicas exibidas abaixo.
                </div>
                {author.finance && <FinancePanel report={author.finance} />}
                <div className="author-layout">
                  <div>
                    <h2 className="subheading">Meus materiais</h2>
                    {author.products.length ? (
                      author.products.map((p) => (
                        <div className="panel author-product" key={p.id}>
                          <div>
                            <Status value={p.status} />
                            <h3>{p.title}</h3>
                            <p>
                              {money(p.price)} · {p.format}
                            </p>
                            <small>
                              {p.file_name || "arquivo ainda não enviado"}
                            </small>
                          </div>
                          <button
                            className="btn secondary small"
                            onClick={() => {
                              setForm({
                                id: p.id,
                                title: p.title,
                                description: p.description,
                                category: p.category,
                                course: p.course || "",
                                level: p.level || "Graduação",
                                language: p.language || "Português",
                                subject: p.subject,
                                topic: p.topic || "",
                                format: p.format,
                                price: (p.price / 100).toFixed(2),
                                pages: String(p.pages),
                                preview: p.preview,
                                rights: false,
                                commercial_accepted: false,
                              });
                              document
                                .getElementById("author-form")
                                ?.scrollIntoView({ behavior: "smooth" });
                            }}
                          >
                            Editar
                          </button>
                          <label className="upload-label">
                            <Upload size={15} />{" "}
                            {p.file_key
                              ? "Substituir arquivo"
                              : "Enviar arquivo (até 20 MB)"}
                            <input
                              type="file"
                              accept=".pdf,.txt,.docx,.xlsx,.pptx,.png,.jpg,.zip,.mp4,.mp3"
                              disabled={busy}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                action(async () => {
                                  const data = new FormData();
                                  data.set("id", p.id);
                                  data.set("file", file);
                                  const r = await fetch("/api/upload", {
                                    method: "POST",
                                    body: data,
                                  });
                                  const result =
                                    (await r.json()) as ApiResponse;
                                  if (!r.ok) throw new Error(result.error);
                                  setAuthor(await api("author"));
                                  notify("arquivo enviado para aprovação.");
                                });
                              }}
                            />
                          </label>
                        </div>
                      ))
                    ) : (
                      <Empty
                        icon={<PenLine />}
                        title="O próximo autor pode ser você."
                        text="Preencha os dados ao lado, salve e envie seu arquivo."
                      />
                    )}
                  </div>
                  <form
                    id="author-form"
                    className="panel form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      action(async () => {
                        const result = await api("author", {
                          ...form,
                          accepted_rate: author.policy?.owned
                            ? 0
                            : (author.policy?.commission_bps ?? 2500),
                          accepted_owned: author.policy?.owned || 0,
                          price: Math.round(
                            Number(form.price.replace(",", ".")) * 100,
                          ),
                          pages: Number(form.pages),
                        });
                        setAuthor(await api("author"));
                        setForm({ ...emptyForm, id: result.id });
                        notify(
                          "Rascunho salvo. Agora envie o arquivo em Meus materiais.",
                        );
                      });
                    }}
                  >
                    <h2>{form.id ? "Editar material" : "Novo material"}</h2>
                    <p>
                      Primeiro salve o rascunho. Depois, envie o arquivo para
                      análise.
                    </p>
                    <label>
                      Título
                      <input
                        value={form.title}
                        onChange={(e) =>
                          setForm({ ...form, title: e.target.value })
                        }
                        required
                        minLength={5}
                        maxLength={150}
                      />
                    </label>
                    <div className="form-row">
                      <label>
                        Área
                        <select
                          value={form.category}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              category: e.target.value,
                              course: areas[e.target.value][0],
                            })
                          }
                        >
                          {categories.slice(1).map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Tipo de material
                        <select
                          value={form.format}
                          onChange={(e) =>
                            setForm({ ...form, format: e.target.value })
                          }
                        >
                          {formats.map((f) => (
                            <option key={f}>{f}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="form-row">
                      <label>
                        Curso
                        <select
                          value={form.course}
                          onChange={(e) =>
                            setForm({ ...form, course: e.target.value })
                          }
                        >
                          {(areas[form.category] || []).map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Nível de ensino
                        <select
                          value={form.level}
                          onChange={(e) =>
                            setForm({ ...form, level: e.target.value })
                          }
                        >
                          {levels.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label>
                      Idioma
                      <select
                        value={form.language}
                        onChange={(e) =>
                          setForm({ ...form, language: e.target.value })
                        }
                      >
                        {languages.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>{" "}
                    <label>
                      Disciplina
                      <input
                        value={form.subject}
                        onChange={(e) =>
                          setForm({ ...form, subject: e.target.value })
                        }
                        required
                        maxLength={100}
                      />
                    </label>
                    <label>
                      Assunto específico (opcional)
                      <input
                        value={form.topic}
                        onChange={(e) =>
                          setForm({ ...form, topic: e.target.value })
                        }
                        maxLength={120}
                        placeholder="Ex.: Sistema respiratório"
                      />
                    </label>{" "}
                    <div className="form-row">
                      <label>
                        Preço (R$)
                        <input
                          type="number"
                          min="0"
                          max="10000"
                          step="0.01"
                          value={form.price}
                          onChange={(e) =>
                            setForm({ ...form, price: e.target.value })
                          }
                          required
                        />
                      </label>
                      <label>
                        Páginas
                        <input
                          type="number"
                          min="1"
                          max="5000"
                          value={form.pages}
                          onChange={(e) =>
                            setForm({ ...form, pages: e.target.value })
                          }
                          required
                        />
                      </label>
                    </div>
                    <label>
                      Descrição
                      <textarea
                        value={form.description}
                        onChange={(e) =>
                          setForm({ ...form, description: e.target.value })
                        }
                        required
                        minLength={30}
                        maxLength={5000}
                        placeholder="Objetivos, público, conteúdo, referências e data de atualização."
                      />
                    </label>
                    <label>
                      Prévia pública
                      <textarea
                        value={form.preview}
                        onChange={(e) =>
                          setForm({ ...form, preview: e.target.value })
                        }
                        required
                        minLength={50}
                        maxLength={20000}
                        placeholder="Compartilhe um trecho representativo do material."
                      />
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={form.rights}
                        onChange={(e) =>
                          setForm({ ...form, rights: e.target.checked })
                        }
                        required
                      />
                      <span>
                        Sou autor ou tenho autorização para comercializar este
                        conteúdo, incluindo imagens e outros elementos.
                      </span>
                    </label>
                    <EarningsPreview
                      price={Math.max(
                        0,
                        Math.round(
                          (Number(form.price.replace(",", ".")) || 0) * 100,
                        ),
                      )}
                      policy={
                        author.policy || { commission_bps: 2500, owned: 0 }
                      }
                    />
                    <label className="check-label">
                      <input
                        type="checkbox"
                        required
                        checked={form.commercial_accepted}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            commercial_accepted: e.target.checked,
                          })
                        }
                      />
                      <span>
                        Li e aceito a regra exibida acima, com os custos de
                        processamento descontados antes da divisão. Serviços
                        editoriais e descontos dependem de acordo específico. A
                        simulação não garante o custo final.
                      </span>
                    </label>{" "}
                    <button className="btn primary full" disabled={busy}>
                      Salvar rascunho <Check size={16} />
                    </button>
                  </form>
                </div>
              </>
            )}
          </section>
        )}
        {view === "admin" && (
          <section className="container page-section">
            <div className="page-heading">
              <span className="eyebrow">CENTRAL DE OPERAÇÕES</span>
              <h1>Administração.</h1>
              <p>Catálogo, pedidos, estudantes e atendimento.</p>
            </div>
            {!user?.admin ? (
              <Empty
                icon={<Lock />}
                title="Área restrita."
                text="O acesso depende da configuração de administradores no servidor."
              />
            ) : admin ? (
              <>
                <div className="stats">
                  <Stat
                    icon={<UserRound />}
                    value={admin.users.length}
                    label="Pessoas cadastradas"
                  />
                  <Stat
                    icon={<FileText />}
                    value={
                      admin.products.filter((p) => p.status === "pending")
                        .length
                    }
                    label="Materiais em análise"
                  />
                  <Stat
                    icon={<BarChart3 />}
                    value={money(
                      admin.orders
                        .filter((o) => o.status === "paid")
                        .reduce((s, o) => s + o.total, 0),
                    )}
                    label="Total de pedidos confirmados"
                  />
                </div>
                <div className="tabs">
                  {[
                    "produtos",
                    "pedidos",
                    "pessoas",
                    "atendimento",
                    "histórico",
                    "financeiro",
                    "privacidade",
                  ].map((t) => (
                    <button
                      key={t}
                      className={adminTab === t ? "active" : ""}
                      onClick={() => setAdminTab(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {adminTab === "privacidade" && <PrivacyCenter admin signedIn />}
                {adminTab === "financeiro" && (
                  <>
                    <button
                      className="btn secondary"
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          setFinanceData(await api("finance"));
                        })
                      }
                    >
                      Carregar / atualizar financeiro
                    </button>
                    {financeData && (
                      <FinancePanel
                        report={financeData.finance}
                        accounts={financeData.accounts}
                        onAction={async (data) => {
                          await api("finance", data);
                          setFinanceData(await api("finance"));
                          notify("Financeiro atualizado.");
                        }}
                      />
                    )}
                  </>
                )}{" "}
                {adminTab === "produtos" && (
                  <div className="panel table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>Autor</th>
                          <th>Preço</th>
                          <th>Status</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admin.products.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <strong>{p.title}</strong>
                              <small>
                                {p.category}
                                {p.demo === 1 ? " · demonstração" : ""}
                              </small>
                            </td>
                            <td>{p.author}</td>
                            <td>{money(p.price)}</td>
                            <td>
                              <Status value={p.status} />
                            </td>
                            <td>
                              <button
                                className="text-link"
                                onClick={() => setDetail(p)}
                              >
                                Ver prévia
                              </button>
                              {p.file_key && (
                                <>
                                  <a
                                    className="text-link"
                                    href={"/api/admin-file/" + p.id}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Revisar arquivo <ArrowUpRight size={12} />
                                  </a>
                                  <button
                                    className="btn secondary small"
                                    disabled={busy}
                                    onClick={() =>
                                      action(async () => {
                                        await api("admin", {
                                          action: "product",
                                          id: p.id,
                                          status:
                                            p.status === "published"
                                              ? "draft"
                                              : "published",
                                        });
                                        setAdmin(await api("admin"));
                                        await loadCatalog();
                                        notify("Status atualizado.");
                                      })
                                    }
                                  >
                                    {p.status === "published"
                                      ? "Retirar"
                                      : "Publicar"}
                                  </button>
                                  <button
                                    className="remove"
                                    disabled={busy}
                                    onClick={() =>
                                      action(async () => {
                                        await api("admin", {
                                          action: "product",
                                          id: p.id,
                                          status: "rejected",
                                        });
                                        setAdmin(await api("admin"));
                                        notify("Material rejeitado.");
                                      })
                                    }
                                  >
                                    Rejeitar
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {adminTab === "pedidos" && (
                  <div className="panel table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Pedido</th>
                          <th>Cliente</th>
                          <th>Data</th>
                          <th>Total</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admin.orders.map((o) => (
                          <tr key={o.id}>
                            <td>{o.id.slice(0, 8)}</td>
                            <td>
                              {o.name}
                              <small>{o.email}</small>
                            </td>
                            <td>{date(o.created)}</td>
                            <td>{money(o.total)}</td>
                            <td>
                              <Status value={o.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!admin.orders.length && <p>Nenhum pedido registrado.</p>}
                  </div>
                )}
                {adminTab === "pessoas" && (
                  <div className="panel table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Pessoa</th>
                          <th>E-mail</th>
                          <th>Cadastro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admin.users.map((u) => (
                          <tr key={u.id}>
                            <td>{u.name}</td>
                            <td>{u.email}</td>
                            <td>{date(u.created)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {adminTab === "atendimento" && (
                  <div>
                    {admin.tickets.map((t) => (
                      <form
                        className="panel form ticket"
                        key={t.id}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const data = new FormData(e.currentTarget);
                          action(async () => {
                            await api("admin", {
                              action: "ticket",
                              id: t.id,
                              response: data.get("response"),
                            });
                            setAdmin(await api("admin"));
                            notify("Resposta registrada.");
                          });
                        }}
                      >
                        <div className="order-heading">
                          <h3>{t.subject}</h3>
                          <Status value={t.status} />
                        </div>
                        <small>
                          {t.email} · {date(t.created)}
                        </small>
                        <p className="pre-line">{t.message}</p>
                        {t.status === "open" ? (
                          <>
                            <label>
                              Resposta
                              <textarea
                                name="response"
                                minLength={5}
                                maxLength={5000}
                                required
                              />
                            </label>
                            <button className="btn primary" disabled={busy}>
                              Responder e encerrar
                            </button>
                          </>
                        ) : (
                          <p className="notice">{t.response}</p>
                        )}
                      </form>
                    ))}
                    {!admin.tickets.length && (
                      <Empty
                        icon={<MessageCircle />}
                        title="Tudo em dia."
                        text="Nenhuma solicitação de suporte."
                      />
                    )}
                  </div>
                )}
                {adminTab === "histórico" && (
                  <div className="panel table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Quando</th>
                          <th>Ação</th>
                          <th>Referência</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admin.audit.map((a) => (
                          <tr key={a.id}>
                            <td>
                              {new Date(a.created).toLocaleString("pt-BR")}
                            </td>
                            <td>{a.action}</td>
                            <td>{a.target}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="loading">
                <Loader2 className="spin" /> Carregando painel…
              </div>
            )}
          </section>
        )}
        {view === "suporte" && (
          <section className="container page-section">
            <div className="page-heading">
              <span className="eyebrow">PODE CONTAR COM A GENTE</span>
              <h1>Como podemos ajudar?</h1>
              <p>
                Encontre respostas ou acompanhe uma solicitação de atendimento.
              </p>
            </div>
            <div className="support-layout">
              <div>
                <h2 className="subheading">Perguntas frequentes</h2>
                {[
                  [
                    "Como acesso um material adquirido?",
                    "Após a confirmação da aquisição, abra Minha biblioteca. Você pode baixar o arquivo e registrar suas anotações e seu progresso.",
                  ],
                  [
                    "Os materiais do catálogo já estão à venda?",
                    "Nesta etapa há itens demonstrativos, identificados nas páginas. O guia gratuito pode ser adquirido para experimentar o fluxo. Materiais reais precisam de arquivo e aprovação para serem publicados.",
                  ],
                  [
                    "Quais pagamentos são aceitos?",
                    "O checkout utiliza Stripe quando configurado. Os meios disponíveis são exibidos pelo provedor na etapa de pagamento; não coletamos dados de cartão na Nimbus.",
                  ],
                  [
                    "Posso vender meus próprios materiais?",
                    "Sim. Na área Para autores, salve um rascunho e envie seu arquivo original ou autorizado. A publicação depende de aprovação. A comissão padrão é de 25% após processamento, salvo regra individual confirmada pelo autor. O painel exibe o demonstrativo e o histórico de repasses externos.",
                  ],
                  [
                    "Como solicito ajuda com uma compra?",
                    "Entre na conta e abra uma solicitação nesta página. Inclua a referência do pedido e descreva o problema, sem enviar senhas ou dados de cartão.",
                  ],
                ].map(([q, a]) => (
                  <details className="faq" key={q}>
                    <summary>
                      {q}
                      <Plus size={17} />
                    </summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
              <div>
                {!user ? (
                  signedOut("Entre para falar com o suporte.")
                ) : (
                  <>
                    <form
                      className="panel form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const target = e.currentTarget;
                        action(async () => {
                          await api(
                            "tickets",
                            Object.fromEntries(new FormData(target)),
                          );
                          target.reset();
                          setTickets((await api("tickets")).tickets);
                          notify(
                            "Solicitação registrada. Acompanhe a resposta aqui.",
                          );
                        });
                      }}
                    >
                      <h2>Abra uma solicitação</h2>
                      <label>
                        Assunto
                        <input
                          name="subject"
                          required
                          minLength={3}
                          maxLength={150}
                        />
                      </label>
                      <label>
                        Como podemos ajudar?
                        <textarea
                          name="message"
                          required
                          minLength={10}
                          maxLength={5000}
                        />
                      </label>
                      <button className="btn primary" disabled={busy}>
                        Enviar solicitação <ArrowUpRight size={16} />
                      </button>
                    </form>
                    {tickets.map((t) => (
                      <div className="panel ticket" key={t.id}>
                        <div className="order-heading">
                          <h3>{t.subject}</h3>
                          <Status value={t.status} />
                        </div>
                        <small>{date(t.created)}</small>
                        <p className="pre-line">{t.message}</p>
                        {t.response && (
                          <p className="notice pre-line">
                            <strong>Resposta Nimbus</strong>
                            <br />
                            {t.response}
                          </p>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </section>
        )}
        {["termos", "privacidade", "sobre"].includes(view) && (
          <section className="container page-section narrow legal">
            <span className="eyebrow">TRANSPARÊNCIA NIMBUS</span>
            <h1>
              {view === "termos"
                ? "Condições da plataforma"
                : view === "privacidade"
                  ? "Privacidade"
                  : "Uma boa ideia merece circular."}
            </h1>
            {view === "sobre" ? (
              <>
                <p>
                  A Nimbus nasce para aproximar estudantes de materiais
                  acadêmicos organizados e de quem os produz.
                </p>
                <h2>Conhecimento que fica.</h2>
                <p>
                  Queremos facilitar a descoberta de resumos, mapas mentais,
                  guias e outros recursos, com informações claras sobre
                  conteúdo, formato e autoria.
                </p>
                <h2>Nosso momento</h2>
                <p>
                  A plataforma está em implantação. O catálogo de demonstração
                  apresenta possibilidades de organização; o guia gratuito
                  permite experimentar a biblioteca. Materiais comerciais e
                  condições com autores serão definidos antes da abertura das
                  vendas.
                </p>
                <button className="btn primary" onClick={() => go("catalogo")}>
                  Conhecer o catálogo <ArrowRight size={16} />
                </button>
              </>
            ) : view === "termos" ? (
              <>
                <div className="notice">
                  Versão de implantação · 25/10/2026. As condições comerciais
                  finais e a identificação do responsável pela operação precisam
                  ser publicadas antes da abertura de vendas reais.
                </div>
                <h2>Materiais e acesso</h2>
                <p>
                  Itens identificados como demonstrativos não representam
                  produtos comerciais disponíveis. O guia gratuito pode ser
                  adicionado à biblioteca. Materiais comerciais publicados
                  indicarão preço, formato, autoria, descrição e prévia.
                </p>
                <h2>Aquisição e entrega</h2>
                <p>
                  O pedido é calculado pelo servidor. Quando há cobrança, o
                  checkout é processado pela Stripe e a liberação depende da
                  confirmação enviada pelo provedor. A Nimbus não recebe os
                  dados completos do cartão.
                </p>
                <h2>Uso dos arquivos</h2>
                <p>
                  O acesso destina-se ao estudo pessoal. A compra de um material
                  não transfere sua autoria. Não publique arquivos de terceiros
                  sem autorização e não disponibilize provas sigilosas, dados
                  pessoais ou imagens sem permissão.
                </p>
                <h2>Autores</h2>
                <p>
                  O autor declara possuir autorização para o conteúdo enviado. O
                  material passa por análise antes da publicação. O painel de
                  vendas mostra valores brutos, sem representar saldo de saque.
                  A comissão padrão da Nimbus é de 25% sobre o valor após
                  processamento, salvo acordo individual. O autor confirma a
                  regra antes de publicar; cada venda preserva suas condições. O
                  demonstrativo utiliza as taxas reais conciliadas com o
                  provedor. Repasses são mensais, sujeitos à disponibilidade,
                  conciliação, estornos e reserva operacional de 14 dias, sem
                  limitar direitos do comprador. O painel registra
                  transferências externas já realizadas. Serviços editoriais
                  adicionais e descontos exigem acordo específico.
                </p>
                <h2>Ajuda, cancelamento e reembolso</h2>
                <p>
                  Solicitações relacionadas a compras, acesso, correções,
                  cancelamento ou reembolso devem ser registradas no suporte com
                  a referência do pedido. A plataforma ainda não oferece
                  reembolso automático; solicitações de pagamentos reais
                  precisam ser tratadas no provedor pela operação responsável.
                </p>
                <h2>Finalidade educacional</h2>
                <p>
                  Materiais auxiliam o estudo e não garantem desempenho.
                  Conteúdos de saúde não substituem avaliação profissional ou
                  protocolos aplicáveis.
                </p>
              </>
            ) : (
              <>
                <div className="notice">
                  Informações da implementação atual. A identificação e o
                  contato do responsável pelo tratamento, os prazos de retenção
                  e as condições finais precisam ser completados antes da
                  operação comercial.
                </div>
                <PrivacyCenter signedIn={!!user} />
                <h2>Informações utilizadas</h2>
                <p>
                  O acesso fornece identificador, nome e e-mail da sua conta.
                  Curso e instituição são opcionais. A plataforma armazena
                  aquisições, favoritos, anotações, progresso, avaliações,
                  publicações e solicitações de suporte.
                </p>
                <h2>Finalidade</h2>
                <p>
                  Essas informações são usadas para identificar a conta,
                  entregar materiais, organizar a biblioteca, processar pedidos
                  e responder ao atendimento. Avaliações publicadas mostram o
                  nome do avaliador; textos de suporte e anotações não são
                  públicos.
                </p>
                <h2>Pagamentos e arquivos</h2>
                <p>
                  Quando ativado, o checkout envia à Stripe o e-mail e os itens
                  do pedido. Os arquivos são armazenados em área protegida e sua
                  entrega depende de autorização no servidor.
                </p>
                <h2>Armazenamento no navegador</h2>
                <p>
                  O carrinho é salvo neste navegador para continuar a seleção
                  depois. Pedidos e materiais adquiridos ficam vinculados à
                  conta no servidor. O acesso autenticado também depende dos
                  recursos de sessão da plataforma de hospedagem.
                </p>
                <h2>Finalidades e recursos utilizados</h2>
                <p>
                  Conta, pedidos e entrega utilizam dados necessários à
                  prestação do serviço. Informações comerciais também podem
                  precisar ser mantidas para obrigações legais e exercício de
                  direitos, conforme análise da operação. A leitura da política
                  não representa consentimento genérico para qualquer uso. Não
                  há envio de marketing nem rastreamento publicitário
                  implementados nesta versão.
                </p>
                <p>
                  O acesso é fornecido pela hospedagem Sites/ChatGPT; banco e
                  arquivos utilizam serviços Cloudflare. Pagamentos, quando
                  ativados, utilizam Stripe. Fontes visuais são carregadas pelo
                  Google Fonts, o que envolve comunicação do navegador com esse
                  fornecedor. A operação deve validar as condições contratuais e
                  eventuais transferências internacionais desses serviços.
                </p>
                <p>
                  Materiais enviados não devem conter dados pessoais de
                  terceiros sem fundamento e autorização aplicáveis. Não envie
                  prontuários identificados, listas de alunos, documentos
                  pessoais ou imagens identificáveis sem análise e permissão
                  adequadas. Curso e instituição no perfil são opcionais.
                </p>
                <h2>Solicitações sobre dados</h2>
                <p>
                  Use o suporte autenticado para solicitar informações,
                  correções ou exclusão dos seus dados. O atendimento dessas
                  solicitações é realizado pela operação responsável; não há
                  exclusão automática de conta nesta versão.
                </p>
              </>
            )}
          </section>
        )}
        {![
          "inicio",
          "catalogo",
          "favoritos",
          "carrinho",
          "biblioteca",
          "pedidos",
          "perfil",
          "autores",
          "admin",
          "suporte",
          "termos",
          "privacidade",
          "sobre",
        ].includes(view) && (
          <Empty
            icon={<Search />}
            title="Esse caminho ainda não existe."
            text="Volte ao início para continuar sua descoberta."
            button="Ir para o início"
            onClick={() => go("inicio")}
          />
        )}
      </main>
      <footer>
        <div className="container footer-grid">
          <div>
            <a className="logo" href="#inicio">
              <span className="logo-mark">
                <Cloud size={23} />
              </span>
              nimbus<span className="logo-dot">.</span>
            </a>
            <p>
              Ideias claras.
              <br />
              Conhecimento que fica.
            </p>
            <span className="footer-pill">FEITO PARA QUEM QUER APRENDER ↗</span>
          </div>
          <div>
            <strong>Explore</strong>
            <button onClick={() => go("catalogo")}>Todos os materiais</button>
            <button
              onClick={() => {
                setFree(true);
                go("catalogo");
              }}
            >
              Materiais gratuitos
            </button>
            <button onClick={() => go("biblioteca")}>Minha biblioteca</button>
          </div>
          <div>
            <strong>Faça parte</strong>
            <button onClick={() => go("autores")}>Publique na Nimbus</button>
            <button onClick={() => go("sobre")}>Sobre a plataforma</button>
            <button onClick={() => go("suporte")}>Central de ajuda</button>
          </div>
          <div className="footer-message">
            <span>
              <Cloud size={21} />
            </span>
            <h3>
              Um universo de ideias.
              <br />
              Um próximo passo seu.
            </h3>
            <button className="text-link" onClick={() => go("catalogo")}>
              Encontre seu próximo material <ArrowUpRight size={16} />
            </button>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 Nimbus. Feita de boas ideias.</span>
          <div>
            <button onClick={() => go("termos")}>Condições de uso</button>
            <button onClick={() => go("privacidade")}>Privacidade</button>
            <button onClick={() => go("suporte")}>Ajuda</button>
          </div>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button onClick={() => setToast("")} aria-label="Fechar notificação">
            <X size={16} />
          </button>
        </div>
      )}
      {detail && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetail(null);
          }}
        >
          <section
            className="modal product-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
          >
            <button
              className="modal-close icon-btn"
              autoFocus
              onClick={() => setDetail(null)}
              aria-label="Fechar detalhes"
            >
              <X />
            </button>
            <div className="detail-top">
              <div className="detail-cover">
                <Cover
                  p={detail}
                  index={products.findIndex((p) => p.id === detail.id)}
                />
              </div>
              <div>
                <span className="eyebrow">
                  {detail.category} / {detail.course} / {detail.subject}
                  {detail.topic ? ` / ${detail.topic}` : ""} / {detail.format}
                </span>
                <h2 id="detail-title">{detail.title}</h2>
                <p>{detail.description}</p>
                <div className="detail-author">
                  <span className="avatar">{initials(detail.author)}</span>
                  <div>
                    <strong>{detail.author}</strong>
                    <small>Autoria indicada no catálogo</small>
                  </div>
                </div>
                <div className="detail-facts">
                  <span>
                    <FileText size={16} />
                    {detail.pages} páginas
                    {detail.demo === 1 && detail.price > 0
                      ? " ilustrativas"
                      : ""}
                  </span>
                  <span>
                    <Download size={16} /> Entrega digital
                  </span>
                </div>
                <strong className="detail-price">
                  {detail.price === 0 ? "Grátis" : money(detail.price)}
                </strong>
                {detail.demo === 1 && detail.price > 0 ? (
                  <div className="notice">
                    Exemplo de catálogo. Preço e páginas ilustrativos. O
                    material completo não está à venda.
                  </div>
                ) : (
                  <button
                    className="btn primary full"
                    onClick={() => {
                      add(detail);
                      setDetail(null);
                      go("carrinho");
                    }}
                  >
                    <ShoppingBag size={17} />
                    {cart.includes(detail.id)
                      ? "Ir para o carrinho"
                      : detail.price === 0
                        ? "Quero o material gratuito"
                        : "Adicionar ao carrinho"}
                  </button>
                )}
                <button
                  className="btn secondary full"
                  onClick={() => favorite(detail)}
                >
                  <Heart size={16} />
                  {favorites.includes(detail.id)
                    ? "Salvo nos favoritos"
                    : "Salvar para depois"}
                </button>
              </div>
            </div>
            <div className="detail-preview">
              <span className="eyebrow">ANTES DE ESCOLHER, CONHEÇA</span>
              <h3>Uma prévia do conteúdo</h3>
              <pre>{detail.preview}</pre>
            </div>
            <div className="detail-reviews">
              <h3>
                Avaliações de compradores{" "}
                {reviews.length > 0 && `(${reviews.length})`}
              </h3>
              {reviews.length ? (
                reviews.map((r, i) => (
                  <div className="review" key={i}>
                    <strong>{r.name}</strong>
                    <span className="stars">
                      {"★".repeat(r.rating)}
                      {"☆".repeat(5 - r.rating)}
                    </span>
                    <p>{r.comment}</p>
                    <small>Compra confirmada · {date(r.created)}</small>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Este material ainda não recebeu avaliações.
                </p>
              )}
              {user && (
                <form
                  className="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    action(async () => {
                      await api("reviews", { id: detail.id, rating, comment });
                      setReviews(
                        (await api("reviews?id=" + detail.id)).reviews,
                      );
                      await loadCatalog();
                      setComment("");
                      notify("Avaliação publicada.");
                    });
                  }}
                >
                  <h4>Já adquiriu? Conte sua experiência.</h4>
                  <label>
                    Nota
                    <select
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} estrela{n > 1 ? "s" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Comentário
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      required
                      minLength={10}
                      maxLength={2000}
                    />
                  </label>
                  <button className="btn secondary" disabled={busy}>
                    Enviar avaliação
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>
      )}
      {reader && (
        <div className="modal-backdrop">
          <section
            className="modal reader-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reader-title"
          >
            <button
              className="modal-close icon-btn"
              autoFocus
              onClick={() => setReader(null)}
              aria-label="Fechar material"
            >
              <X />
            </button>
            <span className="eyebrow">MINHA BIBLIOTECA</span>
            <h2 id="reader-title">{reader.title}</h2>
            <a
              className="btn primary"
              href={"/api/download/" + reader.product_id}
            >
              <Download size={17} /> Baixar meu arquivo
            </a>
            {reader.file_name ? (
              <div className="notice">
                Abra o arquivo baixado no leitor do seu dispositivo. Suas
                anotações ficam salvas aqui.
              </div>
            ) : (
              <pre className="free-reader">
                {products.find((p) => p.id === reader.product_id)?.preview ||
                  "Baixe o arquivo para acessar o conteúdo completo."}
              </pre>
            )}
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                action(async () => {
                  await api("study", {
                    id: reader.product_id,
                    notes,
                    progress,
                  });
                  setLibrary((await api("library")).items);
                  notify("Anotações e progresso salvos.");
                });
              }}
            >
              <label>
                Meu progresso de revisão · {progress}%
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                />
              </label>
              <label>
                Minhas anotações
                <textarea
                  rows={6}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Conexões, dúvidas e pontos para a próxima revisão…"
                  maxLength={20000}
                />
              </label>
              <button className="btn primary" disabled={busy}>
                Salvar meu estudo <Check size={16} />
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
function Cover({ p, index }: { p: Product; index: number }) {
  const tone = [
    "violet",
    "peach",
    "blue",
    "green",
    "yellow",
    "pink",
    "violet",
    "green",
  ][Math.max(index, 0) % 8];
  return (
    <div className={"cover " + tone}>
      <div className="cover-top">
        <span>
          <Cloud size={13} /> nimbus.
        </span>
        <span>{p.format.toUpperCase()}</span>
      </div>
      <div className="cover-title">
        {p.title.split(":")[0]}
        {p.title.includes(":") && (
          <small>{p.title.split(":").slice(1).join(":")}</small>
        )}
      </div>
      <div className="cover-pattern" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="cover-bottom">
        <span>{p.subject.toUpperCase()}</span>
        <ArrowUpRight size={19} />
      </div>
    </div>
  );
}
function Empty({
  icon,
  title,
  text,
  button,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  button?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty">
      <div className="round-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {button && (
        <button className="btn primary" onClick={onClick}>
          {button}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="stat">
      <span>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}
function Status({ value }: { value: string }) {
  const labels: Record<string, string> = {
    paid: "Confirmado",
    pending: "Em análise",
    failed: "Não concluído",
    refunded: "Reembolsado",
    published: "Publicado",
    draft: "Rascunho",
    rejected: "Rejeitado",
    open: "Aberto",
    closed: "Respondido",
  };
  return (
    <span className={"status status-" + value}>{labels[value] || value}</span>
  );
}
