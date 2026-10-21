import { CAMPOS, frenteDaSprint, perfilPorProjeto, type Perfil } from "../config/perfis";
import { db } from "./db";
import { buscar } from "./jira";
import { jqlDeliveryJanela, jqlDeliverySprint, jqlSuporte } from "./jql";
import { normalizarDelivery, normalizarSuporte, type ItemDelivery, type ItemSuporte } from "./normalizar";
import { janelaSemanal } from "./periodo";
import type { Calendario } from "./calendario";

/** Expedientes e feriados cadastrados na aplicação. */
export async function carregarCalendario(): Promise<Calendario> {
  const sql = db();
  const exp = (await sql`select valido_de::text as "validoDe", to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim from expedientes`) as Calendario["expedientes"];
  const fer = (await sql`select data::text as data from feriados`) as { data: string }[];
  return { expedientes: exp, feriados: new Set(fer.map((f) => f.data)) };
}

export type Evento =
  | { evento: "sprint_concluida"; projeto: string; sprint_id: string; sprint_nome?: string; inicio: string; fim: string }
  | { evento: "janela_semanal"; projeto: string; referencia?: string };

const CAMPOS_BUSCA = [
  "summary", "issuetype", "status", "created", "components",
  ...Object.values(CAMPOS),
];

type Periodo = { periodoId: string; tipo: "sprint" | "semana"; nome: string | null; frente: string; inicio: Date; fim: Date };

function periodoDoEvento(e: Evento, perfil: Perfil): Periodo {
  if (e.evento === "sprint_concluida") {
    if (perfil.metodologia !== "scrum") throw new Error(`${perfil.time} não está em Scrum`);
    return { periodoId: e.sprint_id, tipo: "sprint", nome: e.sprint_nome ?? null, frente: frenteDaSprint(perfil, e.sprint_nome), inicio: new Date(e.inicio), fim: new Date(e.fim) };
  }
  if (perfil.metodologia !== "kanban") throw new Error(`${perfil.time} não está em Kanban`);
  // Disparo de sexta 23h: a janela que contém a referência é a que acabou de fechar.
  const j = janelaSemanal(e.referencia ? new Date(e.referencia) : new Date());
  return { periodoId: j.periodoId, tipo: "semana", nome: null, frente: "", inicio: j.inicio, fim: j.fim };
}

export async function coletar(e: Evento): Promise<{ time: string; periodoId: string; delivery: number; suporte: number }> {
  const perfil = perfilPorProjeto(e.projeto);
  if (!perfil) throw new Error(`Projeto sem perfil: ${e.projeto}`);
  const periodo = periodoDoEvento(e, perfil);
  const cal = await carregarCalendario();

  const jqlDelivery = periodo.tipo === "sprint"
    ? jqlDeliverySprint(perfil, periodo.periodoId)
    : jqlDeliveryJanela(perfil, periodo.inicio, periodo.fim);
  const delivery = (await buscar(jqlDelivery, CAMPOS_BUSCA))
    .map((i) => normalizarDelivery(i, perfil, cal))
    .filter((i): i is ItemDelivery => i !== null);

  const suporte: ItemSuporte[] = [];
  for (const fonte of perfil.suporte) {
    const issues = await buscar(jqlSuporte(fonte, periodo.inicio, periodo.fim), CAMPOS_BUSCA);
    suporte.push(...issues.map((i) => normalizarSuporte(i, perfil, fonte, cal))
      .filter((i): i is ItemSuporte => i !== null)
      // Sprint de uma frente só leva o suporte daquela frente (o projeto é compartilhado).
      .filter((i) => !periodo.frente || (i.frente ?? "").split(", ").includes(periodo.frente)));
  }

  await gravar(perfil, periodo, delivery, suporte);
  return { time: perfil.time, periodoId: periodo.periodoId, delivery: delivery.length, suporte: suporte.length };
}

/** Idempotente: o período é regravado por inteiro (chave time + periodo_id). */
async function gravar(perfil: Perfil, p: Periodo, delivery: ItemDelivery[], suporte: ItemSuporte[]) {
  const sql = db();
  const comandos = [
    sql`delete from periodos where time = ${perfil.time} and periodo_id = ${p.periodoId}`,
    sql`insert into periodos (time, periodo_id, tipo, nome, frente, inicio, fim, metodologia)
        values (${perfil.time}, ${p.periodoId}, ${p.tipo}, ${p.nome}, ${p.frente}, ${p.inicio}, ${p.fim}, ${perfil.metodologia})`,
    ...delivery.map((i) => sql`
      insert into itens_delivery (time, periodo_id, chave, frente, tipo_jira, tipo_canonico, sp_sdd, sp_sem_sdd, sp_original,
        planejamento, categoria_roadmap, status_jira, etapa_final, entregue, entregue_em, cycle_time_dias, cycle_time_horas)
      values (${perfil.time}, ${p.periodoId}, ${i.chave}, ${i.frente}, ${i.tipoJira}, ${i.tipoCanonico}, ${i.spSdd}, ${i.spSemSdd},
        ${i.spOriginal}, ${i.planejamento}, ${i.categoriaRoadmap}, ${i.statusJira}, ${i.etapaFinal}, ${i.entregue},
        ${i.entregueEm}, ${i.cycleTimeDias}, ${i.cycleTimeHoras})`),
    ...suporte.map((i) => sql`
      insert into itens_suporte (time, periodo_id, projeto, chave, frente, nivel, papel, status_jira, etapa_final,
        criado_em, resolvido_em, tempo_resolucao_dias, tempo_resolucao_horas, na_sprint)
      values (${perfil.time}, ${p.periodoId}, ${i.projeto}, ${i.chave}, ${i.frente}, ${i.nivel}, ${i.papel}, ${i.statusJira},
        ${i.etapaFinal}, ${i.criadoEm}, ${i.resolvidoEm}, ${i.tempoResolucaoDias}, ${i.tempoResolucaoHoras}, ${i.naSprint})
      on conflict (time, periodo_id, chave) do nothing`),
  ];
  await sql.transaction(comandos);
}

export async function registrarColeta(evento: string, time: string, periodoId: string, status: "ok" | "erro", detalhe?: string) {
  await db()`insert into coletas (evento, time, periodo_id, status, detalhe) values (${evento}, ${time}, ${periodoId}, ${status}, ${detalhe ?? null})`;
}
