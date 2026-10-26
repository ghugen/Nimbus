import {
  rows,
  run,
  now,
  fail,
  type FeatureRuntime,
  type FeatureUser,
} from "./feature-db";
export async function inspectPdf(data: Uint8Array) {
  const { PDFDocument } = await import("pdf-lib");
  try {
    const doc = await PDFDocument.load(data, { updateMetadata: false });
    if (doc.isEncrypted || doc.getPageCount() < 1 || doc.getPageCount() > 5000)
      fail("PDF protegido ou quantidade de páginas fora do limite.");
    return { pages: doc.getPageCount() };
  } catch (e) {
    if ((e as { status?: number }).status) throw e;
    fail(
      "Não foi possível ler a estrutura do PDF. Envie um PDF válido e sem senha.",
    );
  }
}
export async function copyPdf(
  e: FeatureRuntime,
  u: { id: string },
  productId: string,
  fileKey: string,
  fileName: string,
  original: ReadableStream | BodyInit,
  access: Record<string, unknown>,
) {
  const orderId = String(access.order_id || ""),
    paid =
      orderId.startsWith("subscription:") ||
      Number(
        (
          await rows(
            e,
            "SELECT total FROM orders WHERE id=? AND status='paid'",
            orderId,
          )
        )[0]?.total || 0,
      ) > 0;
  const setting = (
    await rows(
      e,
      "SELECT watermark FROM product_policies WHERE product_id=?",
      productId,
    )
  )[0];
  if (
    !paid ||
    !fileName.toLowerCase().endsWith(".pdf") ||
    setting?.watermark === 0
  )
    return { body: original, marked: false };
  const bytes = new Uint8Array(
    await new Response(original as BodyInit).arrayBuffer(),
  );
  if (bytes.length > 10 * 1024 * 1024)
    return { body: bytes, marked: false, reason: "size_limit" };
  try {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib"),
      doc = await PDFDocument.load(bytes, { updateMetadata: false });
    if (doc.isEncrypted || doc.getPageCount() > 200)
      return { body: bytes, marked: false, reason: "unsupported_pdf" };
    const id = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(
              [orderId, u.id, productId, fileKey].join(":"),
            ),
          ),
        ),
      )
        .map((n) => n.toString(16).padStart(2, "0"))
        .join(""),
      code = id.slice(0, 24).toUpperCase(),
      font = await doc.embedFont(StandardFonts.Helvetica);
    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();
      page.drawText("Nimbus | copia " + code, {
        x: Math.max(8, width / 2 - 100),
        y: Math.max(5, Math.min(12, height / 20)),
        font,
        size: 7,
        color: rgb(0.3, 0.25, 0.4),
        opacity: 0.75,
      });
    }
    const output = await doc.save();
    await run(
      e,
      "INSERT OR IGNORE INTO download_copies(id,copy_code,user_id,order_id,product_id,file_key,created) VALUES(?,?,?,?,?,?,?)",
      id,
      code,
      u.id,
      orderId,
      productId,
      fileKey,
      now(),
    );
    return { body: output, marked: true };
  } catch {
    return { body: bytes, marked: false, reason: "processing_failed" };
  }
}
export type SourcePage = { page: number; text: string };
export async function indexPdf(
  e: FeatureRuntime,
  fileKey: string,
): Promise<SourcePage[]> {
  const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(fileKey),
        ),
      ),
    )
      .map((n) => n.toString(16).padStart(2, "0"))
      .join(""),
    cacheKey = "study-index/" + hash + ".json",
    cached = await e.BUCKET.get(cacheKey);
  if (cached) {
    const a = JSON.parse(
      await new Response(cached.body as BodyInit).text(),
    ) as SourcePage[];
    if (Array.isArray(a)) return a;
  }
  const source = await e.BUCKET.get(fileKey);
  if (!source) fail("Arquivo indisponível.", 404);
  const bytes = new Uint8Array(
    await new Response(source.body as BodyInit).arrayBuffer(),
  );
  if (bytes.length > 8 * 1024 * 1024)
    fail(
      "O assistente atende PDFs de até 8 MB. O download continua disponível.",
      422,
    );
  const { getDocumentProxy } = await import("unpdf");
  let doc: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  try {
    doc = await getDocumentProxy(bytes, {
      maxImageSize: 4194304,
      disableFontFace: true,
      useSystemFonts: false,
      standardFontDataUrl: undefined,
      cMapUrl: undefined,
    });
    if (doc.numPages > 200)
      fail("O assistente atende PDFs de até duzentas páginas.", 422);
    const pages: SourcePage[] = [],
      start = Date.now();
    let chars = 0;
    for (let page = 1; page <= doc.numPages; page++) {
      if (Date.now() - start > 12000)
        fail(
          "A extração levou mais tempo que o permitido. Use o leitor ou consulte o suporte.",
          422,
        );
      const p = await doc.getPage(page),
        content = await p.getTextContent(),
        text = content.items
          .map((x) => ("str" in x ? x.str : ""))
          .join(" ")
          .slice(0, 12000);
      chars += text.length;
      if (chars > 600000)
        fail("Este PDF excede o limite de texto do assistente.", 422);
      pages.push({ page, text });
    }
    await e.BUCKET.put(cacheKey, JSON.stringify(pages), {
      httpMetadata: { contentType: "application/json" },
    });
    return pages;
  } catch (e) {
    if ((e as { status?: number }).status) throw e;
    return fail(
      "Não foi possível extrair o texto deste PDF. PDFs digitalizados precisam de OCR.",
      422,
    );
  } finally {
    await doc?.loadingTask.destroy();
  }
}
