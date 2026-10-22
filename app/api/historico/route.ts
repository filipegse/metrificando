// Grava o histórico importado (upsert por time + frente + nome) e lembra o mapeamento de colunas usado.
import { db } from "@/lib/db";
import type { LinhaHistorico } from "@/lib/importacao";
import { sqlAuditar, usuarioDe, type Linha } from "@/lib/historico";
import { VERSAO_MAPA } from "@/lib/importacao";

// Dados mudam a cada gravação: nunca servir resposta em cache (navegador, CDN ou Next).
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COLUNAS = ["entrega", "extras", "pts_sdd", "esforco_sdd", "pts_sem_sdd", "esforco_sem_sdd", "ganho_sdd",
  "itens_entregues", "cycle_p50", "cycle_p85", "produtividade", "motivacao"] as const;

export async function GET(req: Request) {
  const fonte = new URL(req.url).searchParams.get("fonte") ?? "";
  const r = (await db()`select mapa, linha_titulo from import_mapeamentos where fonte = ${fonte}`) as { mapa: unknown; linha_titulo: number }[];
  return Response.json(r[0] ?? null);
}

export async function POST(req: Request) {
  const { fonte, linhaTitulo, mapa, cabecalho, linhas, usuario } = (await req.json()) as {
    fonte: string; linhaTitulo: number; mapa: Record<string, number>; cabecalho: string[]; linhas: LinhaHistorico[]; usuario?: string;
  };
  if (!["dados_sprints", "kanban", "outra"].includes(fonte) || !Array.isArray(linhas)) {
    return Response.json({ erro: "fonte ou linhas inválidas" }, { status: 400 });
  }
  const sql = db();
  // Estado anterior das linhas do lote, para a auditoria (e para poder desfazer a importação).
  const existentes = (await sql`select time, frente, nome, tipo, inicio::text as inicio, fim::text as fim, fonte, entrega::float, extras::float,
      pts_sdd::float, esforco_sdd::float, pts_sem_sdd::float, esforco_sem_sdd::float, ganho_sdd::float, itens_entregues::float,
      cycle_p50::float, cycle_p85::float, produtividade::float, motivacao::float
    from historico_periodos where (time || '|' || frente || '|' || nome) = any(${linhas.map((l) => `${l.time}|${l.frente ?? ""}|${l.nome}`)})`) as Linha[];
  const antesDe = (l: LinhaHistorico) => existentes.find((e) => e.time === l.time && e.frente === (l.frente ?? "") && e.nome === l.nome) ?? null;
  const quem = usuarioDe(req, usuario);
  const comandos = linhas.map((l) => sql`
    insert into historico_periodos (time, frente, nome, tipo, inicio, fim, fonte, ${sql.unsafe(COLUNAS.join(", "))})
    values (${l.time}, ${l.frente ?? ""}, ${l.nome}, ${l.tipo}, ${l.inicio}, ${l.fim}, ${fonte},
      ${l.entrega ?? null}, ${l.extras ?? null}, ${l.pts_sdd ?? null}, ${l.esforco_sdd ?? null}, ${l.pts_sem_sdd ?? null},
      ${l.esforco_sem_sdd ?? null}, ${l.ganho_sdd ?? null}, ${l.itens_entregues ?? null}, ${l.cycle_p50 ?? null},
      ${l.cycle_p85 ?? null}, ${l.produtividade ?? null}, ${l.motivacao ?? null})
    on conflict (time, frente, nome) do update set tipo = excluded.tipo, inicio = excluded.inicio, fim = excluded.fim,
      fonte = excluded.fonte, ${sql.unsafe(COLUNAS.map((c) => `${c} = excluded.${c}`).join(", "))}, importado_em = now()`);
  for (const l of linhas) comandos.push(sqlAuditar(quem, "importacao", { time: l.time, frente: l.frente ?? "", nome: l.nome }, antesDe(l), { ...l, frente: l.frente ?? "", fonte } as Linha));
  // Guarda o mapeamento pelo título (não pela posição), para sugerir na próxima importação.
  // `_v`: versão das regras de reconhecimento; mapeamentos salvos com regras antigas são descartados.
  const porTitulo = { _v: VERSAO_MAPA, ...Object.fromEntries(Object.entries(mapa).map(([campo, i]) => [campo, cabecalho[i]])) };
  comandos.push(sql`
    insert into import_mapeamentos (fonte, mapa, linha_titulo) values (${fonte}, ${JSON.stringify(porTitulo)}, ${linhaTitulo})
    on conflict (fonte) do update set mapa = excluded.mapa, linha_titulo = excluded.linha_titulo, atualizado_em = now()`);
  await sql.transaction(comandos);
  return Response.json({ gravadas: linhas.length });
}
