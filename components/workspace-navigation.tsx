"use client";
import { useRef } from "react";
import { Store, Library, PenLine, Settings, ArrowUpRight } from "lucide-react";
import { adminGroups, workspaceFor } from "@/lib/navigation";
export function WorkspaceNavigation({
  view,
  admin,
  staff = false,
  onNavigate,
}: {
  view: string;
  admin: boolean;
  staff?: boolean;
  onNavigate: (path: string) => void;
}) {
  const area = workspaceFor(view);
  return (
    <div className="workspace-bar">
      <nav
        className="container workspace-switch"
        aria-label="Alternar área da Nimbus"
      >
        {[
          { id: "loja", path: "inicio", label: "Loja", icon: Store },
          {
            id: "estudante",
            path: "biblioteca",
            label: "Minha biblioteca",
            icon: Library,
          },
          {
            id: "autor",
            path: "autores",
            label: "Espaço do autor",
            icon: PenLine,
          },
          ...(staff && !admin
            ? [
                {
                  id: "staff",
                  path: "equipe",
                  label: "Área da equipe",
                  icon: Settings,
                },
              ]
            : []),
          ...(admin
            ? [
                {
                  id: "admin",
                  path: "admin",
                  label: "Administração",
                  icon: Settings,
                },
              ]
            : []),
        ].map(({ id, path, label, icon: Icon }) => (
          <button
            key={id}
            aria-current={area === id ? "page" : undefined}
            className={area === id ? "current" : ""}
            onClick={() => onNavigate(path)}
          >
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="container workspace-context">
        <span>
          {area === "loja"
            ? "LOJA NIMBUS"
            : area === "estudante"
              ? "ÁREA DO ESTUDANTE"
              : area === "autor"
                ? "ESPAÇO DO AUTOR"
                : area === "staff"
                  ? "ÁREA DA EQUIPE"
                  : "ADMINISTRAÇÃO"}
        </span>
        <small>
          {area === "loja"
            ? "Explore, conheça e escolha seu próximo material."
            : area === "estudante"
              ? "Seus materiais e seu próximo estudo."
              : area === "autor"
                ? "Publique, acompanhe a revisão e veja suas vendas."
                : "Acompanhe a operação e escolha o que precisa de atenção."}
        </small>
      </div>
    </div>
  );
}
export function AdminNavigation({
  active,
  onNavigate,
}: {
  active: string;
  onNavigate: (path: string) => void;
}) {
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const links = adminGroups.map((group) => (
    <div key={group.label}>
      <span>{group.label}</span>
      {group.items.map(([id, label]) => (
        <button
          key={id}
          aria-current={active === id ? "page" : undefined}
          className={active === id ? "active" : ""}
          onClick={() => {
            onNavigate("admin/" + id);
            mobileMenu.current?.removeAttribute("open");
          }}
        >
          {label}
          <ArrowUpRight size={13} />
        </button>
      ))}
    </div>
  ));
  const activeLabel =
    adminGroups.flatMap((g) => g.items).find(([id]) => id === active)?.[1] ||
    "Resumo";
  return (
    <aside className="admin-navigation">
      <nav
        className="admin-nav desktop-admin-nav"
        aria-label="Seções da administração"
      >
        {links}
      </nav>
      <details className="mobile-admin-nav" ref={mobileMenu}>
        <summary>
          Menu da administração <strong>{activeLabel}</strong>
        </summary>
        <nav
          className="admin-nav"
          aria-label="Seções da administração no celular"
        >
          {links}
        </nav>
      </details>
    </aside>
  );
}
