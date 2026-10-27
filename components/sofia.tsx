"use client";
import { useEffect, useRef, useState } from "react";
import { callApi } from "./commerce-panels";
import { areas, materialTypes } from "@/lib/taxonomy";
import { money } from "@/lib/catalog";
import {
  emptyProfile,
  understand,
  recommend,
  buildPlan,
  planCalendar,
  todayAt,
  type SofiaProfile,
  type SofiaMaterial,
  type SofiaPlan,
} from "@/lib/sofia-core";
type Library = {
  id: string;
  title: string;
  page: number;
  progress: number;
  due_cards: number;
  next_review: string;
  updated: string;
};
type Recommendation = ReturnType<typeof recommend>[number];
type Action = { view: string; label: string };
type Message = {
  id: number;
  role: "sofia" | "student";
  text: string;
  recommendations?: Recommendation[];
  actions?: Action[];
  items?: Library[];
  mode?: "read" | "practice";
};
const welcome =
  "Oi, eu sou a Sofia, sua assistente de estudos na Nimbus. Posso encontrar materiais, ajudar a organizar seu estudo e retomar suas revisões. O que vamos estudar hoje?";
const courses = Object.values(areas).flat();
export function Sofia({
  accountId,
  onNavigate,
  onMaterial,
  onStudy,
}: {
  accountId: string | null;
  onNavigate: (v: string) => void;
  onMaterial: (id: string) => void;
  onStudy: (id: string, mode: "read" | "practice") => Promise<void>;
}) {
  const [profile, setProfile] = useState<SofiaProfile>({ ...emptyProfile }),
    [catalog, setCatalog] = useState<SofiaMaterial[]>([]),
    [total, setTotal] = useState(0),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [text, setText] = useState(""),
    [messages, setMessages] = useState<Message[]>([
      { id: 0, role: "sofia", text: welcome },
    ]),
    [tab, setTab] = useState("conversation"),
    [library, setLibrary] = useState<Library[]>([]),
    [personal, setPersonal] = useState(false),
    [remember, setRemember] = useState(false),
    [plan, setPlan] = useState<SofiaPlan | null>(null),
    [planId, setPlanId] = useState(""),
    [planDraftProfile, setPlanDraftProfile] = useState<SofiaProfile | null>(
      null,
    ),
    [completed, setCompleted] = useState<string[]>([]),
    [alarm, setAlarm] = useState(false),
    [busy, setBusy] = useState(false),
    [clear, setClear] = useState(false);
  const logBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logBox.current) logBox.current.scrollTop = logBox.current.scrollHeight;
  }, [messages]);
  const serial = useRef(0),
    messageBox = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    let alive = true;
    callApi("sofia-catalog")
      .then((d) => {
        if (alive) {
          setCatalog(d.materials as SofiaMaterial[]);
          setTotal(Number(d.total));
          setReady(true);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    if (accountId)
      callApi("sofia-profile")
        .then((d) => {
          if (!alive) return;
          if (d.profile && Object.keys(d.profile as object).length) {
            setProfile({ ...emptyProfile, ...(d.profile as SofiaProfile) });
          }
          if (d.plan && (d.plan as SofiaPlan).tasks) {
            setPlan(d.plan as SofiaPlan);
            setPlanId(String(d.plan_id));
            setCompleted(
              (d.completed as { task_id: string }[]).map((c) => c.task_id),
            );
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [accountId]);
  function add(reply: Omit<Message, "id" | "role">, user?: string) {
    setMessages((old) => [
      ...old.slice(-28),
      ...(user
        ? [{ id: ++serial.current, role: "student" as const, text: user }]
        : []),
      { id: ++serial.current, role: "sofia" as const, ...reply },
    ]);
    setStatus(reply.text);
  }
  async function connect() {
    if (!accountId) {
      setStatus("Entre na sua conta para usar biblioteca e revisões pessoais.");
      onNavigate("conta");
      return;
    }
    setBusy(true);
    try {
      const d = await callApi(
        "sofia-context?timezone=" + encodeURIComponent(profile.timezone),
      );
      setLibrary(d.library as Library[]);
      setPersonal(true);
      setStatus(
        "Biblioteca conectada à Sofia nesta sessão. Não consultei o texto das suas anotações.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function send(input: string) {
    const message = input.trim().slice(0, 600);
    if (!message) return;
    setError("");
    setText("");
    const { intent, profile: next } = understand(message, profile, courses);
    setProfile(next);
    if (intent === "hello") {
      add(
        {
          text: welcome,
          actions: [
            { view: "catalogo", label: "Explorar catálogo" },
            { view: "comecar", label: "Comece por aqui" },
          ],
        },
        message,
      );
      return;
    }
    if (intent === "help") {
      add(
        {
          text: "Posso buscar materiais, organizar um roteiro e mostrar suas revisões. Para compras, acesso, downloads ou reembolsos, use sua biblioteca, pedidos e central de ajuda. Não faço compras nem altero sua conta por mensagens.",
          actions: [
            { view: "biblioteca", label: "Minha biblioteca" },
            { view: "pedidos", label: "Meus pedidos" },
            { view: "suporte", label: "Atendimento" },
            { view: "privacidade", label: "Privacidade" },
          ],
        },
        message,
      );
      return;
    }
    if (intent === "limits") {
      add(
        {
          text: "Sou uma assistente de organização e busca por regras, sem um modelo de linguagem. Não elaboro explicações livres, diagnósticos ou respostas a provas. Posso ajudar a encontrar a fonte e sugerir uma forma de estudar. Digite, por exemplo: “resumos sobre lesão celular”.",
        },
        message,
      );
      return;
    }
    if (intent === "plan") {
      setTab("plan");
      add(
        {
          text: "Vamos preparar um roteiro com seus temas, minutos disponíveis e a data da prova. Preencha Meu plano e confira as tarefas antes de salvar. É uma sugestão ajustável, sem promessa de desempenho.",
        },
        message,
      );
      return;
    }
    if (intent === "continue" || intent === "reviews") {
      if (!personal) {
        add(
          {
            text: "Para consultar onde você parou ou suas revisões, use “Conectar minha biblioteca”. Essa conexão é opcional e restrita à sua conta.",
          },
          message,
        );
        return;
      }
      const today = todayAt(profile.timezone),
        items =
          intent === "continue"
            ? library.filter((i) => i.updated && i.progress < 100).slice(0, 3)
            : library
                .filter(
                  (i) =>
                    i.due_cards > 0 ||
                    (i.next_review && i.next_review <= today),
                )
                .slice(0, 5);
      add(
        {
          text: items.length
            ? intent === "continue"
              ? "Você pode retomar estes materiais da sua biblioteca:"
              : "Estas revisões estão agendadas para hoje ou em atraso:"
            : intent === "continue"
              ? "Não encontrei uma leitura em andamento. Abra um material da sua biblioteca para começar."
              : "Não encontrei revisões agendadas para hoje. Cartões novos podem estar disponíveis na área Praticar.",
          items,
          mode: intent === "continue" ? "read" : "practice",
          actions: items.length
            ? []
            : [{ view: "biblioteca", label: "Abrir biblioteca" }],
        },
        message,
      );
      return;
    }
    if (!ready) {
      add(
        {
          text: "O catálogo ainda não carregou. Tente atualizar os dados antes de buscar.",
        },
        message,
      );
      return;
    }
    if (
      !next.topic &&
      !next.course &&
      !next.format &&
      !next.freeOnly &&
      next.budget === null
    ) {
      add(
        {
          text: "Qual assunto ou disciplina você quer estudar? Você também pode escolher curso, formato e orçamento em Preferências.",
        },
        message,
      );
      return;
    }
    const result = recommend(
      catalog,
      next,
      personal ? library.map((i) => i.id) : [],
    );
    add(
      {
        text: result.length
          ? "Encontrei estas opções no catálogo consultado. As razões abaixo vêm dos dados cadastrados; confira a prévia antes de escolher."
          : "Não encontrei materiais compatíveis com todos os filtros. Tente outro tema ou amplie curso, formato e orçamento em Preferências. Você pode sugerir um material que ainda não temos.",
        recommendations: result,
        actions: result.length
          ? []
          : [
              { view: "mural", label: "Sugerir um material" },
              { view: "gratuitos", label: "Conhecer os guias gratuitos" },
            ],
      },
      message,
    );
  }
  function previewPlan() {
    try {
      setPlan(buildPlan(profile));
      setPlanDraftProfile({ ...profile });
      setPlanId("");
      setCompleted([]);
      setStatus(
        "Prévia criada neste navegador. Salve na conta para acompanhar as tarefas depois.",
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function exportCalendar() {
    if (!plan) return;
    const blob = new Blob([planCalendar(plan, alarm)], {
        type: "text/calendar;charset=utf-8",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "sofia-plano-de-estudos.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(
      "Agenda exportada. Importe no seu calendário e confira horários, fuso e lembretes.",
    );
  }
  async function checkTask(id: string, value: boolean) {
    if (!planId) {
      setCompleted((c) =>
        value ? [...new Set([...c, id])] : c.filter((x) => x !== id),
      );
      return;
    }
    setBusy(true);
    try {
      await callApi("sofia-plan", {
        action: "check",
        plan_id: planId,
        task_id: id,
        completed: value,
      });
      setCompleted((c) =>
        value ? [...new Set([...c, id])] : c.filter((x) => x !== id),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="container page-section sofia-page">
      <div className="sofia-intro">
        <span className="sofia-avatar" aria-hidden="true">
          S<span>✦</span>
        </span>
        <div>
          <span className="eyebrow">SUA ASSISTENTE NA NIMBUS</span>
          <h1>Estude com a Sofia.</h1>
          <p>Encontre seu próximo material e organize um passo de cada vez.</p>
          <span className="badge">Conversa guiada · sem IA externa</span>
        </div>
      </div>
      <p className="sofia-disclosure">
        Uso regras, busca por assuntos e dados cadastrados na Nimbus. Posso não
        compreender algumas frases; os filtros ajudam a refinar. Sua conversa
        fica apenas nesta página, não é gravada no servidor e é descartada ao
        sair. Evite incluir dados pessoais ou de terceiros.
      </p>
      <div className="sofia-nav" role="group" aria-label="Áreas da Sofia">
        {[
          ["conversation", "Conversar"],
          ["plan", "Meu plano"],
          ["preferences", "Preferências"],
        ].map(([key, label]) => (
          <button
            className="btn secondary"
            aria-pressed={tab === key}
            key={key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="sofia-status" role="status">
        {status}
      </p>
      <section className="sofia-context">
        <div>
          <strong>
            {personal
              ? "Sua biblioteca está conectada"
              : "Seu espaço de estudo, no seu controle"}
          </strong>
          <p>
            {personal
              ? `${library.length} material(is) com acesso atual. Não uso suas anotações para recomendar.`
              : "A conexão com a biblioteca é opcional. Preferências e planos só são gravados quando você salva."}
          </p>
        </div>
        <div className="studio-actions">
          {personal ? (
            <>
              <button
                className="btn secondary small"
                disabled={busy}
                onClick={connect}
              >
                Atualizar biblioteca
              </button>
              <button
                className="text-link"
                onClick={() => {
                  setPersonal(false);
                  setLibrary([]);
                  setMessages([
                    { id: ++serial.current, role: "sofia", text: welcome },
                  ]);
                  setStatus(
                    "Biblioteca desconectada e conversa limpa nesta página.",
                  );
                }}
              >
                Desconectar
              </button>
            </>
          ) : (
            <button
              className="btn secondary small"
              disabled={busy}
              onClick={connect}
            >
              {accountId
                ? "Conectar minha biblioteca"
                : "Entrar para usar minha biblioteca"}
            </button>
          )}
        </div>
      </section>
      {tab === "conversation" && (
        <div className="sofia-conversation">
          <div className="sofia-chips" aria-label="Sugestões de conversa">
            {[
              "Quero encontrar materiais",
              "Onde parei?",
              "O que revisar hoje?",
              "Quero organizar meu plano",
              "Como você funciona?",
            ].map((q) => (
              <button key={q} onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
          <div
            ref={logBox}
            className="sofia-log"
            role="log"
            aria-label="Conversa com a Sofia"
            aria-live="off"
          >
            {messages.map((m) => (
              <article className={"sofia-bubble " + m.role} key={m.id}>
                <strong>{m.role === "sofia" ? "Sofia" : "Você"}</strong>
                <p className="pre-line">{m.text}</p>
                {m.recommendations?.map((r) => (
                  <div className="sofia-result" key={r.material.id}>
                    <h3>{r.material.title}</h3>
                    <p>
                      {r.material.subject} · {r.material.format} ·{" "}
                      {r.material.pages} página(s)
                    </p>
                    <p>{r.material.description}</p>
                    <strong>
                      {r.material.price === 0
                        ? "Gratuito"
                        : money(r.material.price)}
                      {r.owned ? " · Já adquirido" : ""}
                    </strong>
                    <ul>
                      {r.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                    <div className="studio-actions">
                      <button
                        className="btn secondary small"
                        onClick={() => onMaterial(r.material.id)}
                      >
                        Conhecer material
                      </button>
                      {r.owned && (
                        <button
                          className="btn primary small"
                          onClick={() =>
                            onStudy(r.material.id, "read").catch((e) =>
                              setError(e.message),
                            )
                          }
                        >
                          Estudar agora
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {m.items?.map((item) => (
                  <div className="sofia-result" key={item.id}>
                    <h3>{item.title}</h3>
                    <p>
                      Página {item.page} · Progresso {item.progress}% ·{" "}
                      {item.due_cards} cartão(ões) com revisão agendada
                    </p>
                    <button
                      className="btn secondary small"
                      onClick={() =>
                        onStudy(item.id, m.mode || "read").catch((e) =>
                          setError(e.message),
                        )
                      }
                    >
                      {m.mode === "practice"
                        ? "Abrir prática"
                        : "Continuar leitura"}
                    </button>
                  </div>
                ))}
                {m.actions?.map((a) => (
                  <button
                    className="text-link"
                    key={a.view}
                    onClick={() => onNavigate(a.view)}
                  >
                    {a.label}
                  </button>
                ))}
              </article>
            ))}
          </div>
          <form
            className="sofia-compose"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
              messageBox.current?.focus();
            }}
          >
            <label>
              Mensagem para a Sofia
              <textarea
                ref={messageBox}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={600}
                rows={3}
                required
                placeholder="Ex.: procuro um guia gratuito sobre leitura de artigos"
              />
            </label>
            <div className="studio-actions">
              <button className="btn primary" disabled={!text.trim()}>
                Enviar
              </button>
              <button
                className="text-link"
                type="button"
                onClick={() => {
                  setMessages([
                    { id: ++serial.current, role: "sofia", text: welcome },
                  ]);
                  setText("");
                  setStatus("Conversa limpa.");
                }}
              >
                Limpar conversa
              </button>
            </div>
          </form>
          <p className="muted">
            {ready
              ? `${Math.min(500, total)} de ${total} materiais reais consultados. Itens demonstrativos pagos ficam fora das sugestões.`
              : "Preparando catálogo…"}
          </p>
          <button
            className="text-link"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const d = await callApi("sofia-catalog");
                setCatalog(d.materials as SofiaMaterial[]);
                setTotal(Number(d.total));
                setReady(true);
                setStatus("Catálogo atualizado.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Atualizar catálogo
          </button>
        </div>
      )}
      {tab === "preferences" && (
        <div className="panel sofia-preferences">
          <h2>Suas escolhas para as sugestões</h2>
          <p>
            Os filtros combinam entre si. Deixe curso e formato livres para
            ampliar os resultados.
          </p>
          <div className="form">
            <label>
              Curso
              <select
                value={profile.course}
                onChange={(e) =>
                  setProfile({ ...profile, course: e.target.value })
                }
              >
                <option value="">Todos os cursos</option>
                {courses.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Tema ou disciplina
              <input
                value={profile.topic}
                maxLength={160}
                onChange={(e) =>
                  setProfile({ ...profile, topic: e.target.value })
                }
              />
            </label>
            <label>
              Objetivo
              <select
                value={profile.goal}
                onChange={(e) =>
                  setProfile({ ...profile, goal: e.target.value })
                }
              >
                <option value="understand">Entender um assunto</option>
                <option value="review">Revisar</option>
                <option value="practice">Praticar</option>
              </select>
            </label>
            <label>
              Formato
              <select
                value={profile.format}
                onChange={(e) =>
                  setProfile({ ...profile, format: e.target.value })
                }
              >
                <option value="">Todos os formatos</option>
                {materialTypes.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label>
              Valor máximo por material (R$; em branco = livre)
              <input
                type="number"
                min={0}
                max={10000}
                step="0.01"
                value={profile.budget === null ? "" : profile.budget / 100}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    budget:
                      e.target.value === ""
                        ? null
                        : Math.round(Number(e.target.value) * 100),
                  })
                }
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={profile.freeOnly}
                onChange={(e) =>
                  setProfile({ ...profile, freeOnly: e.target.checked })
                }
              />
              Somente materiais gratuitos
            </label>
            <div className="studio-actions">
              <button
                className="btn primary"
                onClick={() => {
                  setTab("conversation");
                  send("Buscar com minhas preferências");
                }}
              >
                Encontrar com estas preferências
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  setProfile({ ...emptyProfile });
                  setStatus(
                    "Filtros redefinidos nesta página. As preferências salvas permanecem até você salvar novamente ou apagá-las.",
                  );
                }}
              >
                Redefinir filtros
              </button>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Quero salvar estas preferências na minha conta
            </label>
            <button
              className="btn secondary"
              disabled={!accountId || !remember || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await callApi("sofia-profile", {
                    ...profile,
                    remember: true,
                  });
                  setStatus("Preferências salvas na sua conta.");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Salvar preferências
            </button>
            {!accountId && (
              <p>
                Entre para guardar suas preferências. Sem login, use os filtros
                nesta página.
              </p>
            )}
            <details>
              <summary>Apagar dados da Sofia</summary>
              <p>
                Remove preferências, plano salvo e marcações de tarefas da
                Sofia. Suas compras e anotações permanecem na biblioteca.
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={clear}
                  onChange={(e) => setClear(e.target.checked)}
                />
                Quero apagar meus dados salvos da Sofia
              </label>
              <button
                className="btn secondary"
                disabled={!accountId || !clear || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await callApi("sofia-profile", {
                      action: "clear",
                      confirm: true,
                    });
                    setProfile({ ...emptyProfile });
                    setPlan(null);
                    setPlanId("");
                    setCompleted([]);
                    setRemember(false);
                    setLibrary([]);
                    setPersonal(false);
                    setMessages([
                      { id: ++serial.current, role: "sofia", text: welcome },
                    ]);
                    setClear(false);
                    setStatus("Dados da Sofia apagados desta conta.");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Apagar preferências e plano
              </button>
            </details>
          </div>
        </div>
      )}
      {tab === "plan" && (
        <div className="sofia-planner">
          <section className="panel">
            <h2>Um roteiro para o seu ritmo</h2>
            <p>
              Informe seus temas. A Sofia distribui leitura, tentativa de
              lembrar sem consultar e retomadas. O plano não exige comprar
              materiais.
            </p>
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                previewPlan();
              }}
            >
              <label>
                Temas (um por linha ou separados por vírgulas)
                <textarea
                  value={profile.topics}
                  maxLength={3000}
                  rows={4}
                  onChange={(e) =>
                    setProfile({ ...profile, topics: e.target.value })
                  }
                  required
                  placeholder="Lesão celular, inflamação, reparação"
                />
              </label>
              <div className="form-row">
                <label>
                  Minutos por dia
                  <input
                    type="number"
                    min={10}
                    max={180}
                    value={profile.dailyMinutes}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        dailyMinutes: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Data da prova (opcional)
                  <input
                    type="date"
                    min={todayAt(profile.timezone)}
                    value={profile.examDate}
                    onChange={(e) =>
                      setProfile({ ...profile, examDate: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Horário sugerido
                  <input
                    type="time"
                    value={profile.time}
                    onChange={(e) =>
                      setProfile({ ...profile, time: e.target.value })
                    }
                  />
                </label>
                <label>
                  Fuso para o planejamento
                  <select
                    value={profile.timezone}
                    onChange={(e) =>
                      setProfile({ ...profile, timezone: e.target.value })
                    }
                  >
                    {[
                      "America/Sao_Paulo",
                      "America/Manaus",
                      "America/Rio_Branco",
                      "UTC",
                    ].map((z) => (
                      <option key={z}>{z}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="btn primary">Preparar prévia do plano</button>
            </form>
          </section>
          {plan && (
            <section className="panel">
              <h2>{planId ? "Seu plano salvo" : "Prévia do plano"}</h2>
              <p>{plan.notice}</p>
              <p>
                {completed.length} de {plan.tasks.length} tarefas marcadas ·{" "}
                {plan.dailyMinutes} minutos por dia · {plan.start} a {plan.end}
              </p>
              {plan.uncovered.length > 0 && (
                <p className="notice">
                  O prazo não permite apresentar todos os temas:{" "}
                  {plan.uncovered.join(", ")}. Ajuste os tópicos ou a data.
                </p>
              )}
              <p>
                Salvar uma nova prévia substitui o plano anterior e suas
                marcações. Alterações nos campos só entram ao preparar outra
                prévia.
              </p>
              <div className="studio-actions">
                <button
                  className="btn secondary"
                  disabled={!accountId || busy || !planDraftProfile}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const d = await callApi("sofia-plan", {
                        ...planDraftProfile,
                        preview_start: plan.start,
                        action: "save",
                      });
                      setPlan(d.plan as SofiaPlan);
                      setPlanId(String(d.plan_id));
                      setPlanDraftProfile(null);
                      setCompleted([]);
                      setStatus(
                        "Plano salvo na sua conta. As tarefas podem ser marcadas abaixo.",
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Salvar esta prévia na minha conta
                </button>
                <button className="btn secondary" onClick={exportCalendar}>
                  Exportar agenda (.ics)
                </button>
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={alarm}
                  onChange={(e) => setAlarm(e.target.checked)}
                />
                Incluir lembrete de 10 minutos antes na agenda exportada
              </label>
              <p>
                O calendário do dispositivo interpreta os horários ao importar.
                Confira o fuso e o horário antes de ativar os lembretes. A Sofia
                não envia avisos fora do site por conta própria.
              </p>
              {!accountId && (
                <p>
                  Sem login, a prévia e suas marcações são temporárias. Exporte
                  a agenda para guardar o roteiro.
                </p>
              )}
              {[...new Set(plan.tasks.map((t) => t.date))].map((date) => (
                <fieldset key={date}>
                  <legend>
                    {date}
                    {date < todayAt(profile.timezone) ? " · Data anterior" : ""}
                  </legend>
                  {plan.tasks
                    .filter((t) => t.date === date)
                    .map((t) => (
                      <label className="check-label" key={t.id}>
                        <input
                          type="checkbox"
                          checked={completed.includes(t.id)}
                          disabled={busy}
                          onChange={(e) => checkTask(t.id, e.target.checked)}
                        />
                        <span>
                          {t.label} · {t.minutes} min
                        </span>
                      </label>
                    ))}
                </fieldset>
              ))}
            </section>
          )}
        </div>
      )}
    </section>
  );
}
