import { describe, expect, it } from "vitest";
import { DIMENSOES, periodoDoHealthCheck, saudeDe, type HealthCheck } from "../src/lib/teamretro";

const hc = (notas: Record<keyof typeof DIMENSOES, number[]>, date = "2026-06-02"): HealthCheck => ({
  id: "x", date, status: "closed", healthModel: { id: "m", maxRating: 5 },
  dimensions: Object.entries(notas).map(([k, v]) => ({ id: DIMENSOES[k as keyof typeof DIMENSOES], ratings: v.map((rating) => ({ rating })) })),
});

describe("saúde do time", () => {
  it("bate com o fechamento do Q2 (Desenrola 61: 95% / 98%)", () => {
    const s = saudeDe(hc({ prodColetiva: [5, 5, 4, 4], prodIndividual: [5, 5, 5, 5], motIndividual: [5, 5, 5, 4], motColetiva: [5, 5, 5, 5] }));
    expect(s.produtividade).toBeCloseTo(0.95);
    expect(Math.round(s.motivacao! * 100)).toBe(98);
    expect(s.respostas).toBe(4);
  });

  it("Desenrola 63: 88% / 92%", () => {
    const s = saudeDe(hc({ prodColetiva: [5, 5, 5, 4, 3], prodIndividual: [5, 5, 5, 4, 3], motIndividual: [5, 5, 5, 4, 4], motColetiva: [5, 5, 5, 4, 4] }));
    expect(s.produtividade).toBeCloseTo(0.88);
    expect(s.motivacao).toBeCloseTo(0.92);
  });

  it("dimensão sem resposta deixa o indicador vazio", () => {
    expect(saudeDe(hc({ prodColetiva: [], prodIndividual: [4], motIndividual: [4], motColetiva: [4] })).produtividade).toBeNull();
  });
});

describe("associação ao período", () => {
  const sprints = [
    { periodo_id: "60", tipo: "sprint", inicio: "2026-05-05T03:00:00Z", fim: "2026-05-19T20:00:00Z" },
    { periodo_id: "61", tipo: "sprint", inicio: "2026-05-19T21:00:00Z", fim: "2026-06-02T20:00:00Z" },
  ];
  it("sprint com fim mais próximo da data", () => expect(periodoDoHealthCheck("2026-06-02", sprints)).toBe("61"));
  it("fora da tolerância não associa", () => expect(periodoDoHealthCheck("2026-07-01", sprints)).toBeNull());
  it("número da sprint no título tem prioridade sobre a data", () => {
    const comNome = [
      { ...sprints[0], nome: "TRG 108" },
      { ...sprints[1], nome: "TRG 109" },
    ];
    expect(periodoDoHealthCheck("2026-06-02", comNome, "Retaguarda 108")).toBe("60");
    expect(periodoDoHealthCheck("2026-06-02", comNome, "Sprint 109 - 14/09 - 25/09")).toBe("61");
  });
  it("Kanban: semana que contém a data", () => {
    const semanas = [{ periodo_id: "2026-10-17", tipo: "semana", inicio: "2026-10-17T03:00:00Z", fim: "2026-10-24T02:59:59Z" }];
    expect(periodoDoHealthCheck("2026-10-20", semanas)).toBe("2026-10-17");
  });
});

describe("time compartilhado no TeamRetro", async () => {
  const { perfilPorProjeto } = await import("../src/config/perfis");
  const serie = (projeto: string, titulo: string) =>
    perfilPorProjeto(projeto)!.teamRetroSeries!.find((s) => s.titulo.test(titulo));
  it("TRG: frentes Retaguarda e X-Retaguarda pelo título", () => {
    expect(serie("TRG", "Retaguarda 109")?.frente).toBe("Retaguarda");
    expect(serie("TRG", "Sprint 108 - 14/09 - 25/09")?.frente).toBe("Retaguarda");
    expect(serie("TRG", "X-Reta | 131")?.frente).toBe("X-Retaguarda");
    expect(serie("TRG", "Fluig 82")).toBeUndefined();
  });
  it("Contas a Pagar: série Fluig", () => {
    expect(serie("CF", "Fluig 82")).toBeDefined();
    expect(serie("CF", "X-Reta | 131")).toBeUndefined();
  });
});
