"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
export function PageStudyTools({
  canvas,
  text,
}: {
  canvas: RefObject<HTMLCanvasElement | null>;
  text: string;
}) {
  const [ocr, setOcr] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [voice, setVoice] = useState("");
  const worker = useRef<{ terminate: () => Promise<unknown> } | null>(null),
    alive = useRef(true),
    run = useRef(0);
  useEffect(() => {
    alive.current = true;
    const update = () => {
      if ("speechSynthesis" in window)
        setVoices(speechSynthesis.getVoices().filter((v) => v.localService));
    };
    update();
    window.speechSynthesis?.addEventListener("voiceschanged", update);
    return () => {
      alive.current = false;
      run.current++;
      window.speechSynthesis?.cancel();
      window.speechSynthesis?.removeEventListener("voiceschanged", update);
      worker.current?.terminate().catch(() => {});
    };
  }, []);
  const content = ocr || text;
  async function recognize() {
    if (!canvas.current) return;
    const token = ++run.current;
    setBusy(true);
    setMessage("Preparando reconhecimento local em português…");
    try {
      const { createWorker } = await import("tesseract.js");
      const w = await createWorker("por", 1, {
        workerPath: location.origin + "/ocr/worker.min.js",
        corePath: location.origin + "/ocr/core",
        langPath: location.origin + "/ocr",
        workerBlobURL: false,
        cacheMethod: "none",
        logger: (m) => {
          if (
            alive.current &&
            token === run.current &&
            m.status === "recognizing text"
          )
            setMessage("Reconhecendo: " + Math.round(m.progress * 100) + "%");
        },
      });
      if (!alive.current || token !== run.current) {
        await w.terminate();
        return;
      }
      worker.current = w;
      const result = await w.recognize(canvas.current);
      if (alive.current && token === run.current) {
        setOcr(result.data.text.slice(0, 30000));
        setMessage(
          "Texto reconhecido automaticamente. Confira números, termos e símbolos na imagem original. O texto não foi salvo nem enviado a outro serviço.",
        );
      }
      await w.terminate();
      if (token === run.current) worker.current = null;
    } catch (e) {
      if (alive.current && token === run.current)
        setMessage(
          "Não foi possível reconhecer esta página neste dispositivo. Tente uma imagem mais legível ou use o download.",
        );
    } finally {
      if (alive.current && token === run.current) setBusy(false);
    }
  }
  function speak() {
    speechSynthesis.cancel();
    const v =
      voices.find((v) => v.voiceURI === voice) ||
      voices.find((v) => v.lang.startsWith("pt")) ||
      voices[0];
    if (!v || !content) return;
    const chunks = content.match(/[\s\S]{1,700}/g) || [content];
    let i = 0;
    function next() {
      if (!alive.current || i >= chunks.length) return;
      const u = new SpeechSynthesisUtterance(chunks[i++]);
      u.voice = v!;
      u.lang = v!.lang;
      u.onend = next;
      speechSynthesis.speak(u);
    }
    next();
  }
  return (
    <details className="page-tools">
      <summary>Reconhecer texto e ouvir esta página</summary>
      <p>
        OCR de uma página por vez, processado neste navegador. Não corrige o PDF
        original e pode errar em tabelas, manuscritos e termos técnicos. O texto
        reconhecido fica apenas nesta página e não entra na busca geral dos
        materiais.
      </p>
      <div className="studio-actions">
        <button
          className="btn secondary small"
          disabled={busy}
          onClick={recognize}
        >
          {busy ? "Reconhecendo…" : "Reconhecer texto da página (OCR)"}
        </button>
        {busy && (
          <button
            className="text-link"
            onClick={() => {
              run.current++;
              worker.current?.terminate().catch(() => {});
              worker.current = null;
              setBusy(false);
              setMessage("Reconhecimento cancelado.");
            }}
          >
            Cancelar OCR
          </button>
        )}
      </div>
      {ocr && (
        <label>
          Texto reconhecido para conferir
          <textarea readOnly value={ocr} rows={10} />
        </label>
      )}
      {!!voices.length ? (
        <>
          <label>
            Voz local
            <select value={voice} onChange={(e) => setVoice(e.target.value)}>
              <option value="">Voz local disponível</option>
              {voices.map((v) => (
                <option value={v.voiceURI} key={v.voiceURI}>
                  {v.name} · {v.lang}
                </option>
              ))}
            </select>
          </label>
          <div className="studio-actions">
            <button
              className="btn secondary small"
              disabled={!content}
              onClick={speak}
            >
              Ouvir texto
            </button>
            <button
              className="text-link"
              onClick={() => speechSynthesis.pause()}
            >
              Pausar
            </button>
            <button
              className="text-link"
              onClick={() => speechSynthesis.resume()}
            >
              Continuar
            </button>
            <button
              className="text-link"
              onClick={() => speechSynthesis.cancel()}
            >
              Parar
            </button>
          </div>
        </>
      ) : (
        <p>
          Não foi encontrada uma voz local neste navegador. Você ainda pode ler
          o texto extraído e usar seu leitor de tela.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
