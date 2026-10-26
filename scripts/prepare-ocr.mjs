import { mkdirSync, copyFileSync, readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url)),
  target = join(root, "public/ocr");
mkdirSync(join(target, "core"), { recursive: true });
const require = createRequire(
    realpathSync(join(root, "node_modules/tesseract.js/src/index.js")),
  ),
  core = dirname(require.resolve("tesseract.js-core/package.json"));
for (const f of readdirSync(core))
  if (/\.wasm(\.js)?$/.test(f) || /LICENSE/.test(f))
    copyFileSync(join(core, f), join(target, "core", f));
copyFileSync(
  join(root, "node_modules/tesseract.js/dist/worker.min.js"),
  join(target, "worker.min.js"),
);
copyFileSync(
  join(root, "node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt"),
  join(target, "worker.min.js.LICENSE.txt"),
);
copyFileSync(
  join(
    root,
    "node_modules/@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz",
  ),
  join(target, "por.traineddata.gz"),
);

copyFileSync(
  join(root, "node_modules/tesseract.js/LICENSE.md"),
  join(target, "TESSERACT-LICENSE.md"),
);
copyFileSync(
  join(root, "node_modules/@tesseract.js-data/por/package.json"),
  join(target, "POR-PACKAGE.json"),
);
copyFileSync(
  join(root, "node_modules/@tesseract.js-data/por/README.md"),
  join(target, "POR-README.md"),
);
