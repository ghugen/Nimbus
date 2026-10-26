// Offline-only restoration rehearsal. Never points at a remote or existing database.
import { DatabaseSync } from "node:sqlite";
import { readFile, readdir, open } from "node:fs/promises";
import { resolve } from "node:path";
export async function restoreSnapshot(db, snapshot) {
  if (
    snapshot?.format !== "nimbus-data-v1" ||
    !snapshot.tables ||
    typeof snapshot.tables !== "object"
  )
    throw Error("Formato inválido");
  const triggers = db
    .prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'")
    .all();
  db.exec("BEGIN");
  try {
    for (const t of triggers) {
      if (!/^[a-z_]+$/.test(t.name)) throw Error("Trigger inválido");
      db.exec(`DROP TRIGGER \"${t.name}\"`);
    }
    for (const [table, records] of Object.entries(snapshot.tables)) {
      if (!/^[a-z_]+$/.test(table) || !Array.isArray(records))
        throw Error("Tabela inválida");
      const columns = db
        .prepare(`PRAGMA table_info("${table}")`)
        .all()
        .map((x) => x.name);
      if (!columns.length) throw Error("Tabela desconhecida: " + table);
      for (const row of records) {
        const keys = Object.keys(row);
        if (keys.some((x) => !columns.includes(x)))
          throw Error("Coluna desconhecida");
        const statement = db.prepare(
          `INSERT INTO "${table}" (${keys.map((x) => '"' + x + '"').join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
        );
        statement.run(...keys.map((x) => row[x]));
      }
    }
    for (const t of triggers) db.exec(t.sql);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output)
    throw Error(
      "Uso: node scripts/restore-backup.mjs backup.json NOVO-BANCO.sqlite",
    );
  const guard = await open(output, "wx");
  await guard.close();
  const db = new DatabaseSync(output);
  try {
    for (const file of (await readdir("drizzle"))
      .filter((x) => x.endsWith(".sql"))
      .sort())
      await db.exec(await readFile("drizzle/" + file, "utf8"));
    await restoreSnapshot(db, JSON.parse(await readFile(input, "utf8")));
    console.log(
      "Dados restaurados no banco isolado. Os objetos R2 precisam de uma cópia separada.",
    );
  } finally {
    db.close();
  }
}
