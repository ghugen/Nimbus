import test from "node:test";
import assert from "node:assert/strict";
import {
  syllabusTopics,
  coverage,
  overlap,
  acquisition,
} from "../lib/exam-core.ts";
const materials = [
  {
    id: "a",
    title: "Lesão celular",
    description: "Adaptação e necrose",
    subject: "Patologia",
    topic: "Necrose",
    format: "Resumo",
    price: 0,
    pages: 10,
  },
  {
    id: "b",
    title: "Inflamação aguda",
    description: "Resposta inflamatória",
    subject: "Patologia",
    format: "Mapa mental",
    price: 1000,
    pages: 2,
  },
];
test("ementa mantém temas distintos e limita conteúdo sem aceitar tópicos vazios", () => {
  assert.deepEqual(
    syllabusTopics("1. Lesão celular\n• Inflamação;Lesão celular"),
    ["Lesão celular", "Inflamação"],
  );
  assert.throws(() => syllabusTopics(""));
  assert.throws(() =>
    syllabusTopics(
      Array.from({ length: 21 }, (_, i) => "Tema " + i).join("\n"),
    ),
  );
  assert.throws(() => syllabusTopics("a".repeat(6001)));
});
test("cobertura é lexical, mostra parcial e não inventa disponibilidade", () => {
  const c = coverage(
    ["Lesão celular", "Inflamação crônica", "Álgebra"],
    materials,
  );
  assert.deepEqual(
    c.map((c) => c.status),
    ["matched", "partial", "absent"],
  );
  assert.equal(c[1].items[0].matched[0], "inflamacao");
  assert.deepEqual(c[2].items, []);
});
test("comparação não confunde igualdade de termos com duplicação de arquivo", () => {
  assert(overlap(materials[0], materials[0]).shared.includes("necrose"));
  assert.match(
    overlap(materials[0], materials[1]).notice,
    /não comprova duplicação/,
  );
});
test("economia de aquisição preserva margem e define cenários inválidos", () => {
  const r = acquisition(40, 15, 10, 2);
  assert.equal(r.maxCac, 15);
  assert.equal(r.maxCpc, 0.3);
  assert.equal(r.breakEvenRoas, 1.6);
  assert.equal(acquisition(40, 40, 0, 2).breakEvenRoas, null);
  for (const v of [0, -1, NaN, Infinity, 101])
    assert.throws(() => acquisition(40, 15, 10, v));
  assert.throws(() => acquisition(40, 35, 10, 2));
});
