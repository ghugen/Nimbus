"use client";
import { helpTopics, type HelpTopic } from "@/lib/help-topics";
export function ContextHelp({ topic }: { topic: HelpTopic }) {
  const h = helpTopics[topic];
  return (
    <details className="context-help">
      <summary>Precisa de orientação? {h.title}</summary>
      <ol>
        {h.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <a className="text-link" href="/#suporte">
        Abrir atendimento ↗
      </a>
    </details>
  );
}
