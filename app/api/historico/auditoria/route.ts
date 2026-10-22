// Histórico de alterações e reversão (rollback) de uma alteração.
import { db } from "@/lib/db";
import { diferencas, linhaAtual, sqlAuditar, sqlGravar, usuarioDe, type Linha } from "@/lib/historico";

// Dados mudam a cada gravação: nunca servir resposta em cache (navegador, CDN ou Next).
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Registro = { id: number; quando: string; usuario: string; acao: string; time: string; frente: string; nome: string;
  antes: Linha | null; depois: Linha | null; revertida_em: string | null; revertida_por: string | null; reverte_id: number | null };

export async function GET(req: Request) {
  const time = new URL(req.url).searchParams.get("time") ?? "";
  const r = (await db()`select id, quando::text, usuario, acao, time, frente, nome, antes, depois, revertida_em::text, revertida_por, reverte_id
    from historico_auditoria where time = ${time} order by quando desc, id desc limit 300`) as Registro[];
  return Response.json(r.map((x) => ({ ...x, mudancas: diferencas(x.antes, x.depois), antes: undefined, depois: undefined })));
}

/**
 * Desfaz uma alteração: a linha volta ao estado `antes` daquele registro (ou é apagada, se não existia).
 * Recusa se a linha mudou de novo depois, para não sobrescrever uma correção mais recente sem querer.
 */
export async function POST(req: Request) {
  const { id, usuario, forcar } = await req.json();
  const sql = db();
  const [reg] = (await sql`select * from historico_auditoria where id = ${id}`) as Registro[];
  if (!reg) return Response.json({ erro: "registro não encontrado" }, { status: 404 });
  if (reg.revertida_em) return Response.json({ erro: "essa alteração já foi desfeita" }, { status: 409 });
  const chaveDepois = reg.depois ? { time: reg.depois.time, frente: reg.depois.frente, nome: reg.depois.nome as string } : reg;
  const atual = await linhaAtual(chaveDepois);
  if (!forcar && Object.keys(diferencas(atual, reg.depois)).length) {
    return Response.json({ erro: "a linha foi alterada depois desse registro; desfaça as alterações mais recentes primeiro", conflito: true }, { status: 409 });
  }
  const quem = usuarioDe(req, usuario);
  const comandos = [];
  if (atual) comandos.push(sql`delete from historico_periodos where time = ${atual.time} and frente = ${atual.frente} and nome = ${atual.nome}`);
  if (reg.antes) comandos.push(sqlGravar(reg.antes));
  comandos.push(sqlAuditar(quem, "reversao", reg.antes ?? chaveDepois, atual, reg.antes, reg.id));
  comandos.push(sql`update historico_auditoria set revertida_em = now(), revertida_por = ${quem} where id = ${reg.id}`);
  await sql.transaction(comandos);
  return Response.json({ ok: true });
}
