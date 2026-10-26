import { copyFileSync, readFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
const { version } = JSON.parse(
  readFileSync(new URL("node_modules/pdfjs-dist/package.json", root), "utf8"),
);
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error("Versão PDF.js inválida");
copyFileSync(
  new URL("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", root),
  new URL(`public/pdfjs-worker-${version}.mjs`, root),
);
