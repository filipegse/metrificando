import { CAMPOS, TIPO_CANONICO, TIPO_SUPORTE, TIPOS_EXCLUIDOS, type FonteSuporte, type Perfil } from "../config/perfis";
import { etapa, ETAPAS_ENTREGUE, STATUS_N3 } from "../config/status";
import { transicoes, type IssueJira } from "./jira";
import { tempoUtil, type Calendario } from "./calendario";
import { jornadaHoras, norm, tempoPorStatus } from "./tempoStatus";

const CALENDARIO_VAZIO: Calendario = { expedientes: [], feriados: new Set() };


export type ItemDelivery = {
  chave: string;
  frente: string | null;
  tipoJira: string;
  tipoCanonico: string;
  spSdd: number | null;
  spSemSdd: number | null;
  spOriginal: number | null;
  planejamento: string | null;
  categoriaRoadmap: string | null;
  statusJira: string;
  etapaFinal: string;
  entregue: boolean;
  entregueEm: Date | null;
  /** Dias úteis (horas úteis ÷ jornada). Ciclo com "A Fazer" (soma do tempo por status, regra da planilha). */
  cycleTimeDias: number | null;
  cycleTimeHoras: number | null;
  cicloExtraHoras: number | null;
  /** Ciclo a partir do desenvolvimento (sem "A Fazer"). */
  cicloDevDias: number | null;
  cicloDevHoras: number | null;
  cicloDevExtraHoras: number | null;
  prioridade: string | null;
  urgente: boolean;
  /** Só para marcar itens do tech lead na coleta; o nome não é gravado. */
  responsavel: string | null;
};

export type ItemSuporte = {
  projeto: string;
  chave: string;
  frente: string | null;
  nivel: "N2" | "N3" | null;
  papel: FonteSuporte["papel"];
  statusJira: string;
  etapaFinal: string;
  criadoEm: Date;
  resolvidoEm: Date;
  tempoResolucaoDias: number;
  tempoResolucaoHoras: number;
  naSprint: boolean;
};

function valorOpcao(v: any): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map(valorOpcao).filter(Boolean).join(", ") || null;
  if (typeof v === "object") return v.value ?? v.name ?? null;
  return String(v);
}

function numero(v: any): number | null {
  return typeof v === "number" ? v : null;
}

export function frenteDe(issue: IssueJira, perfil: Perfil): string | null {
  if (!perfil.campoFrente) return null;
  if (perfil.campoFrente.id === "components") return valorOpcao(issue.fields.components);
  return valorOpcao(issue.fields[perfil.campoFrente.id]);
}

export function ehDelivery(tipo: string, perfil: Perfil): boolean {
  if (TIPOS_EXCLUIDOS.includes(tipo) || tipo === TIPO_SUPORTE) return false;
  return perfil.tiposDelivery ? perfil.tiposDelivery.includes(tipo) : true;
}

/**
 * Cycle time = da primeira saída de backlog/a_fazer até a última entrada em `entregue`, em tempo útil.
 * Aceita etapas puladas (ex.: TRG vai de validação direto para Concluído).
 */
export function cycleTime(issue: IssueJira, perfil: Perfil, cal: Calendario = CALENDARIO_VAZIO): { entregueEm: Date | null; dias: number | null; horas: number | null } {
  const ts = transicoes(issue);
  const fila = new Set(["backlog", "a_fazer", "despriorizado"]);
  const inicio = ts.find((t) => !fila.has(etapa(perfil.mapaDelivery, t.para)));
  const entregas = ts.filter((t) => ETAPAS_ENTREGUE.has(etapa(perfil.mapaDelivery, t.para)));
  const fim = entregas.at(-1);
  if (!fim) return { entregueEm: null, dias: null, horas: null };
  if (!inicio) return { entregueEm: fim.em, dias: null, horas: null };
  const t = tempoUtil(inicio.em, fim.em, cal);
  return { entregueEm: fim.em, dias: t.dias, horas: t.horas };
}

export function normalizarDelivery(issue: IssueJira, perfil: Perfil, cal: Calendario = CALENDARIO_VAZIO): ItemDelivery | null {
  const tipo: string = issue.fields.issuetype?.name ?? "";
  if (!ehDelivery(tipo, perfil)) return null;
  const status: string = issue.fields.status?.name ?? "";
  const etapaFinal = etapa(perfil.mapaDelivery, status);
  const { entregueEm } = cycleTime(issue, perfil, cal);
  const t = tempoPorStatus(issue.fields.created ? new Date(issue.fields.created) : null, transicoes(issue), cal);
  const temTempo = entregueEm != null && Object.keys(t.porStatus).length > 0;
  const jornada = entregueEm ? jornadaHoras(new Date(entregueEm.getTime() - 3 * 3600_000).toISOString().slice(0, 10), cal) : 9.8;
  const dias2 = (h: number) => Math.round((h / jornada) * 10000) / 10000;
  const prioridade = valorOpcao(issue.fields.priority);
  return {
    chave: issue.key,
    frente: frenteDe(issue, perfil),
    tipoJira: tipo,
    tipoCanonico: TIPO_CANONICO[tipo] ?? "outro",
    spSdd: numero(issue.fields[CAMPOS.spSdd]),
    spSemSdd: numero(issue.fields[CAMPOS.spSemSdd]),
    spOriginal: numero(issue.fields[CAMPOS.spOriginal]),
    planejamento: valorOpcao(issue.fields[CAMPOS.planejamento]),
    categoriaRoadmap: valorOpcao(issue.fields[CAMPOS.categoriaRoadmap]),
    statusJira: status,
    etapaFinal,
    entregue: ETAPAS_ENTREGUE.has(etapaFinal),
    entregueEm,
    cycleTimeDias: temTempo ? dias2(t.ciclo.util) : null,
    cycleTimeHoras: temTempo ? t.ciclo.util : null,
    cicloExtraHoras: temTempo ? t.ciclo.extra : null,
    cicloDevDias: temTempo ? dias2(t.cicloDev.util) : null,
    cicloDevHoras: temTempo ? t.cicloDev.util : null,
    cicloDevExtraHoras: temTempo ? t.cicloDev.extra : null,
    prioridade,
    // Urgente = prioridade Máxima (mesma regra do resumo semanal da planilha).
    urgente: norm(prioridade ?? "") === "maxima",
    responsavel: issue.fields.assignee?.displayName ?? null,
  };
}

/** Momento da resolução = última entrada no status de resolução da fonte. */
export function resolvidoEm(issue: IssueJira, fonte: FonteSuporte): Date | null {
  return transicoes(issue).filter((t) => t.para === fonte.statusResolucao).at(-1)?.em ?? null;
}

export function nivelDe(issue: IssueJira, fonte: FonteSuporte): "N2" | "N3" | null {
  if (fonte.papel === "trabalho_n3") return "N3";
  const temN3 = Object.values(fonte.mapa).includes("escalado_n3");
  if (!temN3) return null;
  return transicoes(issue).some((t) => t.para === STATUS_N3) ? "N3" : "N2";
}

export function normalizarSuporte(issue: IssueJira, perfil: Perfil, fonte: FonteSuporte, cal: Calendario = CALENDARIO_VAZIO): ItemSuporte | null {
  const resolvido = resolvidoEm(issue, fonte);
  if (!resolvido) return null;
  const criado = new Date(issue.fields.created);
  const status: string = issue.fields.status?.name ?? "";
  return {
    projeto: fonte.projeto,
    chave: issue.key,
    frente: frenteDe(issue, perfil),
    nivel: nivelDe(issue, fonte),
    papel: fonte.papel,
    statusJira: status,
    etapaFinal: etapa(fonte.mapa, status),
    criadoEm: criado,
    resolvidoEm: resolvido,
    ...(() => { const t = tempoUtil(criado, resolvido, cal); return { tempoResolucaoDias: t.dias, tempoResolucaoHoras: t.horas }; })(),
    naSprint: fonte.naSprint,
  };
}
