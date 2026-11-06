// Núcleo da coleta, sem rede e sem banco: decide o período e as consultas (planejar) e transforma as issues
// cruas em linhas do modelo canônico (montarGravacao). O n8n busca no Jira; as regras ficam só aqui.
import { CAMPOS, frenteDaSprint, perfilPorProjeto, type Perfil } from "../config/perfis.ts";
import type { Calendario } from "./calendario.ts";
import type { IssueJira } from "./jira.ts";
import { jqlDeliveryJanela, jqlDeliverySprint, jqlSuporte } from "./jql.ts";
import { normalizarDelivery, normalizarSuporte, type ItemDelivery, type ItemSuporte } from "./normalizar.ts";
import { janelaFechada } from "./periodo.ts";
import { norm } from "./tempoStatus.ts";

export type Evento =
  | { evento: "sprint_concluida"; projeto: string; sprint_id: string; sprint_nome?: string; inicio: string; fim: string }
  | { evento: "janela_semanal"; projeto: string; referencia?: string };

export type Periodo = { periodoId: string; tipo: "sprint" | "semana"; nome: string | null; frente: string; inicio: Date; fim: Date };

/** Uma consulta que o n8n executa no Jira (POST /rest/api/3/search/jql, expand=changelog, paginada). */
export type Consulta = { id: string; jql: string; fields: string[] };

export const CAMPOS_BUSCA = [
  "summary", "issuetype", "status", "created", "components", "priority", "assignee",
  ...Object.values(CAMPOS),
];

export const ID_DELIVERY = "delivery";
export const idSuporte = (projeto: string) => `suporte:${projeto}`;

export function periodoDoEvento(e: Evento, perfil: Perfil): Periodo {
  if (e.evento === "sprint_concluida") {
    if (perfil.metodologia !== "scrum") throw new Error(`${perfil.time} não está em Scrum`);
    return { periodoId: e.sprint_id, tipo: "sprint", nome: e.sprint_nome ?? null, frente: frenteDaSprint(perfil, e.sprint_nome), inicio: new Date(e.inicio), fim: new Date(e.fim) };
  }
  if (perfil.metodologia !== "kanban") throw new Error(`${perfil.time} não está em Kanban`);
  // Última janela já fechada no momento da referência (ou agora): sexta 23h = a que fecha agora; execução manual
  // em outro dia = a semana anterior.
  const j = janelaFechada(e.referencia ? new Date(e.referencia) : new Date());
  return { periodoId: j.periodoId, tipo: "semana", nome: null, frente: "", inicio: j.inicio, fim: j.fim };
}

export function planejar(e: Evento): { perfil: Perfil; periodo: Periodo; consultas: Consulta[] } {
  const perfil = perfilPorProjeto(e.projeto);
  if (!perfil) throw new Error(`Projeto sem perfil: ${e.projeto}`);
  const periodo = periodoDoEvento(e, perfil);
  const consultas: Consulta[] = [{
    id: ID_DELIVERY,
    jql: periodo.tipo === "sprint" ? jqlDeliverySprint(perfil, periodo.periodoId) : jqlDeliveryJanela(perfil, periodo.inicio, periodo.fim),
    fields: CAMPOS_BUSCA,
  }];
  for (const fonte of perfil.suporte) {
    consultas.push({ id: idSuporte(fonte.projeto), jql: jqlSuporte(fonte, periodo.inicio, periodo.fim), fields: CAMPOS_BUSCA });
  }
  return { perfil, periodo, consultas };
}

/** Alocação de tech lead (cadastro de Pessoas). O nome serve só para casar com o responsável e não é gravado. */
export type AlocacaoTL = { nome: string; inicio: string; fim: string | null };

export function itensDoTechLead(delivery: ItemDelivery[], tls: AlocacaoTL[]): Set<string> {
  return new Set(delivery.filter((i) => {
    if (!i.responsavel) return false;
    const dia = (i.entregueEm ?? new Date()).toISOString().slice(0, 10);
    return tls.some((t) => norm(t.nome) === norm(i.responsavel!) && t.inicio <= dia && (!t.fim || dia <= t.fim));
  }).map((i) => i.chave));
}

export type Gravacao = {
  periodo: Record<string, unknown>;
  delivery: Record<string, unknown>[];
  suporte: Record<string, unknown>[];
};

/**
 * Normaliza as issues cruas de cada consulta e devolve as linhas prontas para gravar_periodo()
 * (chaves = nomes das colunas). Sprint de uma frente só leva o suporte daquela frente.
 */
export function montarGravacao(perfil: Perfil, p: Periodo, cruas: Record<string, IssueJira[]>, cal: Calendario, tls: AlocacaoTL[]): Gravacao {
  const delivery = (cruas[ID_DELIVERY] ?? [])
    .map((i) => normalizarDelivery(i, perfil, cal))
    .filter((i): i is ItemDelivery => i !== null);

  const suporte: ItemSuporte[] = [];
  const vistos = new Set<string>();
  for (const fonte of perfil.suporte) {
    for (const i of (cruas[idSuporte(fonte.projeto)] ?? []).map((x) => normalizarSuporte(x, perfil, fonte, cal))) {
      if (!i || vistos.has(i.chave)) continue;
      if (p.frente && !(i.frente ?? "").split(", ").includes(p.frente)) continue;
      vistos.add(i.chave);
      suporte.push(i);
    }
  }

  const techLeads = itensDoTechLead(delivery, tls);
  const base = { time: perfil.time, periodo_id: p.periodoId };
  return {
    periodo: { ...base, tipo: p.tipo, nome: p.nome, frente: p.frente, inicio: p.inicio.toISOString(), fim: p.fim.toISOString(), metodologia: perfil.metodologia },
    delivery: delivery.map((i) => ({
      ...base, chave: i.chave, frente: i.frente, tipo_jira: i.tipoJira, tipo_canonico: i.tipoCanonico,
      sp_sdd: i.spSdd, sp_sem_sdd: i.spSemSdd, sp_original: i.spOriginal, planejamento: i.planejamento,
      categoria_roadmap: i.categoriaRoadmap, status_jira: i.statusJira, etapa_final: i.etapaFinal, entregue: i.entregue,
      entregue_em: i.entregueEm?.toISOString() ?? null, cycle_time_dias: i.cycleTimeDias, cycle_time_horas: i.cycleTimeHoras,
      ciclo_extra_horas: i.cicloExtraHoras, ciclo_dev_dias: i.cicloDevDias, ciclo_dev_horas: i.cicloDevHoras,
      ciclo_dev_extra_horas: i.cicloDevExtraHoras, prioridade: i.prioridade, urgente: i.urgente,
      por_tech_lead: techLeads.has(i.chave),
    })),
    suporte: suporte.map((i) => ({
      ...base, projeto: i.projeto, chave: i.chave, frente: i.frente, nivel: i.nivel, papel: i.papel,
      status_jira: i.statusJira, etapa_final: i.etapaFinal, criado_em: i.criadoEm.toISOString(),
      resolvido_em: i.resolvidoEm.toISOString(), tempo_resolucao_dias: i.tempoResolucaoDias,
      tempo_resolucao_horas: i.tempoResolucaoHoras, na_sprint: i.naSprint,
    })),
  };
}
