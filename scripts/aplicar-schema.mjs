import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

// Mesma ordem de src/lib/db.ts.
const VARIAVEIS = ["NETLIFY_DATABASE_URL", "NETLIFY_DB_URL", "DATABASE_URL", "NEON_DATABASE_URL"];
const nome = VARIAVEIS.find((n) => process.env[n]);
if (!nome) {
  const candidatas = Object.keys(process.env).filter((k) => /DATABASE|_DB|NEON|PG/i.test(k));
  console.log(`Sem variável de banco (${VARIAVEIS.join(", ")}): schema não aplicado.`);
  console.log(`Variáveis parecidas no ambiente: ${candidatas.join(", ") || "nenhuma"}`);
  process.exit(0);
}

const sql = neon(process.env[nome]);
const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
// Remove comentários antes de dividir por ";" (um ";" dentro de comentário quebraria o comando).
const semComentarios = schema.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");
for (const comando of semComentarios.split(";").map((c) => c.trim()).filter(Boolean)) {
  await sql.query(comando);
}
console.log(`Schema aplicado (${nome}).`);
