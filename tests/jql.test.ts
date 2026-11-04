import { describe, expect, it } from "vitest";
import { PERFIS } from "../src/config/perfis";
import { jqlSuporte } from "../src/lib/jql";

describe("jqlSuporte", () => {
  it("filtra o campo Team pelo id do time, não pelo nome", () => {
    for (const nome of ["Nexus", "Eficientes"]) {
      const fonte = PERFIS.find((p) => p.time === nome)!.suporte[0];
      const jql = jqlSuporte(fonte, new Date("2026-10-17T03:00:00Z"), new Date("2026-10-24T02:59:59Z"));
      expect(jql).toContain(`cf[10500] = "${fonte.filtroTeam!.id}"`);
      expect(jql).not.toContain("[TAP]");
      expect(fonte.filtroTeam!.id).toMatch(/^[0-9a-f-]+-\d+$/);
    }
  });
});
