// Leitura, edição e auditoria das linhas de historico_periodos.
import { db } from "./db";

export const CAMPOS_EDITAVEIS = ["nome", "tipo", "inicio", "fim", "entrega", "extras", "pts_sdd", "esforco_sdd", "pts_sem_sdd",
  "esforco_sem_sdd", "ganho_sdd", "itens_entregues", "cycle_p50", "cycle_p85", "produtividade", "motivacao"] as const;
export type CampoEditavel = (typeof CAMPOS_EDITAVEIS)[number];
export type Chave = { time: string; frente: string; nome: string };
export type Linha = Chave & Record<string, unknown>;

const SELECT_COLUNAS = `time, frente, nome, tipo, inicio::text as inicio, fim::text as fim, fonte, entrega::float, extras::float,
  pts_sdd::float, esforco_sdd::float, pts_sem_sdd::float, esforco_sem_sdd::float, ganho_sdd::float, itens_entregues::float,
  cycle_p50::float, cycle_p85::float, produtividade::float, motivacao::float, importado_em::text as importado_em`;

/**
 * Quem fez a alteração. Com a proteção por senha da aplicação, vale o usuário do login (HTTP Basic);
 * o nome informado na tela complementa (a senha é compartilhada). Sem login, só o nome informado.
 */
export function usuarioDe(req: Request, informado?: string): string {
  const [tipo, valor] = (req.headers.get("authorization") ?? "").split(" ");
  const login = tipo === "Basic" && valor ? atob(valor).split(":")[0] : "";
  const nome = (informado ?? "").trim().slice(0, 80);
  return [nome, login && `login: ${login}`].filter(Boolean).join(" · ") || "não identificado";
}

export async function linhaAtual(chave: Chave): Promise<Linha | null> {
  const r = (await db().query(`select ${SELECT_COLUNAS} from historico_periodos where time = $1 and frente = $2 and nome = $3`,
    [chave.time, chave.frente, chave.nome])) as Linha[];
  return r[0] ?? null;
}

export async function linhasDoTime(time: string): Promise<Linha[]> {
  return (await db().query(`select ${SELECT_COLUNAS} from historico_periodos where time = $1 order by frente, fim`, [time])) as Linha[];
}

/** Só os campos que mudaram, no formato { campo: [antes, depois] }. */
export function diferencas(antes: Linha | null, depois: Linha | null): Record<string, [unknown, unknown]> {
  const d: Record<string, [unknown, unknown]> = {};
  for (const c of CAMPOS_EDITAVEIS) {
    const a = antes?.[c] ?? null, b = depois?.[c] ?? null;
    if (String(a) !== String(b)) d[c] = [a, b];
  }
  return d;
}

/** Grava a linha inteira (cria ou substitui) a partir de um registro com todos os campos. */
export function sqlGravar(l: Linha) {
  const sql = db();
  const v = (c: string) => (l[c] ?? null) as never;
  return sql`
    insert into historico_periodos (time, frente, nome, tipo, inicio, fim, fonte, entrega, extras, pts_sdd, esforco_sdd, pts_sem_sdd,
      esforco_sem_sdd, ganho_sdd, itens_entregues, cycle_p50, cycle_p85, produtividade, motivacao)
    values (${l.time}, ${l.frente}, ${l.nome}, ${v("tipo")}, ${v("inicio")}, ${v("fim")}, ${(l.fonte as string) ?? "outra"}, ${v("entrega")},
      ${v("extras")}, ${v("pts_sdd")}, ${v("esforco_sdd")}, ${v("pts_sem_sdd")}, ${v("esforco_sem_sdd")}, ${v("ganho_sdd")},
      ${v("itens_entregues")}, ${v("cycle_p50")}, ${v("cycle_p85")}, ${v("produtividade")}, ${v("motivacao")})
    on conflict (time, frente, nome) do update set tipo = excluded.tipo, inicio = excluded.inicio, fim = excluded.fim,
      fonte = excluded.fonte, entrega = excluded.entrega, extras = excluded.extras, pts_sdd = excluded.pts_sdd,
      esforco_sdd = excluded.esforco_sdd, pts_sem_sdd = excluded.pts_sem_sdd, esforco_sem_sdd = excluded.esforco_sem_sdd,
      ganho_sdd = excluded.ganho_sdd, itens_entregues = excluded.itens_entregues, cycle_p50 = excluded.cycle_p50,
      cycle_p85 = excluded.cycle_p85, produtividade = excluded.produtividade, motivacao = excluded.motivacao`;
}

export function sqlAuditar(usuario: string, acao: string, chave: Chave, antes: Linha | null, depois: Linha | null, revertId?: number) {
  return db()`
    insert into historico_auditoria (usuario, acao, time, frente, nome, antes, depois, reverte_id)
    values (${usuario}, ${acao}, ${chave.time}, ${chave.frente}, ${chave.nome},
      ${antes ? JSON.stringify(antes) : null}, ${depois ? JSON.stringify(depois) : null}, ${revertId ?? null})`;
}
