// Edge Function `coleta`: o n8n orquestra e busca no Jira; aqui ficam as regras.
//
//   POST { acao: "planejar", evento }   → abre um lote e devolve { lote_id, time, periodo_id, consultas[] }
//   n8n executa cada consulta no Jira (search/jql, expand=changelog, paginado) e grava em jira_issues_cruas
//   POST { acao: "normalizar", lote_id } → normaliza o lote, grava o período (gravar_periodo) e registra em coletas
//
// Autenticação: header x-coleta-token = segredo COLETA_TOKEN (o mesmo cadastrado como credencial no n8n).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { perfilPorProjeto } from "../_shared/config/perfis.ts";
import type { Calendario } from "../_shared/lib/calendario.ts";
import { montarGravacao, periodoDoEvento, planejar, type AlocacaoTL, type Evento } from "../_shared/lib/coletaCore.ts";
import type { IssueJira } from "../_shared/lib/jira.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

async function falhou<T>(r: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await r;
  if (error) throw new Error(error.message);
  return data;
}

async function carregarCalendario(): Promise<Calendario> {
  const exp = await falhou(supabase.from("expedientes").select("valido_de, inicio, fim"));
  const fer = await falhou(supabase.from("feriados").select("data"));
  return {
    // time do Postgres chega como "09:00:00"; o calendário usa "HH:MM".
    expedientes: (exp ?? []).map((e: any) => ({ validoDe: e.valido_de, inicio: e.inicio.slice(0, 5), fim: e.fim.slice(0, 5) })),
    feriados: new Set((fer ?? []).map((f: any) => f.data)),
  };
}

async function techLeads(time: string): Promise<AlocacaoTL[]> {
  const linhas = await falhou(supabase.from("alocacoes").select("inicio, fim, pessoas(nome)").eq("time", time).eq("cargo", "TL"));
  return (linhas ?? []).map((l: any) => ({ nome: l.pessoas?.nome ?? "", inicio: l.inicio, fim: l.fim }));
}

/** Issues cruas do lote agrupadas por consulta (paginado: o PostgREST devolve no máximo 1000 por chamada). */
async function cruasDoLote(loteId: string): Promise<Record<string, IssueJira[]>> {
  const porConsulta: Record<string, IssueJira[]> = {};
  for (let de = 0; ; de += 1000) {
    const pag = await falhou(supabase.from("jira_issues_cruas").select("consulta, payload").eq("lote_id", loteId)
      .order("consulta").order("chave").range(de, de + 999));
    for (const l of (pag ?? []) as { consulta: string; payload: IssueJira }[]) (porConsulta[l.consulta] ??= []).push(l.payload);
    if (!pag || pag.length < 1000) return porConsulta;
  }
}

async function registrarColeta(evento: string, time: string, periodoId: string, status: "ok" | "erro", detalhe?: string) {
  await falhou(supabase.from("coletas").insert({ evento, time, periodo_id: periodoId, status, detalhe: detalhe ?? null }));
}

async function acaoPlanejar(evento: Evento) {
  const { perfil, periodo, consultas } = planejar(evento);
  const lote = await falhou(supabase.from("coleta_lotes")
    .insert({ evento, time: perfil.time, periodo_id: periodo.periodoId, consultas })
    .select("id").single());
  return { lote_id: (lote as { id: string }).id, time: perfil.time, periodo_id: periodo.periodoId, consultas };
}

async function acaoNormalizar(loteId: string) {
  const lote = await falhou(supabase.from("coleta_lotes").select("*").eq("id", loteId).single()) as
    { id: string; evento: Evento; time: string; periodo_id: string; status: string };
  if (lote.status === "normalizado") return { lote_id: loteId, ja_normalizado: true };
  try {
    const perfil = perfilPorProjeto(lote.evento.projeto);
    if (!perfil) throw new Error(`Projeto sem perfil: ${lote.evento.projeto}`);
    // O período é recalculado do evento guardado no lote, então reprocessar dá o mesmo resultado.
    const periodo = periodoDoEvento(lote.evento, perfil);
    const g = montarGravacao(perfil, periodo, await cruasDoLote(loteId), await carregarCalendario(), await techLeads(perfil.time));
    await falhou(supabase.rpc("gravar_periodo", { g }));
    const detalhe = `delivery=${g.delivery.length} suporte=${g.suporte.length} lote=${loteId}`;
    await registrarColeta(lote.evento.evento, lote.time, lote.periodo_id, "ok", detalhe);
    await falhou(supabase.from("coleta_lotes").update({ status: "normalizado", detalhe, fechado_em: new Date().toISOString() }).eq("id", loteId));
    return { lote_id: loteId, time: lote.time, periodo_id: lote.periodo_id, delivery: g.delivery.length, suporte: g.suporte.length };
  } catch (erro) {
    await registrarColeta(lote.evento.evento, lote.time, lote.periodo_id, "erro", String(erro));
    await supabase.from("coleta_lotes").update({ status: "erro", detalhe: String(erro), fechado_em: new Date().toISOString() }).eq("id", loteId);
    throw erro;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);
  const token = Deno.env.get("COLETA_TOKEN");
  if (!token || req.headers.get("x-coleta-token") !== token) return json({ erro: "Não autorizado" }, 401);
  const corpo = await req.json().catch(() => null);
  try {
    if (corpo?.acao === "planejar" && corpo.evento?.evento && corpo.evento?.projeto) return json(await acaoPlanejar(corpo.evento));
    if (corpo?.acao === "normalizar" && typeof corpo.lote_id === "string") return json(await acaoNormalizar(corpo.lote_id));
    return json({ erro: "Payload inválido: use {acao:'planejar', evento} ou {acao:'normalizar', lote_id}" }, 400);
  } catch (erro) {
    return json({ erro: String(erro) }, 422);
  }
});
