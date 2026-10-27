// Disparo diário da coleta do GitHub. Na primeira vez (tabela vazia) carrega 120 dias; depois, os PRs
// atualizados na última semana (cobre falhas de dias anteriores). A coleta roda na background function.
import type { Config } from "@netlify/functions";
import { db } from "../../src/lib/db";

export default async () => {
  if (!process.env.GITHUB_TOKEN) {
    console.log("GITHUB_TOKEN ausente: coleta do GitHub pulada.");
    return;
  }
  const [{ n }] = (await db()`select count(*)::int as n from itens_pr`) as { n: number }[];
  await fetch(`${process.env.URL}/.netlify/functions/coleta-github-background`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-webhook-token": process.env.WEBHOOK_TOKEN ?? "" },
    body: JSON.stringify({ dias: n ? 8 : 120 }),
  });
};

export const config: Config = { schedule: "0 10 * * *" }; // 07h America/Bahia
