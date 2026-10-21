import { PERFIS, type Perfil } from "../config/perfis";
import { db } from "./db";
import { indicadores, type Indicadores, type LinhaDelivery, type LinhaSaude, type LinhaSuporte, type Periodo } from "./indicadores";

/** `frente` preenchida quando o time é apresentado por frente (cada uma com sprints próprias). */
export type DadosTime = { perfil: Perfil; frente?: string; periodos: Indicadores[] };

export const nomeDoTime = (t: DadosTime) => (t.frente && t.frente !== t.perfil.time ? `${t.perfil.time} · ${t.frente}` : t.perfil.time);
export type DadosDeck = { deck: string; rotulo: string; times: DadosTime[]; leituras: Record<string, string>; demo: boolean };

/** "2026-Q4" → intervalo do trimestre. */
export function intervaloTrimestre(deck: string): { de: string; ate: string; rotulo: string } {
  const m = /^(\d{4})-Q([1-4])$/.exec(deck);
  if (!m) throw new Error(`Trimestre inválido: ${deck} (use AAAA-QN)`);
  const ano = Number(m[1]), q = Number(m[2]);
  const de = new Date(Date.UTC(ano, (q - 1) * 3, 1));
  const ate = new Date(Date.UTC(ano, q * 3, 1));
  return { de: de.toISOString(), ate: ate.toISOString(), rotulo: `Q${q} ${ano}` };
}

export function trimestreAtual(agora = new Date()): string {
  return `${agora.getUTCFullYear()}-Q${Math.floor(agora.getUTCMonth() / 3) + 1}`;
}

export function chaveLeitura(time: string, slide: string) {
  return `${time}:${slide}`;
}

export async function carregarDeck(deck: string, projetos: string[]): Promise<DadosDeck> {
  const { de, ate, rotulo } = intervaloTrimestre(deck);
  const perfis = PERFIS.filter((p) => projetos.includes(p.projeto));
  const sql = db();
  const times: DadosTime[] = [];
  for (const perfil of perfis) {
    // Período entra no trimestre pela data de fim (sprint fechada / janela fechada).
    const periodos = (await sql`
      select periodo_id, nome, tipo, frente, inicio::text, fim::text from periodos
      where time = ${perfil.time} and fim >= ${de} and fim < ${ate} order by fim`) as Periodo[];
    const ids = periodos.map((p) => p.periodo_id);
    const delivery = (await sql`
      select periodo_id, tipo_canonico, sp_sdd::float, sp_sem_sdd::float, planejamento, categoria_roadmap, entregue, cycle_time_dias::float
      from itens_delivery where time = ${perfil.time} and periodo_id = any(${ids})`) as LinhaDelivery[];
    const suporte = (await sql`
      select periodo_id, nivel, papel, tempo_resolucao_dias::float
      from itens_suporte where time = ${perfil.time} and periodo_id = any(${ids})`) as LinhaSuporte[];
    const saude = (await sql`
      select periodo_id, frente, produtividade::float, motivacao::float, respostas
      from saude_time where time = ${perfil.time} and periodo_id = any(${ids})`) as LinhaSaude[];
    const todos = periodos.map((p) => indicadores(p, delivery, suporte, saude));
    if (perfil.sprintsPorFrente) {
      for (const { frente } of perfil.sprintsPorFrente) {
        times.push({ perfil, frente, periodos: todos.filter((i) => i.periodo.frente === frente) });
      }
    } else times.push({ perfil, periodos: todos });
  }
  const leituras: Record<string, string> = {};
  for (const l of (await sql`select time, slide, texto from leituras where deck = ${deck}`) as { time: string; slide: string; texto: string }[]) {
    leituras[chaveLeitura(l.time, l.slide)] = l.texto;
  }
  return { deck, rotulo, times, leituras, demo: false };
}

/** Dados fictícios para visualizar o deck antes de existir coleta. */
export function deckDemo(deck: string, projetos: string[]): DadosDeck {
  const { rotulo } = intervaloTrimestre(deck);
  let semente = 7;
  const rnd = () => ((semente = (semente * 9301 + 49297) % 233280) / 233280);
  const times = PERFIS.filter((p) => projetos.includes(p.projeto)).flatMap((perfil) =>
    (perfil.sprintsPorFrente?.map((f) => f.frente) ?? [undefined]).map((frente) => {
    const scrum = perfil.metodologia === "scrum";
    const n = scrum ? 5 : 12;
    const periodos: Indicadores[] = Array.from({ length: n }, (_, k) => {
      const pts = Math.round(35 + rnd() * 25);
      const extra = Math.round(pts * (0.05 + rnd() * 0.25));
      const chamados = Math.round(8 + rnd() * 20);
      return {
        periodo: { periodo_id: String(k), nome: scrum ? `${frente === "X-Retaguarda" ? "X-Reta | Sprint " : perfil.projeto + " "}${(frente === "X-Retaguarda" ? 128 : 60) + k}` : null, tipo: scrum ? "sprint" : "semana",
          inicio: new Date(Date.UTC(2026, 9, 1 + k * (scrum ? 14 : 7))).toISOString(),
          fim: new Date(Date.UTC(2026, 9, (k + 1) * (scrum ? 14 : 7))).toISOString() },
        entrega: scrum ? 0.7 + rnd() * 0.45 : null,
        extras: scrum ? extra / pts : null,
        ptsSdd: pts, ptsSemSdd: Math.round(pts * (1.2 + rnd() * 0.5)),
        itensEntregues: Math.round(6 + rnd() * 10),
        cycleP50: Math.round((2 + rnd() * 4) * 10) / 10, cycleP85: Math.round((6 + rnd() * 6) * 10) / 10,
        porPlanejamento: { Planejado: pts - extra, Extra: Math.round(extra * 0.7), "Bônus": extra - Math.round(extra * 0.7) },
        porTipo: { entrega: Math.round(pts * 0.55), tecnologia: Math.round(pts * 0.2), bug: Math.round(pts * 0.15), operacional: pts - Math.round(pts * 0.55) - Math.round(pts * 0.2) - Math.round(pts * 0.15) },
        porRoadmap: { "Grandes entregas": Math.round(pts * 0.45), "Pequenas entregas": Math.round(pts * 0.25), "Suporte/rotina": Math.round(pts * 0.2), "Evolução técnica": pts - Math.round(pts * 0.45) - Math.round(pts * 0.25) - Math.round(pts * 0.2) },
        chamados, chamadosN3: Math.round(chamados * (0.2 + rnd() * 0.5)), trabalhoN3: perfil.projeto === "IC" ? Math.round(rnd() * 6) : 0,
        resolucaoP50: Math.round((1 + rnd() * 5) * 10) / 10,
        produtividade: perfil.teamRetroId ? 0.76 + rnd() * 0.22 : null,
        motivacao: perfil.teamRetroId ? 0.78 + rnd() * 0.2 : null,
      };
    });
    return { perfil, frente, periodos };
  }));
  return { deck, rotulo, times, leituras: {}, demo: true };
}
