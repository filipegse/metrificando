import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const url = process.env.NETLIFY_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("Defina NETLIFY_DATABASE_URL ou DATABASE_URL");

const sql = neon(url);
const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
for (const comando of schema.split(";").map((c) => c.trim()).filter(Boolean)) {
  await sql.query(comando);
}
console.log("Schema aplicado.");
