// Health check do TeamRetro (modelo "Squad Feeling v2"). Só agregados por time: as notas
// chegam sem participante e nenhuma informação individual é gravada.

export const MODELO_SQUAD_FEELING_V2 = "6iaNqX7VjI9oXSFePawWV3";

export const DIMENSOES = {
  prodColetiva: "6KzngsKoNg7ZGjL14S1Xim",   // No geral, acredito que o sprint que acabamos de finalizar foi:
  prodIndividual: "0Uka84Ef62UlCYoVRFJfR1", // No geral, acredito que meu trabalho no sprint foi:
  motIndividual: "06RSWKOUBFkC53JZPt4d0T",  // Me senti motivado(a) com o trabalho desse sprint
  motColetiva: "18zD5p8A3icZs1rnXIChyM",    // Senti o time motivado(a) com o trabalho desse sprint
} as const;

export type HealthCheck = {
  id: string;
  title?: string;
  date: string;
  status: string;
  healthModel: { id: string; maxRating: number };
  dimensions: { id: string; ratings?: { rating: number }[] }[];
};

export type Saude = {
  healthCheckId: string;
  data: string;
  prodColetiva: number | null;
  prodIndividual: number | null;
  motIndividual: number | null;
  motColetiva: number | null;
  produtividade: number | null;
  motivacao: number | null;
  respostas: number;
};

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const par = (a: number | null, b: number | null, max: number) => (a == null || b == null ? null : (a + b) / 2 / max);

/** Produtividade = média(o sprint, meu trabalho) ÷ nota máxima; motivação idem com as duas de motivação. */
export function saudeDe(hc: HealthCheck): Saude {
  const notas = (id: string) => (hc.dimensions.find((d) => d.id === id)?.ratings ?? []).map((r) => r.rating);
  const m = (id: string) => media(notas(id));
  const max = hc.healthModel.maxRating;
  const v = {
    prodColetiva: m(DIMENSOES.prodColetiva), prodIndividual: m(DIMENSOES.prodIndividual),
    motIndividual: m(DIMENSOES.motIndividual), motColetiva: m(DIMENSOES.motColetiva),
  };
  return {
    healthCheckId: hc.id, data: hc.date, ...v,
    produtividade: par(v.prodColetiva, v.prodIndividual, max),
    motivacao: par(v.motIndividual, v.motColetiva, max),
    respostas: Math.max(0, ...Object.values(DIMENSOES).map((id) => notas(id).length)),
  };
}

type PeriodoRef = { periodo_id: string; tipo: string; inicio: string; fim: string; nome?: string | null; frente?: string };

/** Primeiro número com 2+ dígitos: "Sprint 110 - 13/10" → 110, "X-Reta | Sprint 132" → 132. */
export const numeroDe = (texto?: string | null) => texto?.match(/\d{2,}/)?.[0];

const DIA = 24 * 60 * 60 * 1000;
export const TOLERANCIA_DIAS = 7;

/**
 * Associa o health check ao período avaliado.
 * Sprint: a sprint cujo fim está mais próximo da data do health check (até 7 dias).
 * Semana Kanban: a janela que contém a data.
 */
export function periodoDoHealthCheck(data: string, periodos: PeriodoRef[], titulo?: string): string | null {
  // Número da sprint no título ("Retaguarda 109", "Fluig 82", "X-Reta | 131") tem prioridade sobre a data.
  const n = numeroDe(titulo);
  if (n) {
    const porNumero = periodos.find((p) => p.tipo === "sprint" && numeroDe(p.nome) === n);
    if (porNumero) return porNumero.periodo_id;
  }
  const t = new Date(`${data}T12:00:00-03:00`).getTime();
  // Datas sem hora (histórico das planilhas) valem o dia inteiro no horário da Bahia.
  const ms = (d: string, fimDoDia = false) => (d.length <= 10 ? new Date(`${d}T00:00:00-03:00`).getTime() + (fimDoDia ? DIA - 1 : 0) : new Date(d).getTime());
  const semana = periodos.find((p) => p.tipo === "semana" && t >= ms(p.inicio) && t <= ms(p.fim, true));
  if (semana) return semana.periodo_id;
  let melhor: { id: string; d: number } | null = null;
  for (const p of periodos.filter((p) => p.tipo === "sprint")) {
    const d = Math.abs(t - new Date(p.fim).getTime());
    if (d <= TOLERANCIA_DIAS * DIA && (!melhor || d < melhor.d)) melhor = { id: p.periodo_id, d };
  }
  return melhor?.id ?? null;
}

export async function listarHealthChecks(teamId: string, dateFrom: string, dateTo: string): Promise<HealthCheck[]> {
  const chave = process.env.TEAMRETRO_API_KEY;
  if (!chave) throw new Error("TEAMRETRO_API_KEY não configurado");
  const base = (process.env.TEAMRETRO_API_URL ?? "https://api.teamretro.com").replace(/\/$/, "");
  const url = new URL(`${base}/v1/health-checks`);
  url.search = new URLSearchParams({
    teamIds: teamId, healthModelIds: MODELO_SQUAD_FEELING_V2, dateFrom, dateTo, expand: "dimensions.ratings", limit: "50",
  }).toString();
  const resp = await fetch(url, { headers: { "X-API-KEY": chave, Accept: "application/json" } });
  if (!resp.ok) throw new Error(`TeamRetro ${resp.status}: ${await resp.text()}`);
  return ((await resp.json()).data as HealthCheck[]).filter((h) => h.status === "closed");
}

/**
 * Kanban: o health check avalia as semanas desde a data do título ("11.Q3.26 28/09") até a última sexta antes dele.
 * Sem data no título, avalia só a semana fechada mais recente antes do health check.
 * Devolve todas as semanas cobertas (cada uma recebe o mesmo resultado).
 */
export function semanasDoHealthCheck(data: string, titulo: string | undefined, periodos: PeriodoRef[]): string[] {
  const dia = (d: string, fim = false) => new Date(`${d.slice(0, 10)}T00:00:00-03:00`).getTime() + (fim ? DIA - 1 : 0);
  const hc = dia(data);
  const semanas = periodos.filter((p) => p.tipo === "semana" && dia(p.fim, true) < hc);
  const m = titulo?.match(/(\d{1,2})\/(\d{1,2})(?!\d)/);
  if (m) {
    let ano = Number(data.slice(0, 4));
    let inicio = Date.UTC(ano, Number(m[2]) - 1, Number(m[1]));
    if (inicio > hc) inicio = Date.UTC(--ano, Number(m[2]) - 1, Number(m[1]));
    const de = dia(new Date(inicio).toISOString());
    return semanas.filter((p) => dia(p.fim, true) >= de).map((p) => p.periodo_id);
  }
  const ultima = semanas.sort((a, b) => dia(b.fim) - dia(a.fim))[0];
  return ultima ? [ultima.periodo_id] : [];
}
