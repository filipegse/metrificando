import { PERFIS, type Perfil } from "../config/perfis";
import { db } from "./db";
import { COLUNAS_METRICAS } from "./historico";

const COLUNAS_HIST_DECK = `nome, frente, tipo, inicio::text as inicio, fim::text as fim, ${COLUNAS_METRICAS.map((c) => `${c}::float as ${c}`).join(", ")}`;
import { carregarCalendario } from "./coleta";
import { agrupar, AGRUPAMENTOS, type Agrupamento } from "./agrupamento";
import { capacidade, type AlocacaoCap, type AusenciaCap } from "./capacidade";
import { indicadores, indicadoresDoHistorico, type LinhaHistoricoDeck, type Indicadores, type LinhaDelivery, type LinhaSaude, type LinhaSuporte, type Periodo } from "./indicadores";

/** `frente` preenchida quando o time é apresentado por frente (cada uma com sprints próprias). */
/** `fase` preenchida quando o recorte mistura a fase Scrum e a fase Kanban do mesmo time. */
export type DadosTime = { perfil: Perfil; frente?: string; fase?: "scrum" | "kanban"; agrupamento?: Agrupamento; periodos: Indicadores[] };

export const nomeDoTime = (t: DadosTime) =>
  [t.perfil.time, t.frente && t.frente !== t.perfil.time ? t.frente : null, t.fase ? (t.fase === "scrum" ? "Scrum" : "Kanban") : null]
    .filter(Boolean).join(" · ");

/** Metodologia que vale para os slides deste bloco. */
export const metodologiaDe = (t: DadosTime) => t.fase ?? t.perfil.metodologia;

const numeroSprint = (nome?: string | null) => nome?.match(/\d{2,}/)?.[0];

/** Histórico só entra onde a coleta do Jira não tem o mesmo período (sprint de mesmo número/frente ou semana com mesmo fim). */
export function semDuplicar(coletados: Indicadores[], historico: Indicadores[]): Indicadores[] {
  const dia = 86400000;
  return historico.filter((h) => !coletados.some((c) =>
    (c.periodo.frente ?? "") === (h.periodo.frente ?? "") && c.periodo.tipo === h.periodo.tipo &&
    (h.periodo.tipo === "sprint"
      ? numeroSprint(c.periodo.nome) === numeroSprint(h.periodo.nome)
      : Math.abs(Date.parse(c.periodo.fim) - Date.parse(h.periodo.fim)) < 3 * dia)));
}
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

/** Recorte escolhido na página inicial: sprints específicas (Scrum) ou intervalo de datas (Kanban). */
/** `porFrente`: Nexus/Eficientes apresentados por frente em vez do time inteiro. */
export type Recorte = { sprints?: string[]; de?: string; ate?: string; porFrente?: boolean; agrupamento?: Agrupamento };

/** Lê `s_DSR=123,124`, `de_EFC=2026-09-01&ate_EFC=2026-10-15` e `f_NXS=frentes` da URL. */
export function recortesDaUrl(q: Record<string, string | undefined>): Record<string, Recorte> {
  const r: Record<string, Recorte> = {};
  for (const [k, v] of Object.entries(q)) {
    const m = /^(s|de|ate|f|g)_([A-Z0-9]+)$/.exec(k);
    if (!m || !v) continue;
    const alvo = (r[m[2]] ??= {});
    if (m[1] === "f") alvo.porFrente = v === "frentes";
    else if (m[1] === "g" && (AGRUPAMENTOS as readonly string[]).includes(v)) alvo.agrupamento = v as Agrupamento;
    else if (m[1] === "s") alvo.sprints = v.split(",").filter(Boolean);
    else alvo[m[1] as "de" | "ate"] = v;
  }
  return r;
}

/** Fim do dia `ate` (inclusivo), no horário da Bahia. */
const fimDoDia = (dia: string) => new Date(new Date(`${dia}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000).toISOString();
const inicioDoDia = (dia: string) => new Date(`${dia}T00:00:00-03:00`).toISOString();

export async function carregarDeck(deck: string, projetos: string[], recortes: Record<string, Recorte> = {}): Promise<DadosDeck> {
  const trimestre = intervaloTrimestre(deck);
  const personalizado = Object.keys(recortes).length > 0;
  const rotulo = personalizado ? "Período selecionado" : trimestre.rotulo;
  const perfis = PERFIS.filter((p) => projetos.includes(p.projeto));
  const sql = db();
  const times: DadosTime[] = [];
  // Calendário e alocações valem para todos os times do deck.
  const cal = await carregarCalendario();
  const aloc = (await sql`select pessoa_id, time, frente, cargo, percentual::float, inicio::text, fim::text from alocacoes`) as AlocacaoCap[];
  const aus = (await sql`select pessoa_id, inicio::text, fim::text from ausencias`) as AusenciaCap[];
  for (const perfil of perfis) {
    // Sem recorte, o período entra no trimestre pela data de fim (sprint fechada / janela fechada).
    const r = recortes[perfil.projeto] ?? {};
    const de = r.de ? inicioDoDia(r.de) : trimestre.de;
    const ate = r.ate ? fimDoDia(r.ate) : trimestre.ate;
    const periodos = (r.sprints
      ? await sql`select periodo_id, nome, tipo, frente, inicio::text, fim::text from periodos
          where time = ${perfil.time} and periodo_id = any(${r.sprints}) order by fim`
      : await sql`select periodo_id, nome, tipo, frente, inicio::text, fim::text from periodos
          where time = ${perfil.time} and fim >= ${de} and fim < ${ate} order by fim`) as Periodo[];
    const ids = periodos.map((p) => p.periodo_id);
    const delivery = (await sql`
      select periodo_id, frente, tipo_canonico, sp_sdd::float, sp_sem_sdd::float, planejamento, categoria_roadmap, entregue, cycle_time_dias::float
      from itens_delivery where time = ${perfil.time} and periodo_id = any(${ids})`) as (LinhaDelivery & { frente: string | null })[];
    const suporte = (await sql`
      select periodo_id, frente, nivel, papel, tempo_resolucao_dias::float
      from itens_suporte where time = ${perfil.time} and periodo_id = any(${ids})`) as (LinhaSuporte & { frente: string | null })[];
    const saude = (await sql`
      select periodo_id, frente, produtividade::float, motivacao::float, respostas
      from saude_time where time = ${perfil.time} and periodo_id = any(${ids})`) as LinhaSaude[];
    const linhasHist = (r.sprints
      ? await sql`select ${sql.unsafe(COLUNAS_HIST_DECK)}
          from historico_periodos where time = ${perfil.time} and ('h:' || nome) = any(${r.sprints})`
      : await sql`select ${sql.unsafe(COLUNAS_HIST_DECK)}
          from historico_periodos where time = ${perfil.time} and fim >= ${de.slice(0, 10)}::date and fim < ${ate.slice(0, 10)}::date`) as LinhaHistoricoDeck[];

    // Blocos do deck: frentes com sprints próprias (TRG), frentes escolhidas (Nexus/Eficientes) ou o time inteiro.
    const sprintsProprias = !!perfil.sprintsPorFrente;
    const blocos: (string | undefined)[] = sprintsProprias ? perfil.sprintsPorFrente!.map((f) => f.frente)
      : r.porFrente && perfil.frentes?.length ? perfil.frentes : [undefined];
    for (const frente of blocos) {
      const daFrente = (x: { frente?: string | null }) => !frente || sprintsProprias || (x.frente ?? "").split(", ").includes(frente);
      const doBloco = periodos.filter((p) => !sprintsProprias || !frente || p.frente === frente);
      const coletados = doBloco.map((p) => {
        const i = indicadores(p, delivery.filter(daFrente), suporte.filter(daFrente), saude);
        const fim = p.fim.slice(0, 10), inicio = (p.inicio ?? p.fim).slice(0, 10);
        return { ...i, capacidade: capacidade(aloc, aus, cal, { time: perfil.time, frente }, inicio, fim) };
      });
      // Histórico: linha da frente quando o bloco é de frente; linha do time inteiro quando o bloco é o time.
      const hist = linhasHist.filter((h) => (frente ? h.frente === frente : !h.frente)).map((h) => {
        const i = indicadoresDoHistorico(h);
        return { ...i, capacidade: capacidade(aloc, aus, cal, { time: perfil.time, frente }, (h.inicio ?? h.fim).slice(0, 10), h.fim.slice(0, 10)) };
      });
      const todos = [...coletados, ...semDuplicar(coletados, hist)].sort((a, b) => Date.parse(a.periodo.fim) - Date.parse(b.periodo.fim));
      const g = r.agrupamento && r.agrupamento !== "periodo" ? r.agrupamento : undefined;
      const sprints = agrupar(todos.filter((i) => i.periodo.tipo === "sprint"), g === "quinzena" ? undefined : g);
      const semanas = agrupar(todos.filter((i) => i.periodo.tipo === "semana"), g, perfil.ancoraQuinzena);
      const fases = { scrum: g === "quinzena" ? undefined : g, kanban: g };
      // Recorte que atravessa a migração Scrum → Kanban: um bloco por fase, sem misturar sprint com semana.
      if (sprints.length && semanas.length) {
        times.push({ perfil, frente, fase: "scrum", agrupamento: fases.scrum, periodos: sprints });
        times.push({ perfil, frente, fase: "kanban", agrupamento: fases.kanban, periodos: semanas });
      } else times.push({ perfil, frente, agrupamento: sprints.length ? fases.scrum : fases.kanban, periodos: sprints.length ? sprints : semanas });
    }
  }
  const leituras: Record<string, string> = {};
  for (const l of (await sql`select time, slide, texto from leituras where deck = ${deck}`) as { time: string; slide: string; texto: string }[]) {
    leituras[chaveLeitura(l.time, l.slide)] = l.texto;
  }
  return { deck, rotulo, times, leituras, demo: false };
}

/** Dados fictícios para visualizar o deck antes de existir coleta. */
export function deckDemo(deck: string, projetos: string[], recortes: Record<string, Recorte> = {}, misto = false): DadosDeck {
  const { rotulo } = intervaloTrimestre(deck);
  let semente = 7;
  const rnd = () => ((semente = (semente * 9301 + 49297) % 233280) / 233280);
  const times = PERFIS.filter((p) => projetos.includes(p.projeto)).flatMap((perfil) =>
    (perfil.sprintsPorFrente?.map((f) => f.frente) ?? (recortes[perfil.projeto]?.porFrente && perfil.frentes ? perfil.frentes : [undefined])).map((frente) => {
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
        capacidade: Math.round((frente ? 18 : 36) + rnd() * 8),
      };
    });
    // demo=misto: times Kanban ganham uma fase Scrum antes, para visualizar a transição.
    if (misto && !scrum) {
      const sprints = periodos.slice(0, 4).map((p, k) => ({ ...p, entrega: 0.8 + rnd() * 0.3, extras: 0.1 + rnd() * 0.15, itensEntregues: p.itensEntregues * 2,
        chamados: (p.chamados ?? 0) * 2, cycleP50: (p.cycleP50 ?? 0) + 2,
        periodo: { ...p.periodo, periodo_id: `s${k}`, tipo: "sprint", nome: `${perfil.projeto} ${40 + k}`,
          inicio: new Date(Date.UTC(2026, 6, 1 + k * 14)).toISOString(), fim: new Date(Date.UTC(2026, 6, 14 + k * 14)).toISOString() } }));
      return [{ perfil, frente, fase: "scrum" as const, periodos: sprints }, { perfil, frente, fase: "kanban" as const, periodos }];
    }
    const g = recortes[perfil.projeto]?.agrupamento;
    const ga = g && g !== "periodo" && !(scrum && g === "quinzena") ? g : undefined;
    if (ga && !misto) return [{ perfil, frente, agrupamento: ga, periodos: agrupar(periodos, ga, perfil.ancoraQuinzena) }];
    return [{ perfil, frente, periodos }];
  }).flat());
  return { deck, rotulo, times, leituras: {}, demo: true };
}

export { agregarQuinzenas } from "./agrupamento";
