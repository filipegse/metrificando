// Coleta diária dos health checks fechados do TeamRetro (últimos 30 dias, ou TEAMRETRO_DIAS) e associa ao período do time.
// Sem período coletado do Jira, grava no histórico importado. Sprint: a de mesmo número (só onde está vazio).
// Semana Kanban: o último health check feito até o fim da semana (o check é quinzenal, a coleta semanal).
// Roda separado do webhook do Jira porque o health check costuma acontecer depois do fechamento da sprint.
import type { Config } from "@netlify/functions";
import { PERFIS } from "../../src/config/perfis";
import { db } from "../../src/lib/db";
import { listarHealthChecks, periodoDoHealthCheck, saudeDe, semanasDoHealthCheck } from "../../src/lib/teamretro";

export default async () => {
  if (!process.env.TEAMRETRO_API_KEY) {
    console.log("TEAMRETRO_API_KEY ausente: coleta do TeamRetro pulada.");
    return;
  }
  const sql = db();
  const ate = new Date();
  const dias = Number(process.env.TEAMRETRO_DIAS) || 30;
  const de = new Date(ate.getTime() - dias * 24 * 60 * 60 * 1000);
  const dia = (d: Date) => d.toISOString().slice(0, 10);
  for (const perfil of PERFIS.filter((p) => p.teamRetroId)) {
    const periodos = (await sql`
      select periodo_id, tipo, nome, frente, inicio::text, fim::text from periodos
      where time = ${perfil.time} and fim >= ${new Date(de.getTime() - 14 * 24 * 60 * 60 * 1000)}`) as any[];
    const hist = (await sql`
      select 'h:' || nome as periodo_id, tipo, nome, frente, inicio::text, fim::text from historico_periodos
      where time = ${perfil.time} and fim >= ${dia(new Date(de.getTime() - 14 * 24 * 60 * 60 * 1000))}::date`) as any[];
    const hcs = (await listarHealthChecks(perfil.teamRetroId!, dia(de), dia(ate))).sort((a, b) => a.date.localeCompare(b.date));
    const conta = { lidos: hcs.length, jira: 0, historico: 0, semPeriodo: 0, outraSerie: 0 };
    for (const [k, hc] of hcs.entries()) {
      const serie = perfil.teamRetroSeries?.find((x) => x.titulo.test(hc.title ?? ""));
      if (perfil.teamRetroSeries && !serie) { conta.outraSerie++; continue; }
      const frente = serie?.frente ?? "";
      // Frentes com sprints próprias só casam com os períodos da mesma frente.
      const candidatos = perfil.sprintsPorFrente ? periodos.filter((p) => p.frente === frente) : periodos;
      const s = saudeDe(hc);
      const hd = hist.filter((h) => h.frente === frente);
      // Sprint: um período pelo número/data. Semana Kanban: todas as semanas que o health check avalia.
      // Health check de antes da migração (título "Sprint 143") cai na sprint, depois nas semanas.
      const sprint = periodoDoHealthCheck(hc.date, candidatos.filter((p) => p.tipo === "sprint"), hc.title);
      const sprintHist = sprint ? null : periodoDoHealthCheck(hc.date, hd.filter((p) => p.tipo === "sprint"), hc.title);
      // Próximo check da mesma série (frente): até ele, as semanas ficam com este.
      const proximo = hcs.slice(k + 1).find((x) => (perfil.teamRetroSeries?.find((y) => y.titulo.test(x.title ?? ""))?.frente ?? "") === frente)?.date ?? null;
      const jira = sprint ? [sprint] : sprintHist ? [] : semanasDoHealthCheck(hc.date, proximo, candidatos);
      const semanasHist = new Set(sprint || sprintHist ? [] : semanasDoHealthCheck(hc.date, proximo, hd));
      const doHist = sprint ? [] : sprintHist ? [sprintHist] : [...semanasHist]
        // semana já coletada do Jira fica com o registro da coleta
        .filter((id) => !candidatos.some((c) => c.tipo === "semana" && c.fim.slice(0, 10) === hd.find((h) => h.periodo_id === id)?.fim));
      if (!jira.length && !doHist.length) { conta.semPeriodo++; console.log(`${perfil.time}: health check "${hc.title}" (${hc.date}) sem período`); continue; }
      for (const nomeHist of doHist.map((id) => id.slice(2))) {
        // Sprint do histórico: só preenche o que a planilha deixou vazio (não sobrescreve valor importado).
        // Semana: sempre o último check (a planilha Kanban não traz saúde). Check do time inteiro (sem série
        // por frente) vale também para as linhas de cada frente.
        const semana = semanasHist.has(`h:${nomeHist}`);
        const r = (await sql`
          update historico_periodos set produtividade = ${s.produtividade}, motivacao = ${s.motivacao}
          where time = ${perfil.time} and (frente = ${frente} or ${!perfil.teamRetroSeries}) and nome = ${nomeHist}
            and (${semana} or (produtividade is null and motivacao is null))
          returning nome`) as unknown[];
        if (r.length) conta.historico++;
      }
      for (const periodoId of jira) {
        conta.jira++;
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
    console.log(`${perfil.time}: ${JSON.stringify(conta)}`);
  }
};

export const config: Config = { schedule: "30 9 * * *" }; // 06h30 America/Bahia
