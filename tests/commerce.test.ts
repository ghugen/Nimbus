import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, webcrypto } from "node:crypto";
import { parseCart, validProduct, verifyStripe } from "../lib/commerce.ts";
if (!globalThis.crypto)
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
test("carrinho exige itens válidos e remove duplicatas", () => {
  assert.deepEqual(parseCart(["a", "a", "b"]), ["a", "b"]);
  for (const value of [[], null, "a", [1], Array(31).fill("a")])
    assert.throws(() => parseCart(value));
});
test("preço exige centavos inteiros e páginas limitadas", () => {
  validProduct({ title: "Material original", price: 2990, pages: 20 });
  for (const price of [-1, NaN, 29.9, 1000001, "100"])
    assert.throws(() =>
      validProduct({ title: "Material original", price, pages: 20 }),
    );
  assert.throws(() => validProduct({ title: "abc", price: 0, pages: 0 }));
});
test("webhook válido, corpo adulterado, assinatura falsa e expirada", async () => {
  const time = 1700000000000,
    t = String(time / 1000),
    secret = "whsec_test_only",
    body = '{"id":"evt_test"}',
    sig = createHmac("sha256", secret)
      .update(t + "." + body)
      .digest("hex");
  assert.equal(
    await verifyStripe(body, `t=${t},v1=${sig}`, secret, time),
    true,
  );
  assert.equal(
    await verifyStripe(body + " ", `t=${t},v1=${sig}`, secret, time),
    false,
  );
  assert.equal(
    await verifyStripe(body, `t=${t},v1=${"0".repeat(64)}`, secret, time),
    false,
  );
  assert.equal(
    await verifyStripe(body, `t=${t},v1=${sig}`, secret, time + 301000),
    false,
  );
  assert.equal(await verifyStripe(body, "", secret, time), false);
});

import {
  normalizeProduct,
  topRated,
  materialTypes,
  areas,
  fileMime,
} from "../lib/taxonomy.ts";
test("classificação antiga mantém curso e usa área e tipo novos", () => {
  const p = normalizeProduct({
    category: "Medicina Veterinária",
    format: "Resumo",
    created: "2026-10-25",
  });
  assert.equal(p.category, "Saúde");
  assert.equal(p.course, "Medicina Veterinária");
  assert.equal(p.format, "Resumos e apostilas");
  assert.equal(p.level, "Graduação");
  assert.equal(materialTypes.length, 11);
  assert(materialTypes.includes("Cursos e trilhas"));
  assert.equal(Object.keys(areas).length, 9);
  assert.equal(
    fileMime("planilha.xlsx"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
});
test("vitrine de avaliações exige dados reais e amostra suficiente", () => {
  assert.equal(topRated({ demo: 1, rating: 5, review_count: 100 }), false);
  assert.equal(topRated({ demo: 0, rating: 5, review_count: 2 }), false);
  assert.equal(topRated({ demo: 0, rating: 3.9, review_count: 10 }), false);
  assert.equal(topRated({ demo: 0, rating: 4, review_count: 3 }), true);
});

import { splitNet, allocate } from "../lib/finance.ts";
test("comissão após processamento e acervo próprio preservam centavos", () => {
  assert.deepEqual(splitNet(3000, 200, 2500), {
    gross: 3000,
    fee: 200,
    platform: 700,
    author_net: 2100,
  });
  assert.equal(splitNet(3000, 200, 2500, true).platform, 2800);
  assert.equal(splitNet(3000, 200, 2500, true).author_net, 0);
  for (const rate of [0, 1500, 2500, 10000]) {
    const s = splitNet(1999, 163, rate);
    assert.equal(s.fee + s.author_net + s.platform, 1999);
  }
  assert.throws(() => splitNet(100, 101, 2500));
  assert.throws(() => splitNet(100, 0, 2500.5));
});
test("rateio distribui todos os centavos e nunca cria taxas em itens gratuitos", () => {
  assert.deepEqual(allocate(10, [1, 1, 1]), [4, 3, 3]);
  assert.deepEqual(allocate(10, [0, 30, 70]), [0, 3, 7]);
  for (let total = 0; total < 50; total++)
    assert.equal(
      allocate(total, [100, 2490, 310]).reduce((s, x) => s + x, 0),
      total,
    );
  assert.throws(() => allocate(1, [0, 0]));
});

test("navegação separa áreas e preserva links de seções com acentos", async () => {
  const { workspaceFor, homeFor, parseNavigation, safeReturnTarget } =
    await import("../lib/navigation.ts");
  assert.equal(homeFor(null), "inicio");
  assert.equal(homeFor({ admin: false }), "biblioteca");
  assert.equal(homeFor({ admin: true }), "admin");
  assert.equal(workspaceFor("catalogo"), "loja");
  assert.equal(workspaceFor("biblioteca"), "estudante");
  assert.equal(workspaceFor("autores"), "autor");
  assert.equal(workspaceFor("admin"), "admin");
  assert.deepEqual(parseNavigation("#admin/aprova%C3%A7%C3%B5es"), {
    view: "admin",
    adminTab: "aprovações",
    authorTab: "resumo",
  });
  assert.equal(parseNavigation("#autores/publicar").authorTab, "publicar");
  assert.equal(parseNavigation("#admin/desconhecido").adminTab, "resumo");
  assert.equal(safeReturnTarget("carrinho"), "carrinho");
  assert.equal(safeReturnTarget("autores/publicar"), "autores/publicar");
  for (const path of [
    "https://example.com",
    "//example.com",
    "admin/ideias/extra",
    "javascript:alert(1)",
    null,
  ])
    assert.equal(safeReturnTarget(path), "conta");
});
