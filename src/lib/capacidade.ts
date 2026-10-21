// Capacidade em dias-dev: dias úteis do período em que cada Dev estava alocado, menos ausências, × % de alocação.
// Só o cargo Dev entra (Agilista, TL, PM, QA, PD e Suporte técnico ficam de fora).
import { diasUteis, type Calendario } from "./calendario";

export type AlocacaoCap = { pessoa_id: number; time: string; frente: string; cargo: string; percentual: number; inicio: string; fim: string | null };
export type AusenciaCap = { pessoa_id: number; inicio: string; fim: string };

export const CARGOS_NA_CAPACIDADE = new Set(["Dev"]);

export function capacidade(
  alocacoes: AlocacaoCap[], ausencias: AusenciaCap[], cal: Calendario,
  alvo: { time: string; frente?: string }, de: string, ate: string,
): number {
  let total = 0;
  for (const a of alocacoes) {
    if (!CARGOS_NA_CAPACIDADE.has(a.cargo) || a.time !== alvo.time) continue;
    if (alvo.frente && a.frente && a.frente !== alvo.frente) continue;
    const ini = a.inicio > de ? a.inicio : de;
    const fim = a.fim && a.fim < ate ? a.fim : ate;
    if (ini > fim) continue;
    const fora = ausencias.filter((x) => x.pessoa_id === a.pessoa_id);
    const dias = diasUteis(ini, fim, cal).filter((d) => !fora.some((x) => d >= x.inicio && d <= x.fim));
    total += dias.length * Number(a.percentual);
  }
  return Math.round(total * 10) / 10;
}
