// Validate completed evidence before creating a user-facing summary.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
const inputs = process.argv.slice(2);
assert(inputs.length >= 1, "Informe os JSONs concluídos das execuções.");
const reports = await Promise.all(
  inputs.map(async (file) => JSON.parse(await readFile(file, "utf8"))),
);
for (const r of reports) {
  assert(r.finished, "Execução ainda não concluída");
  assert.equal(r.total_failures, 0);
  assert.equal(r.external_network_calls, 0);
  assert.equal(r.rounds_per_group, 30000);
  assert.equal(r.harness_sha256, reports[0].harness_sha256);
  assert.equal(r.source_commit, reports[0].source_commit);
}
const groups = reports.flatMap((r) => r.groups).sort((a, b) => a.id - b.id);
assert.deepEqual(
  groups.map((g) => g.id),
  Array.from({ length: 15 }, (_, i) => i + 1),
);
for (const g of groups) {
  assert.equal(g.completed, 30000);
  assert.equal(g.failed, 0);
  assert.deepEqual(g.failures, []);
}
const evidence = {
  schema: "nimbus-stress-evidence-v1",
  functional_source_commit: reports[0].source_commit,
  harness_sha256: reports[0].harness_sha256,
  node_version: reports[0].node_version,
  sqlite_version: reports[0].sqlite_version,
  started: reports.map((r) => r.started).sort()[0],
  finished: reports
    .map((r) => r.finished)
    .sort()
    .at(-1),
  rounds_per_group: 30000,
  groups: groups.map((g) => ({
    ...g,
    status: "Automated scenarios passed; end-to-end scope partial",
  })),
  total_scenarios: groups.reduce((s, g) => s + g.completed, 0),
  failed_scenarios: 0,
  assertions: groups.reduce((s, g) => s + g.assertions, 0),
  api_calls: groups.reduce((s, g) => s + g.api_calls, 0),
  provider_calls_mocked: groups.reduce(
    (s, g) => s + g.provider_calls_mocked,
    0,
  ),
  real_provider_calls: 0,
  limitations: [
    "Every group covers a defined automated subset of the corresponding checklist item, not the entire real user journey.",
    "Two independent stress processes ran concurrently; local timing is observational, not a production SLA or capacity estimate.",
    "All data is fictitious; API is imported into Node; Cloudflare trusted identity headers are injected only in the isolated harness.",
    "No production traffic, real charges, external emails, live user accounts or real backups were created.",
    "Iteration count includes repetitions with varied indexed inputs and bounded branch sets; it is not the number of unique features or unique bugs tested.",
    "A failing assertion stops its group; this summary requires successful completion of every requested iteration.",
  ],
  browser_checks: {
    environment: "Chrome cloud browser; local managed preview",
    automated_count: 0,
    manual_checks: [
      {
        check: "Catálogo com um título principal e idioma pt-BR",
        result: "passed",
      },
      {
        check: "Botões sem nome acessível no catálogo",
        observed: 0,
        result: "passed",
      },
      {
        check: "Imagens sem atributo alt no catálogo",
        observed: 0,
        result: "passed",
      },
      {
        check: "Rolagem horizontal no viewport observado de 1348px",
        observed: "documentWidth = viewportWidth = 1348",
        result: "passed",
      },
      {
        check: "Busca acadêmica submetida por Enter",
        observed: "Dois guias originais de Métodos de estudo retornados",
        result: "passed",
      },
      {
        check: "OCR da primeira página do guia de revisão ativa",
        observed: "Texto em português reconhecido no navegador",
        result: "passed",
      },
      {
        check: "Questões da demonstração",
        observed:
          "Três respostas corretas em três questões; comentários e referências visíveis",
        result: "passed",
      },
      {
        check: "Navegação por página citada",
        observed:
          "Botão Consultar página 2 abriu página 2 e limpou OCR da página anterior",
        result: "passed",
      },
      {
        check: "Leitura por voz local",
        result: "unavailable",
        observed:
          "Chrome não disponibilizou voz local; alternativa em texto exibida",
      },
      {
        check:
          "iOS e Android reais; leitor de tela; auditoria completa de contraste",
        result: "not_executed",
      },
    ],
  },
  regression: {
    unit_tests: 8,
    integration_checks: 483,
    result: "passed",
    provider_mode: "mocked",
  },
};
assert.equal(evidence.total_scenarios, 450000);
const out = resolve("docs/testes/2026-10-26");
await mkdir(out, { recursive: true });
await writeFile(
  join(out, "stress-results.json"),
  JSON.stringify(evidence, null, 2) + "\n",
);
const duration =
  (Date.parse(evidence.finished) - Date.parse(evidence.started)) / 60000;
const lines = [
  "# Testes de volume da Nimbus — 26/10/2026",
  "",
  `Foram concluídos **450.000 cenários automatizados**, com **30.000 por grupo**, sem falhas de asserção na execução final. A verificação cobre os subconjuntos descritos abaixo: **não significa que os 15 fluxos completos foram testados 30.000 vezes em produção, em dispositivos reais ou com os provedores ativos**.`,
  "",
  `- Asserções: **${evidence.assertions.toLocaleString("pt-BR")}**.`,
  `- Chamadas à API importada: **${evidence.api_calls.toLocaleString("pt-BR")}**; sem HTTP de produção.`,
  `- Chamadas a adaptadores de provedores simulados: **${evidence.provider_calls_mocked.toLocaleString("pt-BR")}**.`,
  "- Chamadas externas reais, cobranças e e-mails externos: **zero**.",
  `- Tempo decorrido entre início e fim das duas rotinas: **${duration.toFixed(1)} minutos**.`,
  `- Código funcional testado: \`${evidence.functional_source_commit}\`.`,
  `- SHA-256 do arquivo de cenários: \`${evidence.harness_sha256}\`.`,
  `- Ambiente: Node ${evidence.node_version}; SQLite ${evidence.sqlite_version}; bancos em memória e armazenamento fictício.`,
  "- A suíte habitual também passou: **8 testes unitários e 483 verificações de integração**.",
  "",
  "| Item | Cenários concluídos | Falhas | Cobertura e limite |",
  "|---|---:|---:|---|",
  ...groups.map(
    (g) =>
      `| ${g.id}. ${g.name} | ${g.completed.toLocaleString("pt-BR")} | ${g.failed} | ${g.limitation} |`,
  ),
  "",
  "## Como os testes foram executados",
  "",
  "Os testes usam os handlers e as regras da aplicação, SQLite com todas as migrações e arquivos fictícios. Cada cenário começa no mesmo estado-base e suas alterações são revertidas, preservando a independência e evitando que limites de uso ou resíduos de uma rodada invalidem a próxima. Os lotes não são 30.000 usuários simultâneos. O grupo de desempenho executa oito consultas concorrentes por rodada dentro do processo; isso não representa tráfego HTTP para a hospedagem.",
  "",
  "Entradas variam por índice reproduzível: preços, identificadores, titulares fictícios, respostas, dificuldade de cartões, coordenadas do atlas, tipos de arquivo, conteúdo privado e campos restaurados. A suíte combina repetições de ramos limitados com dados variados; 450.000 cenários não significam 450.000 funcionalidades distintas.",
  "",
  "Cada restauração cria um SQLite vazio, aplica todas as migrações, restaura o snapshot e verifica registros, titular e conteúdo do arquivo fictício copiado em memória. O backup real da hospedagem e os objetos reais do armazenamento não foram acessados.",
  "",
  "Falhas na montagem inicial do teste (citação de string, comparação do protótipo SQLite e leitura do envelope da resposta) foram corrigidas antes da execução final. A rodada piloto de 100 cenários por grupo também passou. Esses ensaios não foram somados aos 450.000 cenários finais.",
  "",
  "## Conferência no navegador",
  "",
  ...evidence.browser_checks.manual_checks.map(
    (c) =>
      `- ${c.check}: **${{ passed: "aprovado", unavailable: "indisponível", not_executed: "não executado" }[c.result] || c.result}**${c.observed ? " — " + c.observed : "."}`,
  ),
  "",
  "Essas conferências no Chrome foram pontuais e não são contadas como 30.000 testes visuais. Não houve teste em aparelhos iPhone/Android físicos, execução de leitor de tela ou certificação de acessibilidade.",
  "",
  "## Pendências para testes completos",
  "",
  "- Configurar e validar o webhook da Stripe num endpoint externamente acessível e concluir a compra no sandbox real.",
  "- Configurar autenticação por e-mail e testar cadastro, verificação e recuperação no provedor.",
  "- Configurar remetente e provedor de e-mail; verificar entrega, spam e falhas reais.",
  "- Testar visualmente em iOS/Android, com teclado e leitor de tela, e auditar contraste.",
  "- Executar backup/restauração dos dados e arquivos reais em ambiente separado autorizado.",
  "- Medir carga HTTP e limites da hospedagem em ambiente de homologação, com tráfego e custo definidos.",
  "- Validar retenção, exclusão de dados e políticas de operação; testes técnicos não certificam conformidade jurídica.",
  "",
  "## Reprodução",
  "",
  "```bash",
  "# Toda a suíte de volume (30.000 rodadas por grupo)",
  "npm run test:stress",
  "",
  "# Ensaio menor, sem entrar na contagem oficial",
  "NIMBUS_STRESS_ROUNDS=100 NIMBUS_STRESS_OUTPUT=work/pilot.json npm run test:stress",
  "",
  "# Relatório desta execução em duas rotinas independentes",
  "node tests/merge-stress-results.mjs work/stress-main.json work/stress-backup.json",
  "```",
  "",
  "`NIMBUS_STRESS_GROUPS=1,2,3` seleciona grupos. `NIMBUS_STRESS_OUTPUT` escolhe a saída. Não configure chaves reais: o harness utiliza credenciais fictícias e intercepta as chamadas a provedores. O resumo consolidado só é gerado se houver exatamente 15 grupos concluídos com 30.000 cenários cada.",
  "",
  "[Evidência detalhada em JSON](stress-results.json)",
  "",
];
await writeFile(join(out, "RELATORIO.md"), lines.join("\n"));
console.log(
  JSON.stringify({
    path: out,
    total: evidence.total_scenarios,
    assertions: evidence.assertions,
    api_calls: evidence.api_calls,
    duration_minutes: duration,
  }),
);
