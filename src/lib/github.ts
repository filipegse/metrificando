// Coleta de PRs do GitHub (DORA/SPACE) e atribuição a time/frente. O login do autor só serve para achar
// a alocação vigente na data do merge: os painéis agregam por time e frente, nunca por pessoa.
import { PERFIS } from "../config/perfis";

const API = "https://api.github.com";
export const ORG = () => process.env.GITHUB_ORG || "gruposaltaedu";

/** Bases em que o merge vai para produção (o deploy roda no merge). Merge em develop não é deploy. */
export const BASES_PRODUCAO = ["master", "main", "production"];
const HOTFIX = /^(hotfix|fix|bugfix)\//i;

export type PR = {
  repo: string;
  numero: number;
  autor: string;
  titulo: string;
  head: string;
  base: string;
  estado: "open" | "closed";
  rascunho: boolean;
  criadoEm: string;
  mergedEm: string | null;
  fechadoEm: string | null;
  primeiraReviewEm: string | null;
  adicoes: number | null;
  delecoes: number | null;
  arquivos: number | null;
};

export type AlocacaoLogin = { login: string; time: string; frente: string; percentual: number; inicio: string; fim: string | null };
export type Atribuicao = { time: string | null; frente: string; chaveJira: string | null; origem: "jira" | "login" | "nao_atribuido" };

/** Primeira chave do Jira de um projeto da TAP no branch ou no título (ex.: feature/NXS-9779-..., feat(NXS-9700): ...). */
export function chaveJira(...textos: string[]): string | null {
  const projetos = new Set(PERFIS.map((p) => p.projeto));
  for (const t of textos) for (const m of t.matchAll(/\b([A-Z][A-Z0-9]+)-(\d+)\b/gi)) {
    if (projetos.has(m[1].toUpperCase())) return `${m[1].toUpperCase()}-${m[2]}`;
  }
  return null;
}

/** Alocação do login vigente no dia (a de maior percentual, se houver mais de uma). */
export function alocacaoVigente(login: string, dia: string, alocacoes: AlocacaoLogin[]): AlocacaoLogin | null {
  const l = login.toLowerCase();
  return alocacoes
    .filter((a) => a.login.toLowerCase() === l && a.inicio <= dia && (!a.fim || a.fim >= dia))
    .sort((a, b) => b.percentual - a.percentual)[0] ?? null;
}

/**
 * Chave do Jira manda (repos compartilhados: o PR é do time do item). Sem chave, vale a alocação do autor
 * na data do merge (ou da abertura). A frente vem da alocação do autor quando ela é do mesmo time.
 */
export function atribuir(pr: Pick<PR, "autor" | "titulo" | "head" | "criadoEm" | "mergedEm">, alocacoes: AlocacaoLogin[]): Atribuicao {
  const chave = chaveJira(pr.head, pr.titulo);
  const dia = (pr.mergedEm ?? pr.criadoEm).slice(0, 10);
  const aloc = alocacaoVigente(pr.autor, dia, alocacoes);
  const doJira = chave ? PERFIS.find((p) => p.projeto === chave.split("-")[0])?.time ?? null : null;
  if (doJira) return { time: doJira, frente: aloc?.time === doJira ? aloc.frente : "", chaveJira: chave, origem: "jira" };
  if (aloc) return { time: aloc.time, frente: aloc.frente, chaveJira: chave, origem: "login" };
  return { time: null, frente: "", chaveJira: chave, origem: "nao_atribuido" };
}

export const ehDeploy = (pr: Pick<PR, "base" | "mergedEm">) => !!pr.mergedEm && BASES_PRODUCAO.includes(pr.base);
export const ehHotfix = (pr: Pick<PR, "head">) => HOTFIX.test(pr.head);

const horas = (de: string, ate: string) => (new Date(ate).getTime() - new Date(de).getTime()) / 3_600_000;
function quantil(xs: number[], q: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
}

export type IndicadoresEngenharia = {
  prsMergeados: number;
  deploys: number;               // releases distintas: mesmo repo e mesmo dia (master e production juntos)
  deploysHotfix: number;
  taxaFalha: number | null;      // deploys de hotfix ÷ deploys
  leadTimeH: number | null;      // mediana: PR aberto → merge (PRs de trabalho, fora os de deploy)
  leadTimeP85H: number | null;
  primeiraReviewH: number | null; // mediana: PR aberto → primeira review de outra pessoa
  tamanhoMediano: number | null; // linhas alteradas por PR de trabalho
  fechadosSemMerge: number;
};

const diaBahia = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);

export function indicadores(prs: PR[]): IndicadoresEngenharia {
  const mergeados = prs.filter((p) => p.mergedEm);
  const deploys = mergeados.filter(ehDeploy);
  const releases = new Map<string, boolean>(); // repo|dia → teve hotfix
  for (const p of deploys) {
    const k = `${p.repo}|${diaBahia(p.mergedEm!)}`;
    releases.set(k, (releases.get(k) ?? false) || ehHotfix(p));
  }
  const hot = [...releases.values()].filter(Boolean).length;
  const trabalho = mergeados.filter((p) => !ehDeploy(p));
  const lead = trabalho.map((p) => horas(p.criadoEm, p.mergedEm!));
  const review = prs.filter((p) => p.primeiraReviewEm).map((p) => horas(p.criadoEm, p.primeiraReviewEm!));
  const tamanho = trabalho.filter((p) => p.adicoes != null).map((p) => p.adicoes! + (p.delecoes ?? 0));
  return {
    prsMergeados: trabalho.length,
    deploys: releases.size,
    deploysHotfix: hot,
    taxaFalha: releases.size ? hot / releases.size : null,
    leadTimeH: quantil(lead, 0.5),
    leadTimeP85H: quantil(lead, 0.85),
    primeiraReviewH: quantil(review, 0.5),
    tamanhoMediano: quantil(tamanho, 0.5),
    fechadosSemMerge: prs.filter((p) => p.estado === "closed" && !p.mergedEm).length,
  };
}

async function gh<T>(caminho: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN ausente");
  for (let tentativa = 0; ; tentativa++) {
    const r = await fetch(`${API}/${caminho}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
    });
    if (r.ok) return r.json() as Promise<T>;
    if ((r.status === 403 || r.status === 429 || r.status >= 500) && tentativa < 3) {
      await new Promise((ok) => setTimeout(ok, 2000 * 2 ** tentativa));
      continue;
    }
    throw new Error(`GitHub ${r.status} em ${caminho}: ${(await r.text()).slice(0, 200)}`);
  }
}

/** Repos da org com push desde `desde` (arquivados ficam de fora). */
export async function listarRepos(desde: string): Promise<string[]> {
  const repos: string[] = [];
  for (let pag = 1; ; pag++) {
    const lote = await gh<{ name: string; pushed_at: string; archived: boolean }[]>(`orgs/${ORG()}/repos?per_page=100&page=${pag}`);
    repos.push(...lote.filter((r) => !r.archived && r.pushed_at >= desde).map((r) => r.name));
    if (lote.length < 100) return repos;
  }
}

/** PRs do repo atualizados desde `desde`, com primeira review (de outra pessoa) e tamanho. */
export async function listarPRs(repo: string, desde: string): Promise<PR[]> {
  const prs: PR[] = [];
  for (let pag = 1; ; pag++) {
    const lote = await gh<any[]>(`repos/${ORG()}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=100&page=${pag}`);
    const novos = lote.filter((p) => p.updated_at >= desde);
    for (const p of novos) {
      const [det, reviews] = await Promise.all([
        gh<any>(`repos/${ORG()}/${repo}/pulls/${p.number}`),
        gh<any[]>(`repos/${ORG()}/${repo}/pulls/${p.number}/reviews?per_page=100`),
      ]);
      const primeira = reviews.filter((r) => r.user?.login !== p.user?.login && r.submitted_at).map((r) => r.submitted_at as string).sort()[0] ?? null;
      prs.push({
        repo, numero: p.number, autor: p.user?.login ?? "", titulo: p.title, head: p.head?.ref ?? "", base: p.base?.ref ?? "",
        estado: p.state, rascunho: !!p.draft, criadoEm: p.created_at, mergedEm: p.merged_at, fechadoEm: p.closed_at,
        primeiraReviewEm: primeira, adicoes: det.additions ?? null, delecoes: det.deletions ?? null, arquivos: det.changed_files ?? null,
      });
    }
    if (lote.length < 100 || novos.length < lote.length) return prs;
  }
}

/** Coleta os PRs atualizados nos últimos `dias` em todos os repos ativos, atribui e grava (idempotente). */
export async function coletarGithub(dias: number): Promise<{ repos: number; prs: number; naoAtribuidos: number; nomes: string[] }> {
  const { db } = await import("./db");
  const sql = db();
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const alocacoes = (await sql`
    select p.github_login as login, a.time, a.frente, a.percentual::float as percentual, a.inicio::text, a.fim::text
    from pessoas p join alocacoes a on a.pessoa_id = p.id where p.github_login is not null`) as AlocacaoLogin[];
  const repos = await listarRepos(desde);
  let total = 0, naoAtribuidos = 0;
  for (const repo of repos) {
    for (const pr of await listarPRs(repo, desde)) {
      const a = atribuir(pr, alocacoes);
      total++;
      if (!a.time) naoAtribuidos++;
      await sql`
        insert into itens_pr (repo, numero, autor, titulo, head, base, estado, rascunho, criado_em, merged_em, fechado_em,
          primeira_review_em, adicoes, delecoes, arquivos, chave_jira, time, frente, origem, deploy, hotfix)
        values (${pr.repo}, ${pr.numero}, ${pr.autor}, ${pr.titulo}, ${pr.head}, ${pr.base}, ${pr.estado}, ${pr.rascunho},
          ${pr.criadoEm}, ${pr.mergedEm}, ${pr.fechadoEm}, ${pr.primeiraReviewEm}, ${pr.adicoes}, ${pr.delecoes}, ${pr.arquivos},
          ${a.chaveJira}, ${a.time}, ${a.frente}, ${a.origem}, ${ehDeploy(pr)}, ${ehHotfix(pr)})
        on conflict (repo, numero) do update set autor = excluded.autor, titulo = excluded.titulo, head = excluded.head,
          base = excluded.base, estado = excluded.estado, rascunho = excluded.rascunho, merged_em = excluded.merged_em,
          fechado_em = excluded.fechado_em, primeira_review_em = excluded.primeira_review_em, adicoes = excluded.adicoes,
          delecoes = excluded.delecoes, arquivos = excluded.arquivos, chave_jira = excluded.chave_jira, time = excluded.time,
          frente = excluded.frente, origem = excluded.origem, deploy = excluded.deploy, hotfix = excluded.hotfix, coletado_em = now()`;
    }
  }
  return { repos: repos.length, prs: total, naoAtribuidos, nomes: repos };
}

/** Reatribui os PRs já gravados (depois de cadastrar logins ou mudar alocações), sem chamar o GitHub. */
export async function reatribuir(): Promise<number> {
  const { db } = await import("./db");
  const sql = db();
  const alocacoes = (await sql`
    select p.github_login as login, a.time, a.frente, a.percentual::float as percentual, a.inicio::text, a.fim::text
    from pessoas p join alocacoes a on a.pessoa_id = p.id where p.github_login is not null`) as AlocacaoLogin[];
  const prs = (await sql`select repo, numero, autor, titulo, head, criado_em::text as "criadoEm", merged_em::text as "mergedEm" from itens_pr`) as any[];
  for (const p of prs) {
    const a = atribuir(p, alocacoes);
    await sql`update itens_pr set chave_jira = ${a.chaveJira}, time = ${a.time}, frente = ${a.frente}, origem = ${a.origem}
      where repo = ${p.repo} and numero = ${p.numero}`;
  }
  return prs.length;
}
