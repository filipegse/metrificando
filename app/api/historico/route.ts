// Grava o histórico importado (upsert por time + frente + nome) e lembra o mapeamento de colunas usado.
import { db } from "@/lib/db";
import type { LinhaHistorico } from "@/lib/importacao";
import { COLUNAS_METRICAS, SELECT_COLUNAS, sqlAuditar, sqlGravar, usuarioDe, type Linha } from "@/lib/historico";
import { VERSAO_MAPA } from "@/lib/importacao";

// Dados mudam a cada gravação: nunca servir resposta em cache (navegador, CDN ou Next).
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const chaves = linhas.map((l) => `${l.time}|${l.frente ?? ""}|${l.nome}`);
  const existentes = (await sql.query(`select ${SELECT_COLUNAS} from historico_periodos where (time || '|' || frente || '|' || nome) = any($1)`, [chaves])) as Linha[];
  const antesDe = (l: LinhaHistorico) => existentes.find((e) => e.time === l.time && e.frente === (l.frente ?? "") && e.nome === l.nome) ?? null;
  const quem = usuarioDe(req, usuario);
  // Reimportação atualiza só o que foi mapeado neste arquivo: importar a composição não apaga os indicadores, e vice-versa.
  const mapeados = new Set(Object.keys(mapa));
  const derivados: Record<string, string[]> = {
    produtividade: ["produtividade", "prod_coletiva", "prod_individual"], motivacao: ["motivacao", "mot_coletiva", "mot_individual"],
    itens_entregues: ["itens_entregues", "itens_total"],
  };
  const atualizar = ["tipo", "inicio", "fim", "fonte",
    ...COLUNAS_METRICAS.filter((c) => (derivados[c] ?? [c]).some((x) => mapeados.has(x)))];
  const depoisDe = (l: LinhaHistorico): Linha => {
    const antes = antesDe(l);
    const novo: Linha = { ...(antes ?? {}), ...l, frente: l.frente ?? "", fonte } as Linha;
    // Colunas não mapeadas mantêm o valor que já existia.
    if (antes) for (const c of COLUNAS_METRICAS) if (!atualizar.includes(c)) novo[c] = antes[c];
    return novo;
  };
  const comandos = linhas.map((l) => sqlGravar(depoisDe(l), atualizar));
  for (const l of linhas) comandos.push(sqlAuditar(quem, "importacao", { time: l.time, frente: l.frente ?? "", nome: l.nome }, antesDe(l), depoisDe(l)));
  // Guarda o mapeamento pelo título (não pela posição), para sugerir na próxima importação.
  // `_v`: versão das regras de reconhecimento; mapeamentos salvos com regras antigas são descartados.
  const porTitulo = { _v: VERSAO_MAPA, ...Object.fromEntries(Object.entries(mapa).map(([campo, i]) => [campo, cabecalho[i]])) };
  comandos.push(sql`
    insert into import_mapeamentos (fonte, mapa, linha_titulo) values (${fonte}, ${JSON.stringify(porTitulo)}, ${linhaTitulo})
    on conflict (fonte) do update set mapa = excluded.mapa, linha_titulo = excluded.linha_titulo, atualizado_em = now()`);
  await sql.transaction(comandos);
  return Response.json({ gravadas: linhas.length });
}
