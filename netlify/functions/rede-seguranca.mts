// Rede de segurança diária: encontra sprints fechadas sem coleta ok e enfileira na background function.
// Scheduled Functions têm limite de 30 s, então a coleta em si não roda aqui.
import type { Config } from "@netlify/functions";
import { PERFIS } from "../../src/config/perfis";
import { db } from "../../src/lib/db";
import { agile } from "../../src/lib/jira";

const JANELA_DIAS = 30;

export default async () => {
  const sql = db();
  const limite = Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000;
  for (const perfil of PERFIS.filter((p) => p.metodologia === "scrum")) {
    const boards = await agile<{ values: { id: number }[] }>(`board?projectKeyOrId=${perfil.projeto}&type=scrum`);
    for (const board of boards.values) {
      const sprints = await agile<{ values: any[] }>(`board/${board.id}/sprint?state=closed&maxResults=50`);
      for (const s of sprints.values.filter((s) => s.completeDate && new Date(s.completeDate).getTime() > limite)) {
        const ok = await sql`select 1 from coletas where time = ${perfil.time} and periodo_id = ${String(s.id)} and status = 'ok' limit 1`;
        if (ok.length) continue;
        await fetch(`${process.env.URL}/.netlify/functions/coleta-background`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-webhook-token": process.env.WEBHOOK_TOKEN ?? "" },
          body: JSON.stringify({ evento: "sprint_concluida", projeto: perfil.projeto, sprint_id: String(s.id), sprint_nome: s.name, inicio: s.startDate, fim: s.completeDate }),
        });
      }
    }
  }
};

export const config: Config = { schedule: "0 9 * * *" }; // 06h America/Bahia
