// Situação de férias de funcionários (CLT): a cada 12 meses de casa (período aquisitivo) a pessoa ganha férias,
// que devem ser tiradas nos 12 meses seguintes (período concessivo). Terceirizados não entram.
//
// Aviso: a partir do 22º mês de um período aquisitivo ainda sem férias (12 do aquisitivo + 10 do concessivo),
// ou seja, faltando 2 meses para o fim do prazo. Crítico: prazo vencido (24 meses).

export type AusenciaFerias = { pessoa_id: number; inicio: string; fim: string; tipo: string };
export type SemFerias = {
  /** Início do período aquisitivo pendente. */
  desde: string;
  /** Meses desde o início desse período aquisitivo. */
  meses: number;
  dias: number;
  nivel: "ok" | "atencao" | "critico";
  /** Até quando as férias desse período precisam começar. */
  prazo: string;
  proximas?: { inicio: string; fim: string };
  semRegistro: boolean;
  texto: string;
};

export const MES_AVISO = 22;
/**
 * Data de corte: períodos cujo prazo terminou antes dela são ignorados (sem histórico confiável de férias antes disso).
 * Só são avaliados os períodos com prazo a partir de 01/09/2026.
 */
export const CORTE_FERIAS = "2026-09-01";
export const MES_VENCIDO = 24;

const br = (d: string) => d.split("-").reverse().join("/");
function somaMeses(dia: string, meses: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}
function mesesEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.split("-").map(Number), [a2, m2, d2] = ate.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

/**
 * `admissao`: data em que a pessoa virou funcionária (contratação ou efetivação do terceirizado).
 * Cada período aquisitivo k começa em admissão + 12k meses; ele é atendido se houver férias iniciadas
 * no período concessivo correspondente [admissão + 12(k+1), admissão + 12(k+2)).
 */
export function tempoSemFerias(pessoaId: number, admissao: string | null, ausencias: AusenciaFerias[], hoje: string): SemFerias | null {
  if (!admissao || admissao > hoje) return null;
  const ferias = ausencias.filter((a) => a.pessoa_id === pessoaId && a.tipo === "Férias").sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (ferias.some((f) => f.inicio <= hoje && f.fim >= hoje)) return null; // de férias agora
  const proximas = ferias.find((f) => f.inicio > hoje);

  // Primeiro período aquisitivo já completo e ainda sem férias no seu prazo.
  for (let k = 0; ; k++) {
    const aquisitivo = somaMeses(admissao, 12 * k);
    const abre = somaMeses(admissao, 12 * (k + 1)), prazo = somaMeses(admissao, 12 * (k + 2));
    if (abre > hoje) return null; // período ainda em aquisição: nada a cobrar
    if (prazo < CORTE_FERIAS) continue; // prazo anterior à data de corte: ignorado
    const atendido = ferias.some((f) => f.inicio >= abre && f.inicio < prazo);
    if (atendido) continue;
    const meses = mesesEntre(aquisitivo, hoje);
    const dias = Math.round((Date.parse(hoje) - Date.parse(aquisitivo)) / 86400000);
    const nivel = meses >= MES_VENCIDO ? "critico" : meses >= MES_AVISO ? "atencao" : "ok";
    // Férias marcadas dentro do prazo já atendem o período (tratado acima); aqui só podem estar depois do prazo.
    const situacao = nivel === "critico"
      ? `Férias do período ${br(aquisitivo)}–${br(somaMeses(abre, 0))} vencidas desde ${br(prazo)}.`
      : `Férias do período iniciado em ${br(aquisitivo)} ainda não tiradas (${meses} de 24 meses); prazo até ${br(prazo)}.`;
    const futuro = proximas
      ? ` Próximas férias marcadas: ${br(proximas.inicio)} a ${br(proximas.fim)}${proximas.inicio < prazo ? "" : " (depois do prazo)"}.`
      : " Sem férias futuras marcadas.";
    return { desde: aquisitivo, meses, dias, nivel, prazo, proximas: proximas && { inicio: proximas.inicio, fim: proximas.fim },
      semRegistro: !ferias.some((f) => f.inicio <= hoje), texto: situacao + futuro };
  }
}
