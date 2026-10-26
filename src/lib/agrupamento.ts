// Agrupamento dos períodos do deck: cada grupo mostra a MÉDIA dos períodos que o compõem
// (média semanal no Kanban, média por sprint no Scrum).
import type { Indicadores } from "./indicadores";
import { juntarContextos } from "./contexto";

export const AGRUPAMENTOS = ["periodo", "quinzena", "mes", "trimestre"] as const;
export type Agrupamento = (typeof AGRUPAMENTOS)[number];

const DIA = 86400000;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const ddmm = (t: number) => new Date(t).toISOString().slice(0, 10).split("-").reverse().slice(0, 2).join("/");

/**
 * Junta semanas em quinzenas mostrando a MÉDIA SEMANAL da quinzena: contagens, pontos, composição, hora extra,
 * chamados e capacidade são a média das semanas do par; percentuais do tech lead e ganho SDD são ponderados
 * (por itens e por pontos); tempo de ciclo é a média ponderada por itens dos P50/P85 semanais (aproximação:
 * o percentil da quinzena exigiria os itens); saúde é a média das semanas com resposta.
 */
/** Quinzenas fixas a partir do sábado-âncora do time (mesmo corte da planilha Kanban: EFC 20/06–03/07, IC 27/06–10/07…). */
export const agregarQuinzenas = (semanas: Indicadores[], ancora = "2026-06-20") => agrupar(semanas, "quinzena", ancora);

/** Mês e trimestre pela data de fim do período (como o deck decide em que trimestre um período entra). */
export function agrupar(ps: Indicadores[], modo?: Agrupamento, ancora = "2026-06-20"): Indicadores[] {
  if (!modo || modo === "periodo" || !ps.length) return ps;
  const ANCORA_QUINZENA = Date.parse(ancora);
  const chave = (p: Indicadores) => {
    if (modo === "quinzena") return Math.floor((Date.parse(p.periodo.inicio.slice(0, 10)) - ANCORA_QUINZENA) / (14 * DIA));
    const [a, m] = p.periodo.fim.slice(0, 7).split("-").map(Number);
    return modo === "mes" ? a * 12 + (m - 1) : a * 4 + Math.floor((m - 1) / 3);
  };
  const semanas = ps;
  const grupos = new Map<number, Indicadores[]>();
  for (const s of semanas) {
    const k = chave(s);
    grupos.set(k, [...(grupos.get(k) ?? []), s]);
  }
  const soma = (xs: (number | null | undefined)[]) => (xs.some((x) => x != null) ? xs.reduce<number>((a, x) => a + (x ?? 0), 0) : null);
  const ponderada = (xs: [number | null | undefined, number][]) => {
    const v = xs.filter(([x]) => x != null) as [number, number][];
    const p = v.reduce((a, [, w]) => a + w, 0);
    return v.length ? (p ? v.reduce((a, [x, w]) => a + x * w, 0) / p : v.reduce((a, [x]) => a + x, 0) / v.length) : null;
  };
  const media = (xs: (number | null)[]) => ponderada(xs.map((x) => [x, 1]));
  const somaMapa = (ms: Record<string, number>[]) => ms.reduce<Record<string, number>>((a, m) => { for (const [k, v] of Object.entries(m)) a[k] = (a[k] ?? 0) + v; return a; }, {});
  return [...grupos.entries()].sort(([a], [b]) => a - b).map(([k, ps]) => {
    let ini: number, fim: number, nome: string, rotulo: string;
    if (modo === "quinzena") {
      ini = ANCORA_QUINZENA + k * 14 * DIA; fim = ini + 13 * DIA;
      nome = `${ddmm(ini)}–${ddmm(fim)}/${new Date(fim).getUTCFullYear()}`;
      rotulo = ddmm(ini + 2 * DIA); // primeira segunda-feira
    } else if (modo === "mes") {
      const a = Math.floor(k / 12), m = k % 12;
      ini = Date.UTC(a, m, 1); fim = Date.UTC(a, m + 1, 0);
      nome = rotulo = `${MESES[m]}/${String(a).slice(2)}`;
    } else {
      const a = Math.floor(k / 4), q = k % 4;
      ini = Date.UTC(a, q * 3, 1); fim = Date.UTC(a, q * 3 + 3, 0);
      nome = rotulo = `Q${q + 1} ${a}`;
    }
    const base = ps[ps.length - 1], n = ps.length;
    const med = (x: number | null) => (x == null ? null : Math.round((x / n) * 10) / 10);
    const medMapa = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).map(([c, v]) => [c, v / n]));
    return {
      ...base,
      periodo: { ...base.periodo, periodo_id: `g:${base.periodo.frente ?? ""}:${nome}`, nome, rotulo, inicio: new Date(ini).toISOString(), fim: new Date(fim).toISOString() },
      entrega: media(ps.map((p) => p.entrega)), extras: media(ps.map((p) => p.extras)), periodosNoGrupo: n,
      ptsSdd: med(ps.reduce((a, p) => a + p.ptsSdd, 0))!, ptsSemSdd: med(ps.reduce((a, p) => a + p.ptsSemSdd, 0))!,
      itensEntregues: med(ps.reduce((a, p) => a + p.itensEntregues, 0))!,
      cycleP50: ponderada(ps.map((p) => [p.cycleP50, p.itensEntregues])), cycleP85: ponderada(ps.map((p) => [p.cycleP85, p.itensEntregues])),
      cycleP50EhMedia: ps.some((p) => p.cycleP50EhMedia), cycleMedia: ponderada(ps.map((p) => [p.cycleMedia, p.itensEntregues])), cycleP50Alt: ponderada(ps.map((p) => [p.cycleP50Alt, p.itensEntregues])),
      porPlanejamento: medMapa(somaMapa(ps.map((p) => p.porPlanejamento))), porTipo: medMapa(somaMapa(ps.map((p) => p.porTipo))), porRoadmap: medMapa(somaMapa(ps.map((p) => p.porRoadmap))),
      chamados: med(soma(ps.map((p) => p.chamados))), chamadosN3: med(soma(ps.map((p) => p.chamadosN3))), trabalhoN3: med(soma(ps.map((p) => p.trabalhoN3))),
      resolucaoP50: ponderada(ps.map((p) => [p.resolucaoP50, p.chamados ?? 0])),
      produtividade: media(ps.map((p) => p.produtividade)), motivacao: media(ps.map((p) => p.motivacao)),
      esforcoSdd: med(soma(ps.map((p) => p.esforcoSdd))), ganhoSdd: ponderada(ps.map((p) => [p.ganhoSdd, p.ptsSdd])),
      pctItensTl: ponderada(ps.map((p) => [p.pctItensTl, p.itensEntregues])), pctPtsTl: ponderada(ps.map((p) => [p.pctPtsTl, p.ptsSdd])),
      horaExtraH: med(soma(ps.map((p) => p.horaExtraH))), itensHoraExtra: med(soma(ps.map((p) => p.itensHoraExtra))),
      // Grupo com semanas da planilha e do Jira: a fonte é mista.
      historico: ps.every((p) => p.historico) ? true : undefined,
      fontes: [...new Set(ps.map((p) => (p.historico ? "Planilha" : "Jira")))].join(" + "),
      contexto: juntarContextos(ps.map((p) => p.contexto)),
      capacidade: med(soma(ps.map((p) => p.capacidade))) ?? undefined,
    };
  });
}
