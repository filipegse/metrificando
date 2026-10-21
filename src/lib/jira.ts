export type Transicao = { em: Date; de: string; para: string };

export type IssueJira = {
  key: string;
  fields: Record<string, any>;
  changelog?: { histories: { created: string; items: { field: string; fromString: string | null; toString: string | null }[] }[] };
};

function cabecalhos(): HeadersInit {
  const { JIRA_EMAIL, JIRA_API_TOKEN } = process.env;
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) throw new Error("JIRA_EMAIL/JIRA_API_TOKEN não configurados");
  return {
    Authorization: "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64"),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function base(): string {
  const url = process.env.JIRA_BASE_URL;
  if (!url) throw new Error("JIRA_BASE_URL não configurado");
  return url.replace(/\/$/, "");
}

/** Busca paginada (API v3 /search/jql), sempre com changelog para calcular etapas. */
export async function buscar(jql: string, fields: string[]): Promise<IssueJira[]> {
  const issues: IssueJira[] = [];
  let nextPageToken: string | undefined;
  do {
    const resp = await fetch(`${base()}/rest/api/3/search/jql`, {
      method: "POST",
      headers: cabecalhos(),
      body: JSON.stringify({ jql, fields, expand: "changelog", maxResults: 100, nextPageToken }),
    });
    if (!resp.ok) throw new Error(`Jira ${resp.status}: ${await resp.text()}`);
    const dados = await resp.json();
    issues.push(...dados.issues);
    nextPageToken = dados.nextPageToken;
  } while (nextPageToken);
  return issues;
}

export async function agile<T = any>(caminho: string): Promise<T> {
  const resp = await fetch(`${base()}/rest/agile/1.0/${caminho}`, { headers: cabecalhos() });
  if (!resp.ok) throw new Error(`Jira Agile ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

/** Transições de status em ordem cronológica. */
export function transicoes(issue: IssueJira): Transicao[] {
  const lista: Transicao[] = [];
  for (const h of issue.changelog?.histories ?? []) {
    for (const item of h.items) {
      if (item.field === "status") {
        lista.push({ em: new Date(h.created), de: item.fromString ?? "", para: item.toString ?? "" });
      }
    }
  }
  return lista.sort((a, b) => a.em.getTime() - b.em.getTime());
}
