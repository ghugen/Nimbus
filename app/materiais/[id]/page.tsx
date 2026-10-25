import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import {
  publicProduct,
  publicDTO,
  type StoreRuntime,
} from "@/lib/catalog-services";
import { PublicMaterial } from "@/components/public-material";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const p = await publicProduct(env as unknown as StoreRuntime, id);
  return {
    title: p ? `${p.title} | Nimbus` : "Material não encontrado | Nimbus",
    description: p?.description,
    alternates: { canonical: `/materiais/${encodeURIComponent(id)}` },
    openGraph: p ? { title: p.title, description: p.description } : undefined,
  };
}
export default async function MaterialPage({ params }: Props) {
  const { id } = await params;
  const p = await publicProduct(env as unknown as StoreRuntime, id);
  if (!p) notFound();
  return <PublicMaterial product={publicDTO(p)} />;
}
