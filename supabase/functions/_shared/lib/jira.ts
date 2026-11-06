// Tipos e funções puras do Jira (sem rede). Compartilhado entre a Edge Function e o app.
export type Transicao = { em: Date; de: string; para: string };

export type IssueJira = {
  key: string;
  fields: Record<string, any>;
  changelog?: { histories: { created: string; items: { field: string; fromString: string | null; toString: string | null }[] }[] };
};

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

type BoardJira = { id: number; location?: { projectKey?: string } };
type SprintJira = { id: number; name: string; originBoardId?: number; startDate?: string; completeDate?: string };

/** Boards que pertencem ao projeto. A busca por projectKeyOrId também traz boards de outros projetos cujo filtro inclui o projeto. */
export function boardsDoProjeto<B extends BoardJira>(boards: B[], projeto: string): B[] {
  return boards.filter((b) => b.location?.projectKey === projeto);
}

/**
 * Sprints criadas no próprio board. O endpoint board/{id}/sprint devolve também sprints de outros boards
 * que tiveram itens no board (ex.: sprint do Nexus aparecendo no SchoolOps).
 */
export function sprintsDoBoard<S extends SprintJira>(sprints: S[], boardId: number): S[] {
  return sprints.filter((s) => s.originBoardId === boardId);
}
