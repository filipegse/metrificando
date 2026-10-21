import { neon } from "@neondatabase/serverless";

export function db() {
  const url = process.env.NETLIFY_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("NETLIFY_DATABASE_URL/DATABASE_URL não configurado");
  return neon(url);
}
