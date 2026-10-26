"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { signedFetch } from "@/lib/client-auth";
import { callApi } from "./commerce-panels";
type Annotation = { id: string; page: number; kind: string; text: string };
export function PdfReader({
  productId,
  publicSource,
  jump,
}: {
  productId: string;
  publicSource?: string;
  jump?: {page:number;key:number};
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null),
    [page, setPage] = useState(1),
    [zoom, setZoom] = useState(100),
    [stageWidth, setStageWidth] = useState(700),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [text, setText] = useState(""),
    [annotations, setAnnotations] = useState<Annotation[]>([]),
    [query, setQuery] = useState(""),
    [hits, setHits] = useState<{ page: number; text: string }[]>([]),
    [searching, setSearching] = useState(false),
    [note, setNote] = useState(""),
    [kind, setKind] = useState("note");
  const canvas = useRef<HTMLCanvasElement>(null),
    box = useRef<HTMLDivElement>(null),
    searchRun = useRef(0);
  const privateMode = !publicSource;
  useEffect(()=>{if(doc&&jump)setPage(Math.max(1,Math.min(doc.numPages,jump.page)));},[jump,doc]);
  async function refreshNotes() {
    if (privateMode)
      setAnnotations(
        (await callApi("page-annotations?id=" + encodeURIComponent(productId)))
          .annotations as Annotation[],
      );
  }
  useEffect(() => {
    let alive = true,
      loaded: PDFDocumentProxy | undefined;
    const abort = new AbortController();
    setDoc(null);
    setError("");
    setPage(1);
    setAnnotations([]);
    searchRun.current++;
    (async () => {
      try {
        const [r, state] = await Promise.all([
          signedFetch(
            publicSource || "/api/download/" + encodeURIComponent(productId),
            { signal: abort.signal },
          ),
          privateMode
            ? callApi("reader-state?id=" + encodeURIComponent(productId))
            : Promise.resolve({ state: { page: 1, zoom: 100 } }),
        ]);
        if (!r.ok)
          throw Error(
            "Não foi possível abrir o arquivo. Verifique seu acesso ou use o download.",
          );
        const bytes = new Uint8Array(await r.arrayBuffer());
        if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
          throw Error(
            "Este arquivo não é um PDF. Utilize o botão de download para abrir no aplicativo adequado.",
          );
        const pdf = await import("pdfjs-dist");
        pdf.GlobalWorkerOptions.workerSrc = `/pdfjs-worker-${pdf.version}.mjs`;
        loaded = await pdf.getDocument({ data: bytes, enableXfa: false })
          .promise;
        if (!alive) {
          await loaded.loadingTask.destroy();
          return;
        }
        const s = state.state as { page: number; zoom: number };
        setPage(Math.max(1, Math.min(s.page || 1, loaded.numPages)));
        setZoom(s.zoom || 100);
        setDoc(loaded);
        await refreshNotes();
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
      abort.abort();
      searchRun.current++;
      loaded?.loadingTask.destroy().catch(() => {});
    };
  }, [productId, publicSource]);
  useEffect(() => {
    if (!doc || !box.current) return;
    const measure = () => {
      if (!box.current) return;
      const style = getComputedStyle(box.current);
      setStageWidth(
        Math.max(
          100,
          box.current.clientWidth -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight),
        ),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box.current);
    return () => observer.disconnect();
  }, [doc]);
  useEffect(() => {
    if (!doc) return;
    let alive = true,
      task: RenderTask | undefined;
    (async () => {
      try {
        const p = await doc.getPage(page);
        if (!alive || !canvas.current) return;
        const base = p.getViewport({ scale: 1 }),
          width = Math.min(stageWidth, 1000),
          viewport = p.getViewport({
            scale: ((width / base.width) * zoom) / 100,
          });
        const c = canvas.current;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        c.width = Math.floor(viewport.width * ratio);
        c.height = Math.floor(viewport.height * ratio);
        c.style.width = viewport.width + "px";
        c.style.height = viewport.height + "px";
        const context = c.getContext("2d");
        if (!context)
          throw Error(
            "Seu navegador não disponibilizou o leitor. Use o download.",
          );
        task = p.render({
          canvas: c,
          canvasContext: context,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        await task.promise;
        const content = await p.getTextContent();
        if (alive)
          setText(
            content.items.map((x) => ("str" in x ? x.str : "")).join(" "),
          );
      } catch (e) {
        if (alive && (e as Error).name !== "RenderingCancelledException")
          setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
      task?.cancel();
    };
  }, [doc, page, zoom, stageWidth]);
  useEffect(() => {
    if (!doc || !privateMode) return;
    const timeout = setTimeout(() => {
      callApi("reader-state", { product_id: productId, page, zoom }).catch(
        (e) => setMessage("A página não foi sincronizada: " + e.message),
      );
    }, 600);
    return () => clearTimeout(timeout);
  }, [doc, page, zoom, productId, privateMode]);
  async function search() {
    if (!doc || query.trim().length < 2) return;
    const current = ++searchRun.current;
    setSearching(true);
    const result: { page: number; text: string }[] = [];
    try {
      for (let i = 1; i <= doc.numPages; i++) {
        if (current !== searchRun.current) return;
        const p = await doc.getPage(i),
          c = await p.getTextContent(),
          t = c.items.map((x) => ("str" in x ? x.str : "")).join(" "),
          at = t
            .toLocaleLowerCase("pt-BR")
            .indexOf(query.toLocaleLowerCase("pt-BR"));
        if (at >= 0)
          result.push({
            page: i,
            text: t.slice(Math.max(0, at - 50), at + query.length + 90),
          });
        if (i % 10 === 0)
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }
      if (current === searchRun.current) setHits(result);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      if (current === searchRun.current) setSearching(false);
    }
  }
  return (
    <section className="pdf-reader" aria-label="Leitor de PDF">
      <h3>Leia aqui, no seu ritmo.</h3>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {!doc && !error && <p role="status">Preparando o leitor…</p>}
      {doc && (
        <>
          <div className="reader-toolbar">
            <button
              className="btn secondary small"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              aria-label="Página anterior"
            >
              ←
            </button>
            <label>
              Página
              <input
                type="number"
                min={1}
                max={doc.numPages}
                value={page}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n >= 1 && n <= doc.numPages)
                    setPage(n);
                }}
              />
            </label>
            <span>de {doc.numPages}</span>
            <button
              className="btn secondary small"
              disabled={page >= doc.numPages}
              onClick={() => setPage(page + 1)}
              aria-label="Próxima página"
            >
              →
            </button>
            <label>
              Zoom
              <select
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              >
                {[50, 75, 100, 125, 150, 200].map((z) => (
                  <option key={z} value={z}>
                    {z}%
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="reader-canvas" ref={box}>
            <canvas
              ref={canvas}
              role="img"
              aria-label={
                "Página " +
                page +
                " do material. O texto extraído está disponível abaixo."
              }
            />
          </div>
          <details>
            <summary>Texto da página para leitura e seleção</summary>
            <p
              className="reader-text"
              onPointerUp={() => {
                const selection = window.getSelection()?.toString();
                if (selection && selection.length <= 5000) {
                  setKind("highlight");
                  setNote(selection);
                }
              }}
            >
              {text ||
                "Sem texto extraível nesta página. O arquivo pode ser uma imagem digitalizada."}
            </p>
          </details>
          <form
            className="reader-search"
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
          >
            <label>
              Buscar no documento
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                minLength={2}
                maxLength={100}
                placeholder="Termo ou trecho"
              />
            </label>
            <button className="btn secondary small" disabled={searching}>
              {searching ? "Pesquisando…" : "Buscar"}
            </button>
          </form>
          <div className="reader-hits" aria-live="polite">
            {hits.map((h) => (
              <button key={h.page} onClick={() => setPage(h.page)}>
                Página {h.page} · {h.text}
              </button>
            ))}
          </div>
          {privateMode && (
            <>
              <form
                className="form page-note"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await callApi("page-annotations", {
                      product_id: productId,
                      page,
                      kind,
                      text: note,
                    });
                    setNote("");
                    await refreshNotes();
                    setMessage("Registro salvo na página " + page + ".");
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                <div className="form-row">
                  <label>
                    Registro na página {page}
                    <select
                      value={kind}
                      onChange={(e) => setKind(e.target.value)}
                    >
                      <option value="note">Anotação</option>
                      <option value="bookmark">Marcador</option>
                      <option value="highlight">Trecho destacado</option>
                    </select>
                  </label>
                </div>
                <label>
                  Texto
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={5000}
                    required
                    placeholder="Selecione um trecho no texto extraído acima ou escreva sua anotação."
                  />
                </label>
                <button className="btn secondary small">Salvar registro</button>
              </form>
              <details className="reader-notes" open={annotations.length > 0}>
                <summary>
                  Meus marcadores, anotações e trechos ({annotations.length})
                </summary>
                {annotations.map((a) => (
                  <article key={a.id} className={"page-annotation " + a.kind}>
                    <button
                      className="text-link"
                      onClick={() => setPage(Math.min(a.page, doc.numPages))}
                    >
                      Página {a.page} ·{" "}
                      {a.kind === "bookmark"
                        ? "Marcador"
                        : a.kind === "highlight"
                          ? "Trecho"
                          : "Anotação"}
                    </button>
                    <p>{a.text}</p>
                    <button
                      className="text-link"
                      onClick={async () => {
                        try {
                          await callApi("page-annotations", {
                            product_id: productId,
                            action: "delete",
                            id: a.id,
                          });
                          await refreshNotes();
                        } catch (e) {
                          setMessage((e as Error).message);
                        }
                      }}
                    >
                      Remover registro
                    </button>
                  </article>
                ))}
              </details>
            </>
          )}
        </>
      )}
      {!privateMode && (
        <small>
          Leitura pública de demonstração. Para salvar página e anotações,
          adicione o material à biblioteca.
        </small>
      )}
    </section>
  );
}
