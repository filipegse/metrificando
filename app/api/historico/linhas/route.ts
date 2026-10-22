// Edição manual do histórico por time. Toda alteração é auditada (antes/depois + usuário).
import { db } from "@/lib/db";
import { CAMPOS_EDITAVEIS, linhaAtual, linhasDoTime, sqlAuditar, sqlGravar, usuarioDe, type Chave, type Linha } from "@/lib/historico";

// Dados mudam a cada gravação: nunca servir resposta em cache (navegador, CDN ou Next).
export const dynamic = "force-dynamic";
export const revalidate = 0;

const erro = (msg: string, status = 400) => Response.json({ erro: msg }, { status });
const chaveValida = (c: (Partial<Chave> & Record<string, unknown>) | undefined): c is Chave & Record<string, unknown> => !!c?.time && typeof c.frente === "string" && !!c.nome;

export async function GET(req: Request) {
  const time = new URL(req.url).searchParams.get("time");
  if (!time) return erro("informe o time");
  return Response.json(await linhasDoTime(time));
}

/** Edita campos de uma linha. Mudar o nome da sprint muda a chave: grava a nova e apaga a antiga. */
export async function PATCH(req: Request) {
  const { chave, alteracoes, usuario } = await req.json();
  if (!chaveValida(chave) || typeof alteracoes !== "object") return erro("chave ou alterações inválidas");
  const antes = await linhaAtual(chave);
  if (!antes) return erro("linha não encontrada (recarregue a página)", 404);
  const depois: Linha = { ...antes };
  for (const [c, v] of Object.entries(alteracoes)) if ((CAMPOS_EDITAVEIS as readonly string[]).includes(c)) depois[c] = v === "" ? null : v;
  if (!depois.nome || !depois.fim) return erro("nome e fim são obrigatórios");
  const quem = usuarioDe(req, usuario);
  const sql = db();
  const comandos = [sqlGravar(depois), sqlAuditar(quem, "edicao", { time: depois.time, frente: depois.frente, nome: depois.nome as string }, antes, depois)];
  if (depois.nome !== antes.nome) comandos.splice(1, 0, sql`delete from historico_periodos where time = ${antes.time} and frente = ${antes.frente} and nome = ${antes.nome}`);
  await sql.transaction(comandos);
  return Response.json({ ok: true });
}

/** Nova linha manual. */
export async function POST(req: Request) {
  const { linha, usuario } = await req.json();
  if (!chaveValida(linha) || !linha.fim || !linha.tipo) return erro("time, nome, tipo e fim são obrigatórios");
  if (await linhaAtual(linha)) return erro("já existe um período com esse nome para o time/frente");
  const nova: Linha = { ...linha, fonte: "manual" };
  await db().transaction([sqlGravar(nova), sqlAuditar(usuarioDe(req, usuario), "edicao", linha, null, nova)]);
  return Response.json({ ok: true });
}

/** Apaga uma linha, ou todas do time/frente (`todas: true`) para reimportar do zero. */
export async function DELETE(req: Request) {
  const { chave, todas, usuario } = await req.json();
  const quem = usuarioDe(req, usuario);
  const sql = db();
  const alvo: Linha[] = todas
    ? (await linhasDoTime(chave?.time)).filter((l) => chave?.frente === undefined || l.frente === chave.frente)
    : chaveValida(chave) ? [await linhaAtual(chave)].filter(Boolean) as Linha[] : [];
  if (!alvo.length) return erro("nada para apagar", 404);
  await sql.transaction(alvo.flatMap((l) => [
    sql`delete from historico_periodos where time = ${l.time} and frente = ${l.frente} and nome = ${l.nome}`,
    sqlAuditar(quem, "exclusao", l, l, null),
  ]));
  return Response.json({ apagadas: alvo.length });
}
