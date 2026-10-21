// Coleta diária dos health checks fechados do TeamRetro (últimos 30 dias) e associa ao período do time.
// Roda separado do webhook do Jira porque o health check costuma acontecer depois do fechamento da sprint.
import type { Config } from "@netlify/functions";
import { PERFIS } from "../../src/config/perfis";
import { db } from "../../src/lib/db";
import { listarHealthChecks, periodoDoHealthCheck, saudeDe } from "../../src/lib/teamretro";

export default async () => {
  if (!process.env.TEAMRETRO_API_KEY) {
    console.log("TEAMRETRO_API_KEY ausente: coleta do TeamRetro pulada.");
    return;
  }
  const sql = db();
  const ate = new Date();
  const de = new Date(ate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dia = (d: Date) => d.toISOString().slice(0, 10);
  for (const perfil of PERFIS.filter((p) => p.teamRetroId)) {
    const periodos = (await sql`
      select periodo_id, tipo, nome, frente, inicio::text, fim::text from periodos
      where time = ${perfil.time} and fim >= ${new Date(de.getTime() - 14 * 24 * 60 * 60 * 1000)}`) as any[];
    const hcs = await listarHealthChecks(perfil.teamRetroId!, dia(de), dia(ate));
    for (const hc of hcs) {
      const serie = perfil.teamRetroSeries?.find((x) => x.titulo.test(hc.title ?? ""));
      if (perfil.teamRetroSeries && !serie) continue;
      const frente = serie?.frente ?? "";
      // Frentes com sprints próprias só casam com os períodos da mesma frente.
      const candidatos = perfil.sprintsPorFrente ? periodos.filter((p) => p.frente === frente) : periodos;
      const periodoId = periodoDoHealthCheck(hc.date, candidatos, hc.title);
      if (!periodoId) continue;
      const s = saudeDe(hc);
      await sql`
        insert into saude_time (time, periodo_id, frente, health_check_id, data, prod_coletiva, prod_individual, mot_individual,
          mot_coletiva, produtividade, motivacao, respostas)
        values (${perfil.time}, ${periodoId}, ${frente}, ${s.healthCheckId}, ${s.data}, ${s.prodColetiva}, ${s.prodIndividual},
          ${s.motIndividual}, ${s.motColetiva}, ${s.produtividade}, ${s.motivacao}, ${s.respostas})
        on conflict (time, periodo_id, frente) do update set health_check_id = excluded.health_check_id, data = excluded.data,
          prod_coletiva = excluded.prod_coletiva, prod_individual = excluded.prod_individual,
          mot_individual = excluded.mot_individual, mot_coletiva = excluded.mot_coletiva,
          produtividade = excluded.produtividade, motivacao = excluded.motivacao,
          respostas = excluded.respostas, coletado_em = now()`;
    }
  }
};

export const config: Config = { schedule: "30 9 * * *" }; // 06h30 America/Bahia
