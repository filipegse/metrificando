import { describe, expect, it } from "vitest";
import { montarGravacao, planejar } from "../supabase/functions/_shared/lib/coletaCore.ts";
import { issue } from "./fixtures";

const cal = { expedientes: [], feriados: new Set<string>() };

describe("planejar", () => {
  it("sprint: delivery pela sprint e uma consulta por fonte de suporte", () => {
    const { periodo, consultas } = planejar({ evento: "sprint_concluida", projeto: "TRG", sprint_id: "900", sprint_nome: "X-Reta 12", inicio: "2026-10-01T12:00:00Z", fim: "2026-10-15T12:00:00Z" });
    expect(periodo).toMatchObject({ periodoId: "900", tipo: "sprint", frente: "X-Retaguarda" });
    expect(consultas.map((c) => c.id)).toEqual(["delivery", "suporte:TRG"]);
    expect(consultas[0].jql).toContain("sprint = 900");
  });

  it("Kanban: janela sábado–sexta já fechada e as duas fontes do Rematrix", () => {
    const { periodo, consultas } = planejar({ evento: "janela_semanal", projeto: "IC", referencia: "2026-11-07T01:30:00Z" });
    expect(periodo.periodoId).toBe("2026-10-31");
    expect(consultas.map((c) => c.id)).toEqual(["delivery", "suporte:SC", "suporte:SIS"]);
  });

  it("recusa evento incompatível com a metodologia e projeto sem perfil", () => {
    expect(() => planejar({ evento: "janela_semanal", projeto: "DSR" })).toThrow(/Kanban/);
    expect(() => planejar({ evento: "janela_semanal", projeto: "XYZ" })).toThrow(/sem perfil/);
  });
});

describe("montarGravacao", () => {
  const ev = { evento: "sprint_concluida" as const, projeto: "TRG", sprint_id: "900", sprint_nome: "X-Reta 12", inicio: "2026-10-01T12:00:00Z", fim: "2026-10-15T12:00:00Z" };
  const { perfil, periodo } = planejar(ev);
  const feito = (k: string, extra: Record<string, any> = {}) => issue(k, "História", "Concluído", [
    ["2026-10-02T10:00:00.000-0300", "Backlog", "Em progresso"],
    ["2026-10-05T10:00:00.000-0300", "Em progresso", "Concluído"],
  ], extra);
  const suporte = (k: string, comp: string) => issue(k, "Suporte", "Concluído", [
    ["2026-10-06T10:00:00.000-0300", "Backlog", "Concluído"],
  ], { components: [{ name: comp }] });

  const g = montarGravacao(perfil, periodo, {
    delivery: [feito("TRG-1", { assignee: { displayName: "Ana Tech Lead" } }), feito("TRG-2"), issue("TRG-3", "Épico", "Concluído", [])],
    "suporte:TRG": [suporte("TRG-10", "X-Retaguarda"), suporte("TRG-11", "Retaguarda"), suporte("TRG-10", "X-Retaguarda")],
  }, cal, [{ nome: "Ana Tech Lead", inicio: "2026-01-01", fim: null }]);

  it("grava linhas com nomes de coluna e sem nome de pessoa", () => {
    expect(g.periodo).toMatchObject({ time: "Retaguarda", periodo_id: "900", frente: "X-Retaguarda", tipo: "sprint" });
    expect(g.delivery.map((d) => d.chave)).toEqual(["TRG-1", "TRG-2"]);
    expect(JSON.stringify(g)).not.toContain("Ana Tech Lead");
  });

  it("marca itens do tech lead pela alocação vigente", () => {
    expect(g.delivery.find((d) => d.chave === "TRG-1")?.por_tech_lead).toBe(true);
    expect(g.delivery.find((d) => d.chave === "TRG-2")?.por_tech_lead).toBe(false);
  });

  it("sprint de frente só leva o suporte da frente, sem duplicar chave", () => {
    expect(g.suporte.map((s) => s.chave)).toEqual(["TRG-10"]);
  });
});
