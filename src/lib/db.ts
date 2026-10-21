import { neon } from "@neondatabase/serverless";

// O nome da variável depende de como o banco foi conectado no Netlify; a primeira que existir vence.
export const VARIAVEIS_BANCO = ["NETLIFY_DATABASE_URL", "NETLIFY_DB_URL", "DATABASE_URL", "NEON_DATABASE_URL"];

export function urlBanco(): string | undefined {
  for (const nome of VARIAVEIS_BANCO) if (process.env[nome]) return process.env[nome];
  return undefined;
}

export function db() {
  const url = urlBanco();
  if (!url) throw new Error(`Banco não configurado (${VARIAVEIS_BANCO.join(", ")})`);
  return neon(url);
}
