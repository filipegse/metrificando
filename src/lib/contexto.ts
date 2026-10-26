// Contexto de calendário de um período: dias úteis, feriados e dias não úteis, e ausências (férias, folgas,
// licenças) de quem estava alocado no time/frente. Explica variações de vazão e capacidade — não é métrica
// de desempenho individual.
import { diasUteis, ehDiaUtil, type Calendario } from "./calendario";

export type FeriadoCtx = { data: string; nome: string; abrangencia: string };
export type AlocacaoCtx = { pessoa_id: number; time: string; frente: string; inicio: string; fim: string | null };
export type AusenciaCtx = { pessoa_id: number; nome: string; tipo: string; inicio: string; fim: string };

export type ContextoPeriodo = {
  diasUteis: number;
  /** Fins de semana e feriados dentro do período. */
  diasNaoUteis: number;
  feriados: FeriadoCtx[];
  ausencias: { pessoa: string; tipo: string; de: string; ate: string; diasUteis: number }[];
};

const DIA = 86400000;
const dias = (de: string, ate: string) => {
  const r: string[] = [];
  for (let t = Date.parse(`${de}T12:00:00Z`); t <= Date.parse(`${ate}T12:00:00Z`); t += DIA) r.push(new Date(t).toISOString().slice(0, 10));
  return r;
};

export function contextoDoPeriodo(
  alvo: { time: string; frente?: string }, de: string, ate: string, cal: Calendario,
  feriados: FeriadoCtx[], alocacoes: AlocacaoCtx[], ausencias: AusenciaCtx[],
): ContextoPeriodo {
  const todos = dias(de, ate);
  const uteis = diasUteis(de, ate, cal);
  // Quem estava no time (e na frente, quando o período é de frente) em algum dia do período.
  const membros = new Set(alocacoes.filter((a) => a.time === alvo.time && (!alvo.frente || !a.frente || a.frente === alvo.frente)
    && a.inicio <= ate && (!a.fim || a.fim >= de)).map((a) => a.pessoa_id));
  return {
    diasUteis: uteis.length,
    diasNaoUteis: todos.filter((d) => !ehDiaUtil(d, cal)).length,
    feriados: feriados.filter((f) => f.data >= de && f.data <= ate).sort((a, b) => a.data.localeCompare(b.data)),
    ausencias: ausencias.filter((x) => membros.has(x.pessoa_id) && x.inicio <= ate && x.fim >= de).map((x) => {
      const ini = x.inicio > de ? x.inicio : de, fim = x.fim < ate ? x.fim : ate;
      return { pessoa: x.nome, tipo: x.tipo, de: ini, ate: fim, diasUteis: diasUteis(ini, fim, cal).length };
    }).sort((a, b) => a.de.localeCompare(b.de)),
  };
}

/** Junta os contextos das semanas/sprints de um grupo (quinzena, mês, trimestre). */
export function juntarContextos(cs: (ContextoPeriodo | undefined)[]): ContextoPeriodo | undefined {
  const v = cs.filter((c): c is ContextoPeriodo => !!c);
  if (!v.length) return undefined;
  const unico = <T,>(xs: T[], k: (x: T) => string) => [...new Map(xs.map((x) => [k(x), x])).values()];
  return {
    diasUteis: v.reduce((s, c) => s + c.diasUteis, 0),
    diasNaoUteis: v.reduce((s, c) => s + c.diasNaoUteis, 0),
    feriados: unico(v.flatMap((c) => c.feriados), (f) => f.data),
    ausencias: v.flatMap((c) => c.ausencias),
  };
}

/** Resumo curto: "1 feriado · férias 2 · licença 1" (pessoas por tipo). */
export function resumoContexto(c?: ContextoPeriodo): string {
  if (!c) return "—";
  const partes: string[] = [];
  if (c.feriados.length) partes.push(`${c.feriados.length} feriado${c.feriados.length > 1 ? "s" : ""}`);
  const porTipo = new Map<string, Set<string>>();
  for (const a of c.ausencias) { if (!porTipo.has(a.tipo)) porTipo.set(a.tipo, new Set()); porTipo.get(a.tipo)!.add(a.pessoa); }
  for (const [t, ps] of porTipo) partes.push(`${t.toLowerCase()} ${ps.size}`);
  return partes.join(" · ") || "—";
}

export const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Detalhe para tooltip/slide: uma linha por feriado e por ausência. */
export function detalheContexto(c?: ContextoPeriodo): string[] {
  if (!c) return [];
  return [
    ...c.feriados.map((f) => `Feriado ${dataCurta(f.data)}: ${f.nome}`),
    ...c.ausencias.map((a) => `${a.pessoa}: ${a.tipo.toLowerCase()} ${dataCurta(a.de)}${a.de !== a.ate ? `–${dataCurta(a.ate)}` : ""} (${a.diasUteis} d.u.)`),
  ];
}
