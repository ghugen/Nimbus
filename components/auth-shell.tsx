"use client";
import {
  useEffect,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { ClerkProvider, useAuth } from "@clerk/react";
import { setTokenProvider } from "@/lib/client-auth";
const Config = createContext<string | null | undefined>(undefined);
export const useAuthConfig = () => useContext(Config);
function Session() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  useEffect(() => {
    if (!isLoaded) return;
    setTokenProvider(() => getToken());
    window.dispatchEvent(new Event("nimbus-auth-changed"));
    return () => setTokenProvider(null);
  }, [isLoaded, isSignedIn, getToken]);
  return null;
}
export function AuthShell({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d: unknown) => setKey((d as { clerkKey: string | null }).clerkKey))
      .catch(() => setKey(null));
  }, []);
  return (
    <Config.Provider value={key}>
      {key ? (
        <ClerkProvider publishableKey={key}>
          <Session />
          {children}
        </ClerkProvider>
      ) : (
        children
      )}
    </Config.Provider>
  );
}
