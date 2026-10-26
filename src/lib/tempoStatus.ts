// Tempo de ciclo por soma do tempo em cada status, como o script da planilha Kanban (tempo por status — IC e EFC).
// - Começa na criação do item; o tempo em Backlog, Aberto/Aberta e Concluído não conta.
// - Duas contagens: com "A Fazer" (fila do time) e a partir do desenvolvimento (sem "A Fazer"),
//   para os times que só contam depois que o desenvolvedor puxa o ticket.
// - Hora extra: janelas fora do expediente (7h até a abertura e do fechamento até 23h em dia útil; 7h–23h em
//   fim de semana e feriado), contadas só quando o item teve alguma movimentação naquela janela do dia.
import { ehDiaUtil, expedienteDo, type Calendario } from "./calendario";

const MIN = 60_000, HORA = 60 * MIN, DIA = 24 * HORA;
const OFFSET = 3 * HORA; // America/Bahia (UTC-3, sem horário de verão)
const minutos = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + (m || 0); };
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export const STATUS_IGNORADOS = ["backlog", "aberto", "aberta", "concluido"];
export const STATUS_FILA = ["a fazer"];
const EXTRA_ANTES = 7 * 60, EXTRA_DEPOIS = 23 * 60;

type Mov = { de: string; para: string; em: Date };
export type Horas = { util: number; extra: number };
export type TempoItem = {
  porStatus: Record<string, Horas & { passagens: number }>;
  /** Com "A Fazer". */
  ciclo: Horas;
  /** A partir do desenvolvimento (sem "A Fazer"). */
  cicloDev: Horas;
};

const sobrepoe = (a: number, b: number, w0: number, w1: number) => Math.max(0, Math.min(b, w1) - Math.max(a, w0)) / HORA;

/** Horas úteis e extras entre dois instantes (ms em hora local representada como UTC). */
function horas(ini: number, fim: number, movs: number[], cal: Calendario): Horas {
  let util = 0, extra = 0;
  for (let d = Math.floor(ini / DIA) * DIA; d <= fim; d += DIA) {
    const dia = new Date(d).toISOString().slice(0, 10);
    const janelas: [number, number][] = [];
    if (ehDiaUtil(dia, cal)) {
      const e = expedienteDo(dia, cal), abre = minutos(e.inicio), fecha = minutos(e.fim);
      util += sobrepoe(ini, fim, d + abre * MIN, d + fecha * MIN);
      janelas.push([EXTRA_ANTES, abre], [fecha, EXTRA_DEPOIS]);
    } else janelas.push([EXTRA_ANTES, EXTRA_DEPOIS]);
    for (const [a, b] of janelas) {
      const w0 = d + a * MIN, w1 = d + b * MIN;
      if (movs.some((m) => m >= w0 && m < w1)) extra += sobrepoe(ini, fim, w0, w1);
    }
  }
  return { util, extra };
}

export function tempoPorStatus(criado: Date | null, transicoes: Mov[], cal: Calendario): TempoItem {
  const local = (d: Date) => d.getTime() - OFFSET;
  const lista = [...transicoes].sort((a, b) => a.em.getTime() - b.em.getTime());
  const movs = lista.map((t) => local(t.em));
  const porStatus: TempoItem["porStatus"] = {};
  const ciclo = { util: 0, extra: 0 }, cicloDev = { util: 0, extra: 0 };
  if (!lista.length) return { porStatus, ciclo, cicloDev };
  let anterior = criado && local(criado) <= movs[0] ? local(criado) : movs[0];
  lista.forEach((t, k) => {
    const st = norm(t.de);
    if (!STATUS_IGNORADOS.includes(st)) {
      const h = horas(anterior, movs[k], movs, cal);
      const s = (porStatus[t.de] ??= { util: 0, extra: 0, passagens: 0 });
      s.util += h.util; s.extra += h.extra; s.passagens++;
      ciclo.util += h.util; ciclo.extra += h.extra;
      if (!STATUS_FILA.includes(st)) { cicloDev.util += h.util; cicloDev.extra += h.extra; }
    }
    anterior = movs[k];
  });
  const r = (x: number) => Math.round(x * 10000) / 10000;
  return { porStatus, ciclo: { util: r(ciclo.util), extra: r(ciclo.extra) }, cicloDev: { util: r(cicloDev.util), extra: r(cicloDev.extra) } };
}

/** Jornada (horas) do expediente vigente no dia, para converter horas úteis em dias úteis. */
export function jornadaHoras(dia: string, cal: Calendario) {
  const e = expedienteDo(dia, cal);
  return (minutos(e.fim) - minutos(e.inicio)) / 60;
}
