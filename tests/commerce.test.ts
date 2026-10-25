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
