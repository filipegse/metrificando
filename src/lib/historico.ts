// Leitura, edição e auditoria das linhas de historico_periodos.
import { db } from "./db";
import { COLUNAS_COMPOSICAO } from "./composicao";

/** Colunas numéricas de historico_periodos (indicadores + composição). */
export const COLUNAS_METRICAS = ["entrega", "extras", "pts_sdd", "esforco_sdd", "pts_sem_sdd", "esforco_sem_sdd", "ganho_sdd",
  "itens_entregues", "cycle_p50", "cycle_p85", "cycle_media", "produtividade", "motivacao", "pct_itens_tl", "pct_pts_tl", "hora_extra_h", "itens_hora_extra", ...COLUNAS_COMPOSICAO];

export const CAMPOS_EDITAVEIS = ["nome", "tipo", "inicio", "fim", ...COLUNAS_METRICAS] as const;
export type CampoEditavel = (typeof CAMPOS_EDITAVEIS)[number];
export type Chave = { time: string; frente: string; nome: string };
export type Linha = Chave & Record<string, unknown>;

export const SELECT_COLUNAS = `time, frente, nome, tipo, inicio::text as inicio, fim::text as fim, fonte,
  ${COLUNAS_METRICAS.map((c) => `${c}::float as ${c}`).join(", ")}, importado_em::text as importado_em`;

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

const COLUNAS_GRAVAVEIS = ["time", "frente", "nome", "tipo", "inicio", "fim", "fonte", ...COLUNAS_METRICAS];

/**
 * Cria ou atualiza a linha a partir de um registro. `atualizar` limita quais colunas mudam quando a linha
 * já existe (reimportação parcial não apaga o que não veio no arquivo); sem ele, a linha é regravada inteira.
 * Os valores entram como JSON e viram registro com jsonb_populate_record (nomes de coluna vêm da lista fixa acima).
 */
export function sqlGravar(l: Linha, atualizar?: string[]) {
  const sql = db();
  const registro = Object.fromEntries(COLUNAS_GRAVAVEIS.map((c) => [c, l[c] ?? null]));
  registro.fonte ??= "outra";
  const muda = (atualizar ?? COLUNAS_GRAVAVEIS.filter((c) => !["time", "frente", "nome"].includes(c)))
    .filter((c) => COLUNAS_GRAVAVEIS.includes(c));
  return sql`
    insert into historico_periodos (${sql.unsafe(COLUNAS_GRAVAVEIS.join(", "))})
    select ${sql.unsafe(COLUNAS_GRAVAVEIS.join(", "))} from jsonb_populate_record(null::historico_periodos, ${JSON.stringify(registro)}::jsonb)
    on conflict (time, frente, nome) do update set ${sql.unsafe(muda.map((c) => `${c} = excluded.${c}`).join(", "))}, importado_em = now()`;
}

export function sqlAuditar(usuario: string, acao: string, chave: Chave, antes: Linha | null, depois: Linha | null, revertId?: number) {
  return db()`
    insert into historico_auditoria (usuario, acao, time, frente, nome, antes, depois, reverte_id)
    values (${usuario}, ${acao}, ${chave.time}, ${chave.frente}, ${chave.nome},
      ${antes ? JSON.stringify(antes) : null}, ${depois ? JSON.stringify(depois) : null}, ${revertId ?? null})`;
}
