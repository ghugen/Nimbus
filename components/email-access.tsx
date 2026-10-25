"use client";
import { useEffect, useState } from "react";
import { SignIn, SignOutButton, useAuth } from "@clerk/react";
import { useAuthConfig } from "./auth-shell";
import { safeReturnTarget } from "@/lib/navigation";
import { setTokenProvider } from "@/lib/client-auth";
function Bridge({ target }: { target: string }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  useEffect(() => {
    if (!isLoaded) return;
    setTokenProvider(() => getToken());
    window.dispatchEvent(new Event("nimbus-auth-changed"));
    return () => setTokenProvider(null);
  }, [isLoaded, isSignedIn, getToken]);
  return isSignedIn ? (
    <div className="panel">
      <p>Você está conectado pelo acesso de e-mail.</p>
      <a className="btn primary" href={"/#" + target}>
        Abrir minha área
      </a>
      <SignOutButton redirectUrl="/">
        <button className="btn secondary">Sair deste acesso</button>
      </SignOutButton>
    </div>
  ) : (
    <SignIn routing="hash" fallbackRedirectUrl={"/#" + target} />
  );
}
export function EmailAccess() {
  const key = useAuthConfig();
  const [target, setTarget] = useState("conta");
  useEffect(() => {
    setTarget(
      safeReturnTarget(
        new URLSearchParams(window.location.search).get("destino"),
      ),
    );
  }, []);
  if (key === undefined) return <p>Carregando opções de acesso…</p>;
  return (
    <section className="container page-section narrow">
      <span className="eyebrow">SEU ACESSO À NIMBUS</span>
      <h1>Entre para continuar.</h1>
      {key ? (
        <Bridge target={target} />
      ) : (
        <div className="notice">
          O acesso por e-mail está preparado e aguarda configuração do provedor.
          Enquanto isso, utilize o acesso disponível abaixo.
        </div>
      )}
      <div className="panel">
        <h3>Acesso com ChatGPT</h3>
        <a
          className="btn secondary"
          href={
            "/signin-with-chatgpt?return_to=" +
            encodeURIComponent("/#" + target)
          }
          target="_top"
        >
          Continuar com ChatGPT
        </a>
        <p className="muted">
          Contas de provedores diferentes não são mescladas automaticamente,
          mesmo quando usam o mesmo e-mail.
        </p>
      </div>
    </section>
  );
}
