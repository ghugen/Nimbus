"use client";
import { SupportThread } from "@/components/support-thread";
import { ManagementPanel } from "@/components/management-panel";
import {
  ReviewModeration,
  VerificationPanel,
} from "@/components/editorial-plus-panel";
import { PreviewGallery } from "@/components/preview-gallery";
import { StaffRolesPanel, StaffWorkspace } from "@/components/staff-panels";
import { LicensePanel } from "@/components/license-panel";
import {
  SubscriptionPage,
  SubscriptionAdmin,
} from "@/components/subscription-panels";
import { ServicesPage, ServicesAdmin } from "@/components/service-panels";
import { LearningExperience } from "@/components/learning-experience";
import { OrderTools } from "@/components/order-tools";
import { RoadmapPanel } from "@/components/roadmap-panel";
import {
  RefundAdmin,
  OperationsTasks,
  ModerationPanel,
} from "@/components/operations-plus-panel";
import {
  ProductInformation,
  RelatedMaterials,
  FollowAuthor,
} from "@/components/product-information";
import {
  MaterialComparison,
  SavedFilters,
  PreferredTopics,
} from "@/components/catalog-tools";
import { searchMatches } from "@/lib/search";
import {
  DocumentPanel,
  IntegrationReadiness,
  InvoiceRequest,
} from "@/components/document-panels";
import {
  DemandBoard,
  PartnerPage,
  PartnerAdmin,
  InstitutionPanel,
  LaunchPanel,
} from "@/components/market-panels";
import {
  ReviewQueue,
  PermissionReview,
} from "@/components/editorial-operations";
import { StudyAssistant } from "@/components/study-assistant";
import { ContextHelp } from "@/components/context-help";
import { PdfReader } from "@/components/pdf-reader";
import {
  LibraryFilters,
  StudyOrganization,
  useLibraryOrganization,
} from "@/components/library-tools";
import {
  WorkspaceNavigation,
  AdminNavigation,
} from "@/components/workspace-navigation";
import { AdminOverview, LearnerStart } from "@/components/workspace-overviews";
import { parseNavigation, homeFor, workspaceFor } from "@/lib/navigation";
import { CommercialPlan } from "@/components/commercial-plan";
import { FreeDownloads } from "@/components/free-downloads";
import {
  CommunityPanel,
  CollectionsPanel,
  CollectionsAdmin,
  CouponsAdmin,
  CouponInput,
} from "@/components/growth-panels";
import { AuthorStudio } from "@/components/author-studio";
import {
  NotificationCenter,
  VersionList,
  AnalyticsPanel,
  OperationsPanel,
  EditorialPanel,
} from "@/components/commerce-panels";
import { MeasurementPreferences } from "@/components/measurement-preferences";
import { signedFetch, downloadPrivate, metric } from "@/lib/client-auth";
import { BrandGlyph } from "@/components/brand-glyph";
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
  staff?: { reviewer?: number; support?: number };
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
  clarity?: number;
  presentation?: number;
  response?: string;
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
  pagination?: { page: number; limit: number; total: number };
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
  discount?: number;
  total?: number;
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
  const r = await signedFetch(
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
  const [readerJump, setReaderJump] = useState({ page: 1, key: 0 });
  const [referral, setReferral] = useState<{
    code: string;
    discount: number;
    total: number;
  } | null>(null);
  const [referralCode, setReferralCode] = useState("");
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("indicacao");
    if (code) setReferralCode(code.slice(0, 40));
  }, []);
  const [authorTab, setAuthorTab] = useState("resumo");
  const [clarityRating, setClarityRating] = useState(5),
    [presentationRating, setPresentationRating] = useState(5);
  const [purchaseMode, setPurchaseMode] = useState("individual");
  const [seats, setSeats] = useState(1);
  const [giftEmail, setGiftEmail] = useState("");
  const [adminPage, setAdminPage] = useState(1);
  const [compared, setCompared] = useState<string[]>([]);
  const [preferredTopics, setPreferredTopics] = useState<string[]>([]);
  const [catalogLimit, setCatalogLimit] = useState(24);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [coupon, setCoupon] = useState<{
    code: string;
    discount: number;
    total: number;
  } | null>(null);
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
    [adminTab, setAdminTab] = useState("resumo"),
    [financeData, setFinanceData] = useState<{
      finance: FinanceReport;
      accounts: FinanceAccount[];
    } | null>(null),
    [rating, setRating] = useState(5),
    [comment, setComment] = useState(""),
    [payments, setPayments] = useState(false);
  useEffect(() => {
    setReferral(null);
  }, [cart, seats]);
  const organization = useLibraryOrganization(!!user && view === "biblioteca");
  function go(next: string) {
    window.location.hash = next;
    const route = parseNavigation(next);
    setView(route.view);
    setAdminTab(route.adminTab);
    setAuthorTab(route.authorTab);
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
    if (d.user && (!window.location.hash || window.location.hash === "#conta"))
      go(homeFor(d.user));
    setFavorites(d.favorites || []);
  }
  useEffect(() => {
    const listener = () => refresh().catch((e) => setError(e.message));
    window.addEventListener("nimbus-auth-changed", listener);
    return () => window.removeEventListener("nimbus-auth-changed", listener);
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    const change = () => {
      const route = parseNavigation(window.location.hash);
      setView(route.view);
      setAdminTab(route.adminTab);
      setAuthorTab(route.authorTab);
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
    });
  }, [view, user?.id, adminTab]);
  useEffect(() => {
    setAdminPage(1);
  }, [adminTab]);
  useEffect(() => {
    if (view !== "admin" || !user?.admin) return;
    let active = true;
    setAdmin(null);
    api("admin?section=" + encodeURIComponent(adminTab) + "&page=" + adminPage)
      .then((d) => {
        if (active) setAdmin(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [view, user?.id, adminTab, adminPage]);
  useEffect(() => {
    setCatalogLimit(24);
  }, [query, category, format, course, subject, free, preferredTopics]);

  useEffect(() => {
    if (!detail) return;
    metric(detail.id, "view");
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
        "header,main,footer,.announcement,.account-nav,.workspace-bar",
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
            (!preferredTopics.length || preferredTopics.includes(p.subject)) &&
            searchMatches(
              `${p.title} ${p.subject} ${p.author} ${p.category} ${p.course} ${p.topic || ""}`,
              query,
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
      preferredTopics,
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
    metric(p.id, "cart");
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
        href={"/entrar?destino=" + encodeURIComponent(view)}
        target="_top"
      >
        Entrar na Nimbus <ArrowUpRight size={17} />
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
          <button
            className="text-link compare-button"
            onClick={() =>
              setCompared((old) =>
                old.includes(p.id)
                  ? old.filter((x) => x !== p.id)
                  : old.length < 3
                    ? [...old, p.id]
                    : old,
              )
            }
          >
            {compared.includes(p.id) ? "✓ Na comparação" : "Comparar material"}
          </button>
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
              <BrandGlyph size={23} />
            </span>
            nimbus<span className="logo-dot">.</span>
          </a>
          <nav
            className={mobile ? "mobile-open" : ""}
            aria-label="Navegação da loja"
          >
            {[
              ["inicio", "Loja"],
              ["catalogo", "Explorar materiais"],
              ["colecoes", "Coleções"],
              ["gratuitos", "Gratuitos"],
              ["mural", "Mural"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={view === id ? "selected" : ""}
                aria-current={view === id ? "page" : undefined}
                onClick={() => go(id)}
              >
                {label}
              </button>
            ))}
            {!user && (
              <button onClick={() => go("autores")}>
                Para autores <ArrowUpRight size={12} />
              </button>
            )}
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
              <button className="account" onClick={() => go(homeFor(user))}>
                <span className="avatar">{initials(user.name)}</span>
                <span>{user.admin ? "Meu painel" : "Minha biblioteca"}</span>
              </button>
            ) : (
              <a className="btn primary small" href="/entrar" target="_top">
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
      {user && (
        <WorkspaceNavigation
          view={view}
          admin={user.admin}
          staff={!!user.staff?.reviewer || !!user.staff?.support}
          onNavigate={go}
        />
      )}
      {user && workspaceFor(view) === "estudante" && (
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
            <button
              onClick={() => go("notificacoes")}
              className={view === "notificacoes" ? "active" : ""}
            >
              <Mail size={15} /> Notificações
            </button>
            <button
              onClick={() => go("interesses")}
              className={view === "interesses" ? "active" : ""}
            >
              Sugestões
            </button>
            <button
              onClick={() => go("correcoes")}
              className={view === "correcoes" ? "active" : ""}
            >
              Minhas correções
            </button>
            <button
              onClick={() => go("licencas")}
              className={view === "licencas" ? "active" : ""}
            >
              Licenças e presentes
            </button>
            <button
              onClick={() => go("assinaturas")}
              className={view === "assinaturas" ? "active" : ""}
            >
              Assinaturas
            </button>
            <button
              onClick={() => go("servicos")}
              className={view === "servicos" ? "active" : ""}
            >
              Encontros e serviços
            </button>
          </div>
        </div>
      )}
      <main>
        {user &&
          [
            "biblioteca",
            "pedidos",
            "perfil",
            "documentos",
            "parcerias",
            "instituicoes",
          ].includes(view) && (
            <nav
              className="container studio-actions"
              aria-label="Serviços da conta"
            >
              <button className="text-link" onClick={() => go("documentos")}>
                Meus documentos
              </button>
              <button className="text-link" onClick={() => go("parcerias")}>
                Indicações e afiliados
              </button>
              <button className="text-link" onClick={() => go("instituicoes")}>
                Para instituições
              </button>
            </nav>
          )}
        {view === "conta" && !user && (
          <section className="container page-section">
            {loaded ? (
              signedOut("Entre para abrir sua área")
            ) : (
              <p role="status">Preparando sua área…</p>
            )}
          </section>
        )}
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
                    <BrandGlyph size={16} /> nimbus.
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
        {view === "catalogo" && user && (
          <div className="container catalog-tools">
            <SavedFilters
              filters={{
                query,
                category,
                course,
                subject,
                topic,
                format,
                free,
                level,
                language,
                fileType,
                minPrice,
                maxPrice,
                updatedAfter,
              }}
              onLoad={(f) => {
                if (typeof f.query === "string") setQuery(f.query);
                if (
                  typeof f.category === "string" &&
                  categories.includes(f.category)
                )
                  setCategory(f.category);
                if (typeof f.course === "string") setCourse(f.course);
                if (typeof f.subject === "string") setSubject(f.subject);
                if (typeof f.topic === "string") setTopic(f.topic);
                if (typeof f.format === "string") setFormat(f.format);
                setFree(f.free === true);
                if (typeof f.level === "string") setLevel(f.level);
                if (typeof f.language === "string") setLanguage(f.language);
                if (typeof f.fileType === "string") setFileType(f.fileType);
                if (typeof f.minPrice === "string") setMinPrice(f.minPrice);
                if (typeof f.maxPrice === "string") setMaxPrice(f.maxPrice);
                if (typeof f.updatedAfter === "string")
                  setUpdatedAfter(f.updatedAfter);
              }}
            />
            {user && (
              <PreferredTopics
                products={products}
                onApply={setPreferredTopics}
              />
            )}
          </div>
        )}
        {compared.length > 0 && (
          <div className="container compare-summary">
            <p>
              {compared.length} de 3 materiais selecionados para comparação.
            </p>
            {compared.length >= 2 ? (
              <MaterialComparison
                products={products.filter((p) => compared.includes(p.id))}
                onClose={() => setCompared([])}
              />
            ) : (
              <button className="text-link" onClick={() => setCompared([])}>
                Limpar seleção
              </button>
            )}
          </div>
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
                      {visible
                        .slice(0, catalogLimit)
                        .map((p, i) => renderCard(p, i))}
                      {visible.length > catalogLimit && (
                        <button
                          className="btn secondary"
                          onClick={() => setCatalogLimit(catalogLimit + 24)}
                        >
                          Mostrar mais materiais
                        </button>
                      )}
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
        {view === "licencas" &&
          (user ? <LicensePanel /> : signedOut("Gerencie suas licenças"))}
        {view === "assinaturas" && <SubscriptionPage signedIn={!!user} />}
        {view === "servicos" && <ServicesPage signedIn={!!user} />}
        {view === "equipe" &&
          (user ? (
            <StaffWorkspace roles={user.staff || {}} />
          ) : (
            signedOut("Área da equipe")
          ))}
        {view === "documentos" &&
          (user ? <DocumentPanel /> : signedOut("Acompanhe seus documentos"))}
        {view === "mural" && <DemandBoard signedIn={!!user} />}
        {view === "parcerias" &&
          (user ? <PartnerPage /> : signedOut("Participe das indicações"))}
        {view === "instituicoes" &&
          (user ? (
            <InstitutionPanel />
          ) : (
            signedOut("Solicite uma proposta institucional")
          ))}
        {view === "gratuitos" && (
          <>
            <div className="container">
              <a className="btn primary" href="/experimentar">
                Experimentar PDF, cartões e questões grátis ↗
              </a>
            </div>
            <FreeDownloads />
          </>
        )}
        {view === "colecoes" && <CollectionsPanel />}
        {view === "interesses" && (
          <section className="container page-section">
            {user ? (
              <CommunityPanel kind="requests" />
            ) : (
              signedOut("Sugira seu próximo material")
            )}
          </section>
        )}
        {view === "correcoes" && (
          <section className="container page-section">
            {user ? (
              <CommunityPanel kind="issues" />
            ) : (
              signedOut("Acompanhe suas correções")
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
                  <ContextHelp topic="payment" />
                  <div>
                    <span>Materiais ({cartItems.length})</span>
                    <strong>
                      {money(
                        cartItems.reduce((s, p) => s + p.price, 0) * seats,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Entrega digital</span>
                    <span>Na sua biblioteca</span>
                  </div>
                  <div className="purchase-options">
                    <label>
                      Como deseja adquirir?
                      <select
                        value={purchaseMode}
                        onChange={(e) => {
                          setPurchaseMode(e.target.value);
                          setSeats(e.target.value === "group" ? 2 : 1);
                          setCoupon(null);
                        }}
                      >
                        <option value="individual">Para mim</option>
                        <option value="group">
                          Licenças para uma turma ou grupo
                        </option>
                        <option value="gift">Presentear outra pessoa</option>
                      </select>
                    </label>
                    {purchaseMode === "group" && (
                      <label>
                        Quantidade de licenças
                        <input
                          type="number"
                          min={2}
                          max={100}
                          value={seats}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isInteger(n) && n >= 2 && n <= 100) {
                              setSeats(n);
                              setCoupon(null);
                            }
                          }}
                        />
                        <small>
                          Uma licença fica com você; distribua as demais por
                          e-mail após confirmação.
                        </small>
                      </label>
                    )}
                    {purchaseMode === "gift" && (
                      <label>
                        E-mail do destinatário
                        <input
                          type="email"
                          value={giftEmail}
                          maxLength={200}
                          onChange={(e) => setGiftEmail(e.target.value)}
                        />
                        <small>
                          O acesso será vinculado quando o destinatário entrar
                          com esse e-mail verificado.
                        </small>
                      </label>
                    )}
                  </div>
                  {user && (
                    <CouponInput
                      ids={cart}
                      seats={seats}
                      onApplied={(value) => {
                        setCoupon(value);
                        setReferral(null);
                      }}
                    />
                  )}
                  {user && (
                    <details className="referral-input">
                      <summary>Tenho um código de indicação</summary>
                      <label>
                        Código
                        <input
                          value={referralCode}
                          maxLength={40}
                          onChange={(e) => {
                            setReferralCode(e.target.value);
                            setReferral(null);
                          }}
                        />
                      </label>
                      <button
                        className="btn secondary small"
                        disabled={busy || !referralCode}
                        onClick={() =>
                          action(async () => {
                            const d = await api("referral-quote", {
                              ids: cart,
                              seats,
                              code: referralCode,
                            });
                            setReferral({
                              code: referralCode,
                              discount: Number(d.discount),
                              total: Number(d.total),
                            });
                            setCoupon(null);
                          })
                        }
                      >
                        Aplicar indicação
                      </button>
                      {referral && (
                        <button
                          className="text-link"
                          onClick={() => setReferral(null)}
                        >
                          Remover indicação
                        </button>
                      )}
                      <p>
                        Benefícios sujeitos às regras do programa. Não acumula
                        com cupom.
                      </p>
                    </details>
                  )}
                  {referral && (
                    <div>
                      <span>Indicação · {referral.code}</span>
                      <strong>−{money(referral.discount)}</strong>
                    </div>
                  )}
                  {coupon && (
                    <div>
                      <span>Desconto · {coupon.code}</span>
                      <strong>−{money(coupon.discount)}</strong>
                    </div>
                  )}
                  <div className="total">
                    <span>Total</span>
                    <strong>
                      {money(
                        coupon?.total ??
                          referral?.total ??
                          cartItems.reduce((s, p) => s + p.price, 0) * seats,
                      )}
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
                        (purchaseMode === "gift" &&
                          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(giftEmail)) ||
                        cartItems.some(
                          (p) =>
                            p.price > 0 &&
                            (p.demo || (!payments && coupon?.total !== 0)),
                        )
                      }
                      onClick={() =>
                        action(async () => {
                          const key =
                            "nimbus-checkout:" +
                            cart.toSorted().join(",") +
                            ":" +
                            (coupon?.code || referral?.code || "") +
                            ":" +
                            seats +
                            ":" +
                            (purchaseMode === "gift"
                              ? giftEmail.toLowerCase()
                              : "");
                          let request_id = sessionStorage.getItem(key);
                          if (!request_id) {
                            request_id = crypto.randomUUID();
                            sessionStorage.setItem(key, request_id);
                          }
                          const result = await api("checkout", {
                            seats,
                            gift_email:
                              purchaseMode === "gift" ? giftEmail : undefined,
                            coupon: coupon?.code,
                            referral_code: referral?.code,
                            ids: cart,
                            accepted,
                            request_id,
                          });
                          if (result.url) {
                            window.location.assign(result.url);
                            return;
                          }
                          setCart([]);
                          notify(
                            purchaseMode === "gift"
                              ? "Presente preparado. O destinatário acessará pela própria conta."
                              : seats > 1
                                ? "Licenças disponíveis para distribuição."
                                : "Material disponível na sua biblioteca!",
                          );
                          go(
                            purchaseMode === "gift" || seats > 1
                              ? "licencas"
                              : "biblioteca",
                          );
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
                      href="/entrar?destino=carrinho"
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
                <LearnerStart
                  items={library}
                  onOpen={(item) => openReader(item as LibraryItem)}
                  onExplore={() => go("gratuitos")}
                />
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
                <div className="library-search">
                  <label htmlFor="library-search">
                    Buscar na minha biblioteca
                  </label>
                  <input
                    id="library-search"
                    type="search"
                    placeholder="Título, disciplina, tema ou suas anotações…"
                    value={libraryQuery}
                    onChange={(e) => setLibraryQuery(e.target.value)}
                  />
                </div>
                <LibraryFilters
                  states={organization.states}
                  folder={organization.folder}
                  status={organization.status}
                  onFolder={organization.setFolder}
                  onStatus={organization.setStatus}
                />
                <h2 className="subheading">Continue de onde parou</h2>
                {library.length ? (
                  <div className="library-grid">
                    {library
                      .filter((item) => {
                        const state = organization.states.find(
                          (s) => s.product_id === item.product_id,
                        );
                        return (
                          (!organization.folder ||
                            state?.folder === organization.folder) &&
                          (!organization.status ||
                            (state?.status || "not_started") ===
                              organization.status)
                        );
                      })
                      .filter((item) => {
                        const p = products.find(
                          (p) => p.id === item.product_id,
                        );
                        return [
                          item.title,
                          item.notes,
                          p?.subject,
                          p?.course,
                          p?.topic,
                        ]
                          .join(" ")
                          .normalize("NFD")
                          .replace(/[\u0300-\u036f]/g, "")
                          .toLowerCase()
                          .includes(
                            libraryQuery
                              .normalize("NFD")
                              .replace(/[\u0300-\u036f]/g, "")
                              .toLowerCase(),
                          );
                      })
                      .map((item) => (
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
                            <span
                              style={{ width: (item.progress || 0) + "%" }}
                            />
                          </div>
                          <button
                            className="btn primary full"
                            onClick={() => openReader(item)}
                          >
                            Abrir material <ArrowUpRight size={16} />
                          </button>
                          <button
                            className="text-link"
                            onClick={() =>
                              action(() =>
                                downloadPrivate(
                                  "/api/download/" + item.product_id,
                                ),
                              )
                            }
                          >
                            <Download size={15} /> Baixar arquivo
                          </button>
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
                      <OrderTools order={o} />
                      {o.status === "paid" && o.total > 0 && (
                        <InvoiceRequest orderId={o.id} />
                      )}
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
            <span className="eyebrow">CRIE, COMPARTILHE, RECEBA</span>
            <h1>Espaço do autor.</h1>
            {user ? (
              <AuthorStudio
                initialTab={authorTab}
                onTabChange={(tab) => go("autores/" + tab)}
              />
            ) : (
              signedOut("Publique seus materiais")
            )}
          </section>
        )}
        {view === "notificacoes" &&
          (user ? (
            <NotificationCenter />
          ) : (
            signedOut("Acompanhe suas notificações")
          ))}
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
                <div className="admin-shell">
                  <AdminNavigation active={adminTab} onNavigate={go} />
                  <div className="admin-content">
                    {adminTab === "resumo" && (
                      <AdminOverview onNavigate={go} name={user.name} />
                    )}
                    {adminTab === "relatórios" && <ManagementPanel />}
                    {adminTab === "melhorias" && <RoadmapPanel />}
                    {adminTab === "documentos" && <DocumentPanel admin />}
                    {adminTab === "conexoes" && <IntegrationReadiness />}
                    {adminTab === "lancamento" && <LaunchPanel />}
                    {adminTab === "parcerias" && <PartnerAdmin />}
                    {adminTab === "instituicoes" && <InstitutionPanel admin />}
                    {adminTab === "mural" && <DemandBoard signedIn admin />}
                    {adminTab === "revisoes" && <ReviewQueue />}
                    {adminTab === "tarefas" && <OperationsTasks />}
                    {adminTab === "reembolsos" && <RefundAdmin />}
                    {adminTab === "perguntas" && (
                      <ModerationPanel kind="questions" />
                    )}
                    {adminTab === "denúncias" && (
                      <ModerationPanel kind="reports" />
                    )}
                    {adminTab === "alertas" && (
                      <ModerationPanel kind="events" />
                    )}
                    {adminTab === "equipe" && (
                      <>
                        <StaffRolesPanel />
                        <PermissionReview />
                      </>
                    )}
                    {adminTab === "planos" && <SubscriptionAdmin />}
                    {adminTab === "serviços" && <ServicesAdmin />}
                    {adminTab === "avaliações" && <ReviewModeration admin />}
                    {adminTab === "verificações" && <VerificationPanel />}
                    {adminTab === "ideias" && <CommercialPlan />}
                    {adminTab === "cupons" && <CouponsAdmin />}
                    {adminTab === "coleções" && <CollectionsAdmin />}
                    {adminTab === "sugestões" && (
                      <CommunityPanel kind="requests" manage />
                    )}
                    {adminTab === "correções" && (
                      <CommunityPanel kind="issues" manage />
                    )}
                    {adminTab === "aprovações" && (
                      <EditorialPanel
                        products={admin.products}
                        onRefresh={async () => {
                          setAdmin(
                            await api(
                              "admin?section=" +
                                encodeURIComponent(adminTab) +
                                "&page=" +
                                adminPage,
                            ),
                          );
                          await loadCatalog();
                        }}
                      />
                    )}
                    {adminTab === "indicadores" && <AnalyticsPanel />}
                    {adminTab === "operação" && <OperationsPanel />}
                    {adminTab === "privacidade" && (
                      <PrivacyCenter admin signedIn />
                    )}
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
                                        Revisar arquivo{" "}
                                        <ArrowUpRight size={12} />
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
                                            setAdmin(
                                              await api(
                                                "admin?section=" +
                                                  encodeURIComponent(adminTab) +
                                                  "&page=" +
                                                  adminPage,
                                              ),
                                            );
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
                                            setAdmin(
                                              await api(
                                                "admin?section=" +
                                                  encodeURIComponent(adminTab) +
                                                  "&page=" +
                                                  adminPage,
                                              ),
                                            );
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
                        {!admin.orders.length && (
                          <p>Nenhum pedido registrado.</p>
                        )}
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
                                setAdmin(
                                  await api(
                                    "admin?section=" +
                                      encodeURIComponent(adminTab) +
                                      "&page=" +
                                      adminPage,
                                  ),
                                );
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
                            <SupportThread id={t.id} readOnly />
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
                  </div>
                </div>
                {admin.pagination &&
                  admin.pagination.total > admin.pagination.limit && (
                    <nav
                      className="pagination-controls"
                      aria-label="Paginação administrativa"
                    >
                      <button
                        className="btn secondary small"
                        disabled={adminPage <= 1}
                        onClick={() => setAdminPage(adminPage - 1)}
                      >
                        Anterior
                      </button>
                      <span>
                        Página {adminPage} de{" "}
                        {Math.ceil(
                          admin.pagination.total / admin.pagination.limit,
                        )}
                      </span>
                      <button
                        className="btn secondary small"
                        disabled={
                          adminPage * admin.pagination.limit >=
                          admin.pagination.total
                        }
                        onClick={() => setAdminPage(adminPage + 1)}
                      >
                        Próxima
                      </button>
                    </nav>
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
                        Pedido relacionado (opcional)
                        <input
                          name="order_id"
                          maxLength={100}
                          placeholder="Código completo do pedido"
                        />
                      </label>
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
                        <SupportThread id={t.id} />
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
                  A Nimbus registra códigos individuais de cópia, indicações e
                  solicitações institucionais para operar os recursos
                  contratados. A busca de trechos usa o material autorizado.
                  Explicações por IA, quando habilitadas, exigem autorização do
                  autor e seu consentimento para enviar pergunta e trechos ao
                  provedor; perguntas e respostas não são armazenadas pela
                  Nimbus.
                </p>
                <p>
                  Quando ativado, o checkout envia à Stripe o e-mail e os itens
                  do pedido. Os arquivos são armazenados em área protegida e sua
                  entrega depende de autorização no servidor.
                </p>
                <h2>Medição opcional</h2>
                <p>
                  Quando você permite, contamos visualizações, prévias e adições
                  ao carrinho. Um identificador temporário da sessão é
                  transformado em hash por evento, material e dia; o
                  identificador original não é gravado no banco. Os relatórios
                  são agregados. Você pode desativar a medição abaixo a qualquer
                  momento para eventos futuros.
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
                  O acesso disponível utiliza Sites/ChatGPT e, quando
                  configurado, Clerk para login por e-mail. Avisos transacionais
                  utilizam Resend quando ativado; ficam também registrados na
                  conta. Banco e arquivos utilizam serviços Cloudflare.
                  Pagamentos, quando ativados, utilizam Stripe. Fontes visuais
                  são carregadas pelo Google Fonts, o que envolve comunicação do
                  navegador com esse fornecedor. A operação deve validar as
                  condições contratuais e eventuais transferências
                  internacionais desses serviços.
                </p>
                <p>
                  Materiais enviados não devem conter dados pessoais de
                  terceiros sem fundamento e autorização aplicáveis. Não envie
                  prontuários identificados, listas de alunos, documentos
                  pessoais ou imagens identificáveis sem análise e permissão
                  adequadas. Curso e instituição no perfil são opcionais.
                </p>
                <MeasurementPreferences always />
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
          "licencas",
          "assinaturas",
          "servicos",
          "equipe",
          "conta",
          "gratuitos",
          "colecoes",
          "interesses",
          "correcoes",
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
          "notificacoes",
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
      <MeasurementPreferences />
      <footer>
        <div className="container footer-grid">
          <div>
            <a className="logo" href="#inicio">
              <span className="logo-mark">
                <BrandGlyph size={23} />
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
            <button onClick={() => go("gratuitos")}>
              Baixar PDFs gratuitos
            </button>
            <button onClick={() => go("colecoes")}>
              Coleções por disciplina
            </button>
            <button onClick={() => go("interesses")}>Sugira um material</button>
            <button onClick={() => go("correcoes")}>Minhas correções</button>
            <button onClick={() => go("assinaturas")}>Planos e clubes</button>
            <button onClick={() => go("servicos")}>Encontros e serviços</button>
            <button onClick={() => go("parcerias")}>
              Indicações e afiliados
            </button>
            <button onClick={() => go("instituicoes")}>
              Para instituições
            </button>
            <a href="/experimentar">Experimente grátis</a>
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
              <BrandGlyph size={21} />
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
              <a
                className="btn secondary small"
                href={"/materiais/" + detail.id}
              >
                Abrir página do material ↗
              </a>
              {detail.author_slug && (
                <a
                  className="text-link"
                  href={"/autores/" + detail.author_slug}
                >
                  Ver página do autor
                </a>
              )}
              {detail.public_download && (
                <a
                  className="btn primary"
                  href={detail.public_download}
                  download
                >
                  Baixar PDF gratuito · sem cadastro
                </a>
              )}
              <pre>{detail.preview}</pre>
              <PreviewGallery
                id={detail.id}
                count={detail.preview_count || 0}
                title={detail.title}
              />
              {detail.objectives && (
                <>
                  <h3>O que você vai aprender</h3>
                  <p className="pre-line">{detail.objectives}</p>
                </>
              )}
              {detail.toc && (
                <>
                  <h3>Sumário</h3>
                  <p className="pre-line">{detail.toc}</p>
                </>
              )}
              {detail.sources && (
                <>
                  <h3>Referências</h3>
                  <p className="pre-line">{detail.sources}</p>
                </>
              )}
              {detail.reviewed_by && (
                <p className="notice">
                  Revisado por {detail.reviewed_by} em{" "}
                  {date(detail.reviewed_at || "")}
                </p>
              )}
            </div>
            <ProductInformation product={detail} />
            {detail.author_slug && <FollowAuthor slug={detail.author_slug} />}
            <RelatedMaterials productId={detail.id} />
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
                    {r.clarity && (
                      <small>
                        Clareza: {r.clarity}/5 · Apresentação:{" "}
                        {r.presentation || "—"}/5
                      </small>
                    )}
                    {r.response && (
                      <p className="notice">
                        Resposta da autoria/operação: {r.response}
                      </p>
                    )}
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
                      await api("reviews", {
                        id: detail.id,
                        rating,
                        comment,
                        clarity: clarityRating,
                        presentation: presentationRating,
                      });
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
                  <div className="form-row">
                    <label>
                      Clareza
                      <select
                        value={clarityRating}
                        onChange={(e) =>
                          setClarityRating(Number(e.target.value))
                        }
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n}/5
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Apresentação
                      <select
                        value={presentationRating}
                        onChange={(e) =>
                          setPresentationRating(Number(e.target.value))
                        }
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n}/5
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
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
            <button
              className="btn primary"
              onClick={() =>
                action(() =>
                  downloadPrivate("/api/download/" + reader.product_id),
                )
              }
            >
              <Download size={17} /> Baixar meu arquivo
            </button>
            <LearningExperience productId={reader.product_id} />
            {(reader.file_name?.toLowerCase().endsWith(".pdf") ||
              products.find((p) => p.id === reader.product_id)
                ?.public_download) && (
              <>
                <PdfReader productId={reader.product_id} jump={readerJump} />
                <StudyAssistant
                  productId={reader.product_id}
                  onPage={(page) => setReaderJump({ page, key: Date.now() })}
                />
                <ContextHelp topic="reader" />
              </>
            )}
            <StudyOrganization
              productId={reader.product_id}
              onSaved={() => {
                organization.refresh();
              }}
            />
            <VersionList productId={reader.product_id} />
            <CommunityPanel kind="issues" productId={reader.product_id} />
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
  if (p.has_cover)
    return (
      <div className="cover custom-cover">
        <img
          src={"/api/asset/" + p.id + "/cover"}
          alt={"Capa de " + p.title}
          loading="lazy"
        />
      </div>
    );
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
          <BrandGlyph size={13} /> nimbus.
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
