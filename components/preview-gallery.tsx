"use client";
import { useState, useRef, useEffect } from "react";
import {callApi} from "./commerce-panels";
import { metric } from "@/lib/client-auth";
export function PreviewGallery({
  id,
  count,
  title,
}: {
  id: string;
  count: number;
  title: string;
}) {
  const [descriptions, setDescriptions] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    if (count)
      callApi("material-experience?id=" + encodeURIComponent(id))
        .then((d) => {
          if (alive && Array.isArray(d?.sample_descriptions))
            setDescriptions(d.sample_descriptions);
        })
        .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id, count]);
  const [index, setIndex] = useState(0),
    start = useRef(0);
  if (!count) return null;
  const select = (n: number) => {
    setIndex((n + count) % count);
    metric(id, "preview");
  };
  return (
    <section className="preview-gallery" aria-label={"Amostras de " + title}>
      <h3>Páginas de amostra</h3>
      <div className="preview-controls">
        <button
          className="btn secondary small"
          aria-label="Amostra anterior"
          onClick={() => select(index - 1)}
        >
          ←
        </button>
        <span>
          Amostra {index + 1} de {count}
        </span>
        <button
          className="btn secondary small"
          aria-label="Próxima amostra"
          onClick={() => select(index + 1)}
        >
          →
        </button>
      </div>
      <div
        className="preview-swipe"
        onPointerDown={(e) => {
          start.current = e.clientX;
        }}
        onPointerUp={(e) => {
          const dx = e.clientX - start.current;
          if (Math.abs(dx) > 60) select(index + (dx < 0 ? 1 : -1));
        }}
      >
        <img
          src={"/api/asset/" + id + "/preview/" + index}
          alt={descriptions[index] || "Amostra " + (index + 1) + " de " + title}
          loading="lazy"
        />
      </div>
      {descriptions[index] && <p className="muted">{descriptions[index]}</p>}
      <a className="text-link" href={"/amostras/" + encodeURIComponent(id)}>
        Ler a amostra em texto e ajustar o tamanho da fonte ↗
      </a>
      <div className="preview-dots">
        {Array.from({ length: count }, (_, i) => (
          <button
            className={i === index ? "active" : ""}
            key={i}
            aria-label={"Ver amostra " + (i + 1)}
            aria-pressed={i === index}
            onClick={() => select(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </section>
  );
}
