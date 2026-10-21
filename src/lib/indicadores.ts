// Indicadores por período para o modo apresentação. Funções puras (sem banco).
// Regras de cor seguem docs-ai-agilidade/.claude/skills/sync-agilidade-deck/references/layout.md.

export type LinhaDelivery = {
  periodo_id: string; tipo_canonico: string; sp_sdd: number | null; sp_sem_sdd: number | null;
  planejamento: string | null; categoria_roadmap: string | null; entregue: boolean; cycle_time_dias: number | null;
};
export type LinhaSuporte = { periodo_id: string; nivel: string | null; papel: string; tempo_resolucao_dias: number };
export type Periodo = { periodo_id: string; nome: string | null; tipo: string; inicio: string; fim: string };

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
  porPlanejamento: Record<string, number>;
  porTipo: Record<string, number>;
  porRoadmap: Record<string, number>;
  chamados: number;
  chamadosN3: number;
  trabalhoN3: number;
  resolucaoP50: number | null;
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

const soma = (xs: (number | null)[]) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);

function agrupar(itens: LinhaDelivery[], chave: (i: LinhaDelivery) => string): Record<string, number> {
  const r: Record<string, number> = {};
  for (const i of itens) r[chave(i)] = (r[chave(i)] ?? 0) + (i.sp_sdd ?? 0);
  return r;
}

export function indicadores(periodo: Periodo, delivery: LinhaDelivery[], suporte: LinhaSuporte[]): Indicadores {
  const d = delivery.filter((i) => i.periodo_id === periodo.periodo_id);
  const s = suporte.filter((i) => i.periodo_id === periodo.periodo_id);
  const entregues = d.filter((i) => i.entregue);
  const planejados = d.filter((i) => grupoPlanejamento(i.planejamento) === "Planejado");
  const ptsPlanejados = soma(planejados.map((i) => i.sp_sdd));
  const ptsSdd = soma(entregues.map((i) => i.sp_sdd));
  const ptsNaoPlanejados = soma(entregues.filter((i) => ["Extra", "Bônus"].includes(grupoPlanejamento(i.planejamento))).map((i) => i.sp_sdd));
  const sprint = periodo.tipo === "sprint";
  const cycles = entregues.map((i) => i.cycle_time_dias).filter((x): x is number => x != null);
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
    porPlanejamento: agrupar(entregues, (i) => grupoPlanejamento(i.planejamento)),
    porTipo: agrupar(entregues, (i) => i.tipo_canonico),
    porRoadmap: agrupar(entregues, (i) => i.categoria_roadmap ?? "Sem categoria"),
    chamados: chamados.length,
    chamadosN3: chamados.filter((i) => i.nivel === "N3").length,
    trabalhoN3: s.filter((i) => i.papel === "trabalho_n3").length,
    resolucaoP50: percentil(chamados.map((i) => i.tempo_resolucao_dias), 0.5),
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
