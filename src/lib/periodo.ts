// Janela de medição Kanban: sábado 00:00 a sexta 23:59:59, horário de America/Bahia (UTC-3, sem horário de verão).
const OFFSET_BAHIA_MS = 3 * 60 * 60 * 1000;

export type Janela = { periodoId: string; inicio: Date; fim: Date };

/** Janela sábado–sexta que contém `referencia` (ou que acabou de fechar, se for sexta à noite). */
export function janelaSemanal(referencia: Date): Janela {
  const local = new Date(referencia.getTime() - OFFSET_BAHIA_MS);
  const diasDesdeSabado = (local.getUTCDay() + 1) % 7; // sáb=0 ... sex=6
  const sabadoLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - diasDesdeSabado);
  const inicio = new Date(sabadoLocal + OFFSET_BAHIA_MS);
  const fim = new Date(inicio.getTime() + 7 * 24 * 60 * 60 * 1000 - 1000);
  return { periodoId: new Date(sabadoLocal).toISOString().slice(0, 10), inicio, fim };
}
