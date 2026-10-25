import type { Metadata } from "next";
import "./globals.css";
import {AuthShell} from "@/components/auth-shell";
export const metadata: Metadata = {
  title: "Nimbus — Conhecimento que fica",
  description:
    "Encontre resumos, mapas mentais e materiais acadêmicos. Organize sua próxima conquista com a Nimbus.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><AuthShell>{children}</AuthShell></body>
    </html>
  );
}
