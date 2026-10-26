import { guidePages } from "@/lib/study-demo";
import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import {
  publicProduct,
  publicDTO,
  type StoreRuntime,
} from "@/lib/catalog-services";
import { AccessibleSample } from "@/components/experience-panels";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Amostra em texto | Nimbus",
  robots: { index: false, follow: true },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    e = env as unknown as StoreRuntime,
    p = await publicProduct(e, id);
  if (!p) notFound();
  const x = await e.DB.prepare(
    "SELECT sample_descriptions FROM product_experience WHERE product_id=?",
  )
    .bind(id)
    .first<{ sample_descriptions: string }>();
  let descriptions: string[] = [];
  try {
    descriptions = JSON.parse(x?.sample_descriptions || "[]");
  } catch {}
  const sample = publicDTO(p),
    guide = guidePages(id);
  if (guide.length) {
    sample.preview = guide[0].text;
    sample.toc = guide
      .map((page, index) => `${index + 1}. ${page.text.split("\n")[0]}`)
      .join("\n");
  }
  return <AccessibleSample product={sample} descriptions={descriptions} />;
}
