// Coleta do app Netlify (legado durante a migração). As regras vêm do núcleo compartilhado com a Edge Function.
import { db } from "./db";
import { buscar } from "./jira";
import { montarGravacao, planejar, type AlocacaoTL, type Evento } from "../../supabase/functions/_shared/lib/coletaCore.ts";
import type { IssueJira } from "../../supabase/functions/_shared/lib/jira.ts";
import type { Calendario } from "./calendario";

export type { Evento };

/** Expedientes e feriados cadastrados na aplicação. */
export async function carregarCalendario(): Promise<Calendario> {
  const sql = db();
  const exp = (await sql`select valido_de::text as "validoDe", to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim from expedientes`) as Calendario["expedientes"];
  const fer = (await sql`select data::text as data from feriados`) as { data: string }[];
  return { expedientes: exp, feriados: new Set(fer.map((f) => f.data)) };
}

export async function coletar(e: Evento): Promise<{ time: string; periodoId: string; delivery: number; suporte: number }> {
  const { perfil, periodo, consultas } = planejar(e);
  const cal = await carregarCalendario();
  const cruas: Record<string, IssueJira[]> = {};
  for (const c of consultas) cruas[c.id] = await buscar(c.jql, c.fields);
  const tls = (await db()`select p.nome, a.inicio::text as inicio, a.fim::text as fim from alocacoes a
    join pessoas p on p.id = a.pessoa_id where a.time = ${perfil.time} and a.cargo = 'TL'`) as AlocacaoTL[];
  const g = montarGravacao(perfil, periodo, cruas, cal, tls);
  await gravar(g);
  return { time: perfil.time, periodoId: periodo.periodoId, delivery: g.delivery.length, suporte: g.suporte.length };
}

/** Idempotente: o período é regravado por inteiro (chave time + periodo_id). Mesma lógica de gravar_periodo() no Supabase. */
async function gravar(g: ReturnType<typeof montarGravacao>) {
  const sql = db();
  const p = g.periodo;
  await sql.transaction([
    sql`delete from periodos where time = ${p.time} and periodo_id = ${p.periodo_id}`,
    sql`insert into periodos (time, periodo_id, tipo, nome, frente, inicio, fim, metodologia)
        values (${p.time}, ${p.periodo_id}, ${p.tipo}, ${p.nome}, ${p.frente}, ${p.inicio}, ${p.fim}, ${p.metodologia})`,
    sql`insert into itens_delivery select * from jsonb_populate_recordset(null::itens_delivery, ${JSON.stringify(g.delivery)}::jsonb)`,
    sql`insert into itens_suporte select * from jsonb_populate_recordset(null::itens_suporte, ${JSON.stringify(g.suporte)}::jsonb)
        on conflict (time, periodo_id, chave) do nothing`,
  ]);
}

export async function registrarColeta(evento: string, time: string, periodoId: string, status: "ok" | "erro", detalhe?: string) {
  await db()`insert into coletas (evento, time, periodo_id, status, detalhe) values (${evento}, ${time}, ${periodoId}, ${status}, ${detalhe ?? null})`;
}
