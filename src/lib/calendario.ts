// Tempo útil: segunda a sexta, dentro do expediente vigente na data, fora de feriados.
// Horário de referência America/Bahia (UTC-3, sem horário de verão).

export type Expediente = { validoDe: string; inicio: string; fim: string }; // "2026-01-01", "09:00", "18:48"
export type Calendario = { expedientes: Expediente[]; feriados: Set<string> };

const OFFSET_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const minutos = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + (m || 0); };

export const EXPEDIENTE_PADRAO: Expediente = { validoDe: "2000-01-01", inicio: "09:00", fim: "18:48" };

/** Expediente vigente no dia (o de `validoDe` mais recente que não passa do dia). */
export function expedienteDo(dia: string, cal: Calendario): Expediente {
  const vigentes = cal.expedientes.filter((e) => e.validoDe <= dia).sort((a, b) => a.validoDe.localeCompare(b.validoDe));
  return vigentes.at(-1) ?? EXPEDIENTE_PADRAO;
}

export function ehDiaUtil(dia: string, cal: Calendario): boolean {
  const semana = new Date(`${dia}T12:00:00Z`).getUTCDay();
  return semana !== 0 && semana !== 6 && !cal.feriados.has(dia);
}

/** Horas úteis e dias úteis entre dois instantes. Dia útil = horas úteis ÷ jornada daquele dia. */
export function tempoUtil(de: Date, ate: Date, cal: Calendario): { horas: number; dias: number } {
  if (!(ate > de)) return { horas: 0, dias: 0 };
  let horas = 0, dias = 0;
  const local = (d: Date) => new Date(d.getTime() - OFFSET_MS);
  const ini = local(de), fim = local(ate);
  for (let t = Date.UTC(ini.getUTCFullYear(), ini.getUTCMonth(), ini.getUTCDate()); t <= fim.getTime(); t += DIA_MS) {
    const dia = new Date(t).toISOString().slice(0, 10);
    if (!ehDiaUtil(dia, cal)) continue;
    const e = expedienteDo(dia, cal);
    const abre = t + minutos(e.inicio) * 60000, fecha = t + minutos(e.fim) * 60000;
    const util = Math.max(0, Math.min(fecha, fim.getTime()) - Math.max(abre, ini.getTime()));
    horas += util / 3600000;
    dias += util / (fecha - abre);
  }
  return { horas: Math.round(horas * 100) / 100, dias: Math.round(dias * 100) / 100 };
}

/** Dias úteis inteiros de um intervalo de datas (inclusivo), para capacidade. */
export function diasUteis(deDia: string, ateDia: string, cal: Calendario): string[] {
  const r: string[] = [];
  for (let t = Date.parse(`${deDia}T12:00:00Z`); t <= Date.parse(`${ateDia}T12:00:00Z`); t += DIA_MS) {
    const dia = new Date(t).toISOString().slice(0, 10);
    if (ehDiaUtil(dia, cal)) r.push(dia);
  }
  return r;
}
