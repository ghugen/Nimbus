"use client";
import { useState, useRef } from "react";
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
          alt={"Amostra " + (index + 1) + " de " + title}
          loading="lazy"
        />
      </div>
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
