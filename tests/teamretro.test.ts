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

describe("frentes com sprints próprias (TRG)", async () => {
  const { perfilPorProjeto, frenteDaSprint } = await import("../src/config/perfis");
  const trg = perfilPorProjeto("TRG")!;
  it("reconhece a frente pelo nome da sprint", () => {
    expect(frenteDaSprint(trg, "X-Reta | Sprint 132")).toBe("X-Retaguarda");
    expect(frenteDaSprint(trg, "Sprint 110 - 13/10 - 26/10")).toBe("Retaguarda");
    expect(frenteDaSprint(perfilPorProjeto("DSR")!, "DSR 70")).toBe("");
  });
  it("health check casa pelo número da sprint, sem confundir com a data do nome", () => {
    const periodos = [
      { periodo_id: "a", tipo: "sprint", nome: "Sprint 110 - 13/10 - 26/10", inicio: "2026-10-13T03:00:00Z", fim: "2026-10-26T20:00:00Z", frente: "Retaguarda" },
      { periodo_id: "b", tipo: "sprint", nome: "Sprint 109 - 29/09 - 12/10", inicio: "2026-09-29T03:00:00Z", fim: "2026-10-12T20:00:00Z", frente: "Retaguarda" },
    ];
    expect(periodoDoHealthCheck("2026-10-27", periodos, "Retaguarda 110")).toBe("a");
    expect(periodoDoHealthCheck("2026-10-27", periodos, "Retaguarda 109")).toBe("b");
    expect(periodoDoHealthCheck("2026-10-27", [{ periodo_id: "x", tipo: "sprint", nome: "X-Reta | Sprint 132", inicio: "2026-10-13T03:00:00Z", fim: "2026-10-26T20:00:00Z" }], "X-Reta | 132")).toBe("x");
  });
});

import { periodoDoHealthCheck as pdh } from "../src/lib/teamretro";
describe("health check em semana do histórico", () => {
  it("sexta-feira à tarde ainda é da semana (datas sem hora)", () => {
    const ps = [{ periodo_id: "h:a", tipo: "semana", nome: "27/06–03/07/2026", inicio: "2026-06-27", fim: "2026-07-03" }];
    expect(pdh("2026-07-03", ps)).toBe("h:a");
    expect(pdh("2026-07-04", ps)).toBeNull();
  });
});

import { semanasDoHealthCheck } from "../src/lib/teamretro";
describe("health check Kanban cobre várias semanas", () => {
  const sem = (i: string, f: string) => ({ periodo_id: `h:${i}`, tipo: "semana", nome: i, inicio: i, fim: f });
  const ps = [sem("2026-09-05", "2026-09-11"), sem("2026-09-26", "2026-10-02"), sem("2026-10-03", "2026-10-09"), sem("2026-10-10", "2026-10-16")];
  it("da data do título até a sexta anterior", () => {
    expect(semanasDoHealthCheck("2026-10-12", "11.Q3.26 28/09", ps)).toEqual(["h:2026-09-26", "h:2026-10-03"]);
    expect(semanasDoHealthCheck("2026-09-14", "10.Q3.26 07/09", ps)).toEqual(["h:2026-09-05"]);
  });
  it("sem data no título: última semana fechada", () => {
    expect(semanasDoHealthCheck("2026-10-12", "Health", ps)).toEqual(["h:2026-10-03"]);
  });
});
