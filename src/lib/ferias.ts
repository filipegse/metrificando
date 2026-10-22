// Tempo sem férias registradas: sinal de atenção quando se aproxima de 1 ano.

export type AusenciaFerias = { pessoa_id: number; inicio: string; fim: string; tipo: string };
export type SemFerias = {
  /** Data de referência da contagem: fim das últimas férias até hoje ou, sem férias registradas, a entrada mais antiga. */
  desde: string;
  dias: number;
  meses: number;
  nivel: "ok" | "atencao" | "critico";
  /** Férias já marcadas depois de hoje, se houver. */
  proximas?: { inicio: string; fim: string };
  semRegistro: boolean;
  texto: string;
};

const DIA = 86400000;
const br = (d: string) => d.split("-").reverse().join("/");

/** Atenção a partir de 10 meses sem férias; crítico a partir de 12. */
export const MESES_ATENCAO = 10;
export const MESES_CRITICO = 12;

export function tempoSemFerias(pessoaId: number, entrada: string | null, ausencias: AusenciaFerias[], hoje: string): SemFerias | null {
  const ferias = ausencias.filter((a) => a.pessoa_id === pessoaId && a.tipo === "Férias");
  // Férias em curso hoje: não há alerta.
  if (ferias.some((f) => f.inicio <= hoje && f.fim >= hoje)) return null;
  const passadas = ferias.filter((f) => f.fim < hoje).sort((a, b) => a.fim.localeCompare(b.fim));
  const ultima = passadas.at(-1);
  const desde = ultima?.fim ?? entrada;
  if (!desde) return null;
  const dias = Math.max(0, Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / DIA));
  const meses = Math.floor(dias / 30.44);
  const proximas = ferias.filter((f) => f.inicio > hoje).sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
  const nivel = meses >= MESES_CRITICO ? "critico" : meses >= MESES_ATENCAO ? "atencao" : "ok";
  const tempo = meses >= 1 ? `${meses} ${meses === 1 ? "mês" : "meses"}` : `${dias} dias`;
  const base = ultima
    ? `Sem férias há ${tempo} (últimas terminaram em ${br(ultima.fim)}).`
    : `Nenhuma férias registrada desde a entrada em ${br(desde)} (${tempo}).`;
  const futuro = proximas ? ` Próximas férias marcadas: ${br(proximas.inicio)} a ${br(proximas.fim)}.` : " Sem férias futuras marcadas.";
  return { desde, dias, meses, nivel, proximas: proximas && { inicio: proximas.inicio, fim: proximas.fim }, semRegistro: !ultima, texto: base + futuro };
}
