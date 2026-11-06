// Disparo diário da coleta do GitHub. Com menos de 3 repos no banco carrega 120 dias; depois, os PRs
// atualizados na última semana (cobre falhas de dias anteriores). A coleta roda na background function.
import type { Config } from "@netlify/functions";
import { db } from "../../src/lib/db";

export default async () => {
  if (!process.env.GITHUB_TOKEN) {
    console.log("GITHUB_TOKEN ausente: coleta do GitHub pulada.");
    return;
  }
  // Carga completa enquanto a base tem poucos repos (primeira vez, ou token que só via parte da org).
  const [{ n, repos }] = (await db()`select count(*)::int as n, count(distinct repo)::int as repos from itens_pr`) as { n: number; repos: number }[];
  const dias = repos >= 3 ? 8 : 120;
  const r = await fetch(`${process.env.URL}/.netlify/functions/coleta-github-background`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-webhook-token": process.env.WEBHOOK_TOKEN ?? "" },
    body: JSON.stringify({ dias }),
  });
  // Background function responde 202 ao aceitar; qualquer outra coisa é falha no disparo.
  console.log(`coleta-github: ${n} PRs no banco, pedindo ${dias} dias → HTTP ${r.status}`);
  if (r.status !== 202) throw new Error(`disparo da coleta falhou: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
};

export const config: Config = { schedule: "0 10 * * *" }; // 07h America/Bahia
