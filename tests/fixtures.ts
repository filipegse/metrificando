import type { IssueJira } from "../src/lib/jira";

export function issue(key: string, tipo: string, status: string, historico: [string, string, string][], extra: Record<string, any> = {}): IssueJira {
  return {
    key,
    fields: { issuetype: { name: tipo }, status: { name: status }, created: "2026-10-01T12:00:00.000-0300", ...extra },
    changelog: {
      histories: historico.map(([created, de, para]) => ({ created, items: [{ field: "status", fromString: de, toString: para }] })),
    },
  };
}
