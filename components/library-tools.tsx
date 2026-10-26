"use client";
import { useEffect, useState } from "react";
import { callApi } from "./commerce-panels";
export type StudyState = {
  product_id: string;
  page: number;
  folder: string;
  status: string;
  next_review: string;
};
export function useLibraryOrganization(active: boolean) {
  const [states, setStates] = useState<StudyState[]>([]),
    [folder, setFolder] = useState(""),
    [status, setStatus] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (active)
      callApi("library-tools")
        .then((d) => setStates(d.states as StudyState[]))
        .catch(() => {});
  }, [active, revision]);
  return {
    states,
    setStates,
    folder,
    setFolder,
    status,
    setStatus,
    refresh: () => setRevision((v) => v + 1),
  };
}
export function LibraryFilters({
  states,
  folder,
  status,
  onFolder,
  onStatus,
}: {
  states: StudyState[];
  folder: string;
  status: string;
  onFolder: (v: string) => void;
  onStatus: (v: string) => void;
}) {
  return (
    <div className="library-organizer">
      <label>
        Pasta
        <select value={folder} onChange={(e) => onFolder(e.target.value)}>
          <option value="">Todas</option>
          {[...new Set(states.map((x) => x.folder).filter(Boolean))].map(
            (f) => (
              <option key={f}>{f}</option>
            ),
          )}
        </select>
      </label>
      <label>
        Estado de estudo
        <select value={status} onChange={(e) => onStatus(e.target.value)}>
          <option value="">Todos</option>
          <option value="not_started">Não iniciados</option>
          <option value="studying">Estudando</option>
          <option value="completed">Concluídos</option>
        </select>
      </label>
      {states.some((s) => s.next_review) && (
        <p className="notice">
          {
            states.filter(
              (s) =>
                s.next_review &&
                s.next_review <= new Date().toLocaleDateString("sv-SE"),
            ).length
          }{" "}
          material(is) com revisão para hoje ou em atraso.
        </p>
      )}
    </div>
  );
}
export function StudyOrganization({
  productId,
  onSaved,
}: {
  productId: string;
  onSaved?: () => void;
}) {
  const [state, setState] = useState<StudyState | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    callApi("reader-state?id=" + encodeURIComponent(productId))
      .then((d) => setState(d.state as StudyState))
      .catch((e) => setMessage(e.message));
  }, [productId]);
  return (
    <form
      className="form study-organization"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await callApi("reader-state", { ...state, product_id: productId });
          setMessage("Organização salva.");
          onSaved?.();
        } catch (e) {
          setMessage((e as Error).message);
        }
      }}
    >
      <h3>Organize sua próxima revisão</h3>
      {message && <p role="status">{message}</p>}
      {state && (
        <>
          <label>
            Pasta ou etiqueta
            <input
              value={state.folder}
              onChange={(e) => setState({ ...state, folder: e.target.value })}
              maxLength={60}
              placeholder="Ex.: Este semestre"
            />
          </label>
          <div className="form-row">
            <label>
              Estado
              <select
                value={state.status}
                onChange={(e) => setState({ ...state, status: e.target.value })}
              >
                <option value="not_started">Não iniciado</option>
                <option value="studying">Estudando</option>
                <option value="completed">Concluído</option>
              </select>
            </label>
            <label>
              Próxima revisão
              <input
                type="date"
                value={state.next_review}
                onChange={(e) =>
                  setState({ ...state, next_review: e.target.value })
                }
              />
            </label>
          </div>
          <button className="btn secondary">Salvar organização</button>
        </>
      )}
    </form>
  );
}
