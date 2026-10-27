import type { Metadata } from "next";
import "./globals.css";
import { AuthShell } from "@/components/auth-shell";
export const metadata: Metadata = {
  title: "Nimbus — Conhecimento que fica",
  description:
    "Biblioteca acadêmica em expansão. Baixe guias gratuitos sem cadastro e organize seus estudos com a Sofia, assistente da Nimbus.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthShell>{children}</AuthShell>
      </body>
    </html>
  );
}
