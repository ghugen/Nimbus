"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
import {
  BookOpen,
  ArrowRight,
  Upload,
  Layers,
  Tag,
  RefreshCw,
} from "lucide-react";
import { money, type Product } from "@/lib/catalog";
type Overview = {
  from?: string;
  to?: string;
  orders: number;
  gross: number;
  nimbus_net: number;
  author_payable: number;
  finance_pending: number;
  pending_products: number;
  tickets: number;
  corrections: number;
  ideas: number;
  published: number;
  drafts: number;
};
export function AdminOverview({
  onNavigate,
  name,
}: {
  onNavigate: (path: string) => void;
  name: string;
}) {
  const [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      setData(
        (
          await callApi(
            "admin-overview?" +
              new URLSearchParams({
                ...(from ? { from } : {}),
                ...(to ? { to } : {}),
              }),
          )
        ).overview as Overview,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <form
        className="metrics-dates"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label>
          Vendas a partir de
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button className="btn secondary" disabled={busy}>
          Aplicar período
        </button>
      </form>
      <AdminOverviewView
        data={data}
        error={error}
        busy={busy}
        name={name}
        onNavigate={onNavigate}
        onRefresh={load}
      />
    </>
  );
}
export function AdminOverviewView({
  data,
  error,
  busy,
  name,
  onNavigate,
  onRefresh,
}: {
  data: Overview | null;
  error: string;
  busy: boolean;
  name: string;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="admin-overview">
      <div className="workspace-welcome">
        <div>
          <span className="eyebrow">SEU PAINEL DE TRABALHO</span>
          <h2>Olá, {name.split(" ")[0]}. Como está a Nimbus?</h2>
          <p>Vendas, publicações e atendimento em um só lugar.</p>
        </div>
        <button
          className="btn secondary small"
          onClick={onRefresh}
          disabled={busy}
        >
          <RefreshCw size={15} /> Atualizar resumo
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Carregando o resumo da operação…</p>}
      {data && (
        <>
          <div className="overview-metrics">
            {[
              ["Pedidos confirmados", String(data.orders)],
              ["Valor dos pedidos confirmados", money(data.gross)],
              ["Líquido Nimbus conciliado", money(data.nimbus_net)],
              ["Autores: liberado para repasse", money(data.author_payable)],
            ].map(([label, value]) => (
              <div className="panel" key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className="muted">
            {data.from
              ? `Vendas de ${data.from} até ${data.to}. `
              : "Valores acumulados. "}{" "}
            O líquido considera estornos registrados até agora; não inclui
            impostos e demais despesas. Saldos para repasse e pendências mostram
            a posição atual. {data.finance_pending} item(ns) aguardam
            conciliação.
          </p>
          <h3 className="subheading">O que precisa de atenção</h3>
          <div className="attention-grid">
            {[
              [
                "Materiais para aprovar",
                data.pending_products,
                "admin/aprovações",
              ],
              ["Atendimentos em aberto", data.tickets, "admin/atendimento"],
              ["Correções pendentes", data.corrections, "admin/correções"],
              ["Ideias em planejamento", data.ideas, "admin/ideias"],
            ].map(([title, count, path]) => (
              <button
                className="panel attention-card"
                key={String(title)}
                onClick={() => onNavigate(String(path))}
              >
                <strong>{count}</strong>
                <span>{title}</span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
          <p className="muted">
            {data.published} materiais publicados · {data.drafts} rascunhos.
            Catálogo demonstrativo não entra nessas contagens.
          </p>
        </>
      )}
      <h3 className="subheading">Faça o próximo movimento</h3>
      <div className="workspace-shortcuts">
        {[
          {
            label: "Publicar material",
            path: "autores/publicar",
            icon: Upload,
          },
          { label: "Criar coleção", path: "admin/coleções", icon: Layers },
          { label: "Cadastrar cupom", path: "admin/cupons", icon: Tag },
          { label: "Ver loja", path: "inicio", icon: BookOpen },
        ].map(({ label, path, icon: Icon }) => (
          <button
            className="btn secondary"
            key={path}
            onClick={() => onNavigate(path)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>
      <div className="notice">
        <strong>Preparação para vender</strong>
        <p>
          Confira pagamentos, login por e-mail, notificações e dados de
          privacidade na área Operação. As integrações dependem de configuração
          e validação antes do lançamento.
        </p>
        <button
          className="text-link"
          onClick={() => onNavigate("admin/operação")}
        >
          Verificar operação ↗
        </button>
      </div>
    </div>
  );
}
export type StudyItem = {
  product_id: string;
  title: string;
  notes?: string;
  progress?: number;
  created: string;
};
export function LearnerStart({
  items,
  onOpen,
  onExplore,
}: {
  items: StudyItem[];
  onOpen: (item: StudyItem) => void;
  onExplore: () => void;
}) {
  const next =
    items.find((x) => (x.progress || 0) > 0 && (x.progress || 0) < 100) ||
    items.find((x) => (x.progress || 0) < 100) ||
    items[0];
  return (
    <div className="study-start panel">
      <div className="study-start-icon">
        <BookOpen size={30} />
      </div>
      <div>
        <span className="eyebrow">
          {next ? "SEU PRÓXIMO ESTUDO" : "VAMOS COMEÇAR?"}
        </span>
        <h2>
          {next ? next.title : "Sua biblioteca começa com uma descoberta."}
        </h2>
        <p>
          {next
            ? `${next.progress || 0}% de revisão registrada. Continue com suas anotações e versões do material.`
            : "Conheça os PDFs gratuitos ou explore o catálogo para escolher seu primeiro material."}
        </p>
      </div>
      <button
        className="btn primary"
        onClick={() => (next ? onOpen(next) : onExplore())}
      >
        {next ? "Continuar estudando" : "Explorar materiais"}
        <ArrowRight size={17} />
      </button>
    </div>
  );
}
export function AuthorOverview({
  products,
  onNavigate,
  finance,
}: {
  products: Product[];
  onNavigate: (tab: string) => void;
  finance: { balances: { payable: number }[] };
}) {
  return (
    <>
      <div className="workspace-welcome">
        <div>
          <span className="eyebrow">SEU CONHECIMENTO PODE IR MAIS LONGE</span>
          <h2>Do rascunho à publicação.</h2>
          <p>
            Organize seus materiais, acompanhe os retornos e planeje a próxima
            criação.
          </p>
        </div>
        <button className="btn primary" onClick={() => onNavigate("publicar")}>
          <Upload size={17} />
          Publicar material
        </button>
      </div>
      <div className="overview-metrics">
        {[
          [
            "Publicados",
            products.filter((p) => p.status === "published").length,
            "materiais",
          ],
          [
            "Em análise",
            products.filter((p) => p.status === "pending").length,
            "materiais",
          ],
          [
            "Ajustes solicitados",
            products.filter((p) => p.status === "changes_requested").length,
            "materiais",
          ],
          [
            "Liberado para repasse",
            money(finance.balances.reduce((s, x) => s + x.payable, 0)),
            "vendas",
          ],
        ].map(([label, value, target]) => (
          <button
            className="panel attention-card"
            key={String(label)}
            onClick={() => onNavigate(String(target))}
          >
            <span>{label}</span>
            <strong>{value}</strong>
          </button>
        ))}
      </div>
      <div className="workspace-shortcuts">
        <button
          className="btn secondary"
          onClick={() => onNavigate("materiais")}
        >
          Meus materiais
        </button>
        <button
          className="btn secondary"
          onClick={() => onNavigate("correcoes")}
        >
          Correções dos compradores
        </button>
        <button className="btn secondary" onClick={() => onNavigate("perfil")}>
          Minha página pública
        </button>
        <button className="btn secondary" onClick={() => onNavigate("vendas")}>
          Vendas e recebimentos
        </button>
      </div>
      <p className="notice">
        Você pode comprar e publicar com a mesma conta. Cada envio passa por
        análise; o demonstrativo de recebimentos segue as condições comerciais
        aceitas.
      </p>
    </>
  );
}
