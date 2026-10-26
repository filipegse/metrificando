// Indicadores por período para o modo apresentação. Funções puras (sem banco).
// Regras de cor seguem docs-ai-agilidade/.claude/skills/sync-agilidade-deck/references/layout.md.

export type LinhaDelivery = {
  periodo_id: string; tipo_canonico: string; sp_sdd: number | null; sp_sem_sdd: number | null;
  planejamento: string | null; categoria_roadmap: string | null; entregue: boolean; cycle_time_dias: number | null;
  tipo_jira?: string; ciclo_dev_dias?: number | null; ciclo_extra_horas?: number | null; ciclo_dev_extra_horas?: number | null;
  urgente?: boolean | null; por_tech_lead?: boolean | null;
};
/** De onde o tempo de ciclo do relatório começa: com "A Fazer" ou só depois que o dev puxa o ticket. */
export type CicloDesde = "a_fazer" | "desenvolvimento";
export type LinhaSuporte = { periodo_id: string; nivel: string | null; papel: string; tempo_resolucao_dias: number };
export type LinhaSaude = { periodo_id: string; frente?: string; produtividade: number | null; motivacao: number | null; respostas: number };
export type Periodo = { periodo_id: string; nome: string | null; tipo: string; inicio: string; fim: string; frente?: string; /** rótulo pronto de um período agrupado */ rotulo?: string };

export type Indicadores = {
  periodo: Periodo;
  /** Pontos planejados concluídos / pontos planejados (fração). Só Scrum. */
  entrega: number | null;
  /** Pontos extras + bônus concluídos / pontos concluídos (fração). Só Scrum. */
  extras: number | null;
  ptsSdd: number;
  ptsSemSdd: number;
  itensEntregues: number;
  cycleP50: number | null;
  cycleP85: number | null;
  /** Média do tempo de ciclo (o padrão dos relatórios é o P50). */
  cycleMedia?: number | null;
  /** O "P50" exibido é a média (histórico sem mediana). */
  cycleP50EhMedia?: boolean;
  /** Contagem alternativa (a outra regra de início), para comparação. */
  cycleP50Alt?: number | null;
  porPlanejamento: Record<string, number>;
  porTipo: Record<string, number>;
  porRoadmap: Record<string, number>;
  /** null quando o período veio do histórico das planilhas, que não tem suporte. */
  chamados: number | null;
  chamadosN3: number | null;
  trabalhoN3: number | null;
  resolucaoP50: number | null;
  /** Health check do TeamRetro (fração 0–1). */
  produtividade: number | null;
  motivacao: number | null;
  /** Só no histórico das planilhas (a coleta do Jira não calcula). */
  esforcoSdd?: number | null;
  /** Participação do tech lead no período (fração 0–1), da planilha Kanban. */
  pctItensTl?: number | null;
  pctPtsTl?: number | null;
  /** Quantos períodos (semanas ou sprints) foram agrupados neste. */
  periodosNoGrupo?: number;
  /** Horas trabalhadas fora do expediente nos itens do período e quantos itens tiveram hora extra. */
  horaExtraH?: number | null;
  itensHoraExtra?: number | null;
  /** Dias-dev disponíveis no período (cadastro de pessoas, ausências e feriados). */
  capacidade?: number;
  ganhoSdd?: number | null;
  historico?: boolean;
  /** Histórico: se a composição veio em pontos ou em quantidade de itens. */
  medidaComposicao?: Partial<Record<"porPlanejamento" | "porTipo" | "porRoadmap", "pontos" | "itens" | null>>;
};

export type Semaforo = "bom" | "atencao" | "ruim" | "neutro";

export function percentil(valores: number[], p: number): number | null {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const i = (v.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return v[lo] + (v[hi] - v[lo]) * (i - lo);
}

export function grupoPlanejamento(valor: string | null): "Planejado" | "Extra" | "Bônus" | "Sem classificação" {
  const v = (valor ?? "").toLowerCase();
  if (v.includes("bônus") || v.includes("bonus")) return "Bônus";
  if (v.includes("extra")) return "Extra";
  if (v.startsWith("planejado")) return "Planejado";
  return "Sem classificação";
}

const soma = (xs: (number | null | undefined)[]) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);

function agrupar(itens: LinhaDelivery[], chave: (i: LinhaDelivery) => string): Record<string, number> {
  const r: Record<string, number> = {};
  for (const i of itens) r[chave(i)] = (r[chave(i)] ?? 0) + (i.sp_sdd ?? 0);
  return r;
}

export function indicadores(periodo: Periodo, delivery: LinhaDelivery[], suporte: LinhaSuporte[], saude: LinhaSaude[] = [],
  cicloDesde: CicloDesde = "a_fazer"): Indicadores {
  const h = saudeDoPeriodo(saude.filter((x) => x.periodo_id === periodo.periodo_id));
  const kanban = periodo.tipo === "semana";
  // Kanban (como a planilha): itens do tipo Ajuste não entram na vazão, nos pontos nem no tempo de ciclo.
  const d = delivery.filter((i) => i.periodo_id === periodo.periodo_id && !(kanban && (i.tipo_jira === "Ajuste" || i.tipo_canonico === "ajuste")));
  const s = suporte.filter((i) => i.periodo_id === periodo.periodo_id);
  const entregues = d.filter((i) => i.entregue);
  const planejados = d.filter((i) => grupoPlanejamento(i.planejamento) === "Planejado");
  const ptsPlanejados = soma(planejados.map((i) => i.sp_sdd));
  const ptsSdd = soma(entregues.map((i) => i.sp_sdd));
  const ptsNaoPlanejados = soma(entregues.filter((i) => ["Extra", "Bônus"].includes(grupoPlanejamento(i.planejamento))).map((i) => i.sp_sdd));
  const sprint = periodo.tipo === "sprint";
  const valores = (f: (i: LinhaDelivery) => number | null | undefined) => entregues.map(f).filter((x): x is number => x != null);
  const comFila = valores((i) => i.cycle_time_dias), semFila = valores((i) => i.ciclo_dev_dias);
  const [cycles, alt] = cicloDesde === "desenvolvimento" ? [semFila, comFila] : [comFila, semFila];
  const extra = entregues.map((i) => (cicloDesde === "desenvolvimento" ? i.ciclo_dev_extra_horas : i.ciclo_extra_horas));
  const temExtra = extra.some((x) => x != null);
  const temTl = entregues.some((i) => i.por_tech_lead != null);
  const tl = entregues.filter((i) => i.por_tech_lead);
  const temUrgencia = entregues.some((i) => i.urgente != null);
  const chamados = s.filter((i) => i.papel === "chamado");
  return {
    periodo,
    entrega: sprint && ptsPlanejados > 0 ? soma(planejados.filter((i) => i.entregue).map((i) => i.sp_sdd)) / ptsPlanejados : null,
    extras: sprint && ptsSdd > 0 ? ptsNaoPlanejados / ptsSdd : null,
    ptsSdd,
    ptsSemSdd: soma(entregues.map((i) => i.sp_sem_sdd)),
    itensEntregues: entregues.length,
    cycleP50: percentil(cycles, 0.5),
    cycleP85: percentil(cycles, 0.85),
    cycleMedia: cycles.length ? soma(cycles) / cycles.length : null,
    cycleP50Alt: percentil(alt, 0.5),
    // Kanban não tem planejamento: classe de serviço pela prioridade (urgente = Máxima).
    porPlanejamento: kanban && temUrgencia ? agrupar(entregues, (i) => (i.urgente ? "Urgente" : "Padrão"))
      : agrupar(entregues, (i) => grupoPlanejamento(i.planejamento)),
    porTipo: agrupar(entregues, (i) => i.tipo_canonico),
    porRoadmap: agrupar(entregues, (i) => i.categoria_roadmap ?? "Sem categoria"),
    chamados: chamados.length,
    chamadosN3: chamados.filter((i) => i.nivel === "N3").length,
    trabalhoN3: s.filter((i) => i.papel === "trabalho_n3").length,
    resolucaoP50: percentil(chamados.map((i) => i.tempo_resolucao_dias), 0.5),
    produtividade: h?.produtividade ?? null,
    motivacao: h?.motivacao ?? null,
    horaExtraH: temExtra ? soma(extra) : null,
    itensHoraExtra: temExtra ? extra.filter((x) => (x ?? 0) > 0).length : null,
    pctItensTl: temTl && entregues.length ? tl.length / entregues.length : null,
    pctPtsTl: temTl && ptsSdd ? soma(tl.map((i) => i.sp_sdd)) / ptsSdd : null,
  };
}

export function corEntrega(v: number | null): Semaforo {
  if (v == null) return "neutro";
  return v >= 1 ? "bom" : v < 0.8 ? "atencao" : "neutro";
}

export function corExtras(v: number | null): Semaforo {
  if (v == null) return "neutro";
  return v <= 0.1 ? "bom" : v > 0.2 ? "atencao" : "neutro";
}

/** Pontos entregues contra a mediana do próprio time no recorte. */
export function corPontos(v: number, mediana: number | null): Semaforo {
  if (!mediana) return "neutro";
  const r = v / mediana;
  return r >= 1.1 - 1e-9 ? "bom" : r <= 0.85 + 1e-9 ? "atencao" : "neutro";
}

/** Produtividade e motivação (health check): ≥ 90% bom, < 80% atenção. */
export function corSaude(v: number | null): Semaforo {
  if (v == null) return "neutro";
  return v >= 0.9 - 1e-9 ? "bom" : v < 0.8 ? "atencao" : "neutro";
}

/** Junta os health checks das frentes de um período em um valor do time, ponderado pelo nº de respostas. */
export function saudeDoPeriodo(linhas: LinhaSaude[]): { produtividade: number | null; motivacao: number | null } | undefined {
  if (!linhas.length) return undefined;
  const media = (campo: "produtividade" | "motivacao") => {
    const validas = linhas.filter((l) => l[campo] != null && l.respostas > 0);
    const peso = validas.reduce((s, l) => s + l.respostas, 0);
    return peso ? validas.reduce((s, l) => s + l[campo]! * l.respostas, 0) / peso : null;
  };
  return { produtividade: media("produtividade"), motivacao: media("motivacao") };
}

/** Ganho SDD: ≥ 19,5% bom, 5–19,4% atenção, < 5% ruim (faixas da Sync). */
export function corGanho(v: number | null | undefined): Semaforo {
  if (v == null) return "neutro";
  return v >= 0.195 ? "bom" : v >= 0.05 ? "atencao" : "ruim";
}

import { CATEGORIAS, colunaDe, type Grupo } from "./composicao";

export type LinhaHistoricoDeck = Record<string, unknown> & {
  nome: string; frente: string; tipo: string; inicio: string | null; fim: string;
  entrega: number | null; extras: number | null; pts_sdd: number | null; esforco_sdd: number | null; pts_sem_sdd: number | null;
  ganho_sdd: number | null; itens_entregues: number | null; cycle_p50: number | null; cycle_p85: number | null;
  produtividade: number | null; motivacao: number | null; pct_itens_tl?: number | null; pct_pts_tl?: number | null;
  hora_extra_h?: number | null; itens_hora_extra?: number | null; cycle_media?: number | null;
};

/** Composição do histórico: pontos por categoria; sem pontos no período, usa a quantidade de itens. */
function composicaoDe(h: LinhaHistoricoDeck, grupo: Grupo): { valores: Record<string, number>; medida: "pontos" | "itens" | null } {
  const cats = CATEGORIAS.filter((c) => c.grupo === grupo);
  for (const medida of ["pts", "itens"] as const) {
    const valores: Record<string, number> = {};
    for (const c of cats) {
      const v = h[colunaDe(grupo, c.chave, medida)];
      if (typeof v === "number") valores[c.deck] = v;
    }
    if (Object.values(valores).some((v) => v > 0)) return { valores, medida: medida === "pts" ? "pontos" : "itens" };
  }
  return { valores: {}, medida: null };
}

export function indicadoresDoHistorico(h: LinhaHistoricoDeck): Indicadores {
  const tipo = composicaoDe(h, "tipo"), plan = composicaoDe(h, "planejamento"), rm = composicaoDe(h, "roadmap");
  return {
    periodo: { periodo_id: `h:${h.nome}`, nome: h.nome, tipo: h.tipo, inicio: h.inicio ?? h.fim, fim: h.fim, frente: h.frente },
    entrega: h.entrega, extras: h.extras, ptsSdd: h.pts_sdd ?? 0, ptsSemSdd: h.pts_sem_sdd ?? 0,
    itensEntregues: h.itens_entregues ?? 0, cycleP85: h.cycle_p85, cycleMedia: h.cycle_media ?? null,
    // Sem P50 no histórico (planilha só trazia a média): exibe a média, sinalizada no deck.
    cycleP50: h.cycle_p50 ?? h.cycle_media ?? null, cycleP50EhMedia: h.cycle_p50 == null && h.cycle_media != null,
    porPlanejamento: plan.valores, porTipo: tipo.valores, porRoadmap: rm.valores,
    medidaComposicao: { porPlanejamento: plan.medida, porTipo: tipo.medida, porRoadmap: rm.medida },
    chamados: null, chamadosN3: null, trabalhoN3: null, resolucaoP50: null,
    produtividade: h.produtividade, motivacao: h.motivacao,
    esforcoSdd: h.esforco_sdd, ganhoSdd: h.ganho_sdd, historico: true,
    pctItensTl: h.pct_itens_tl ?? null, pctPtsTl: h.pct_pts_tl ?? null,
    horaExtraH: h.hora_extra_h ?? null, itensHoraExtra: h.itens_hora_extra ?? null,
  };
}

/** Entrega do tech lead a partir de 30% dos pontos ou dos itens do período merece destaque. */
export const LIMITE_TL = 0.3;
export const tlEmDestaque = (i: Pick<Indicadores, "pctItensTl" | "pctPtsTl">) =>
  (i.pctItensTl ?? 0) >= LIMITE_TL || (i.pctPtsTl ?? 0) >= LIMITE_TL;

/** Segunda-feira da semana Kanban (a janela vai de sábado a sexta; a interface mostra a segunda). */
export function segundaDaSemana(dia: string): string {
  const d = new Date(`${dia.slice(0, 10)}T12:00:00Z`);
  const dow = d.getUTCDay(); // sáb = 6 → +2; dom = 0 → +1; seg = 1 → 0
  d.setUTCDate(d.getUTCDate() + (dow === 6 ? 2 : dow === 0 ? 1 : 1 - dow));
  return d.toISOString().slice(0, 10);
}
