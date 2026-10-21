import { describe, expect, it } from "vitest";
import { capacidade, type AlocacaoCap } from "../src/lib/capacidade";

const cal = { expedientes: [], feriados: new Set(["2026-10-12"]) };
const aloc = (p: number, cargo: string, extra: Partial<AlocacaoCap> = {}): AlocacaoCap =>
  ({ pessoa_id: p, time: "Desenrola", frente: "", cargo, percentual: 1, inicio: "2026-01-01", fim: null, ...extra });

describe("capacidade", () => {
  // 05/10 a 16/10/2026: 10 dias úteis menos o feriado de 12/10 = 9
  const de = "2026-10-05", ate = "2026-10-16";
  it("soma dias úteis só de Devs", () => {
    expect(capacidade([aloc(1, "Dev"), aloc(2, "Dev"), aloc(3, "TL"), aloc(4, "QA")], [], cal, { time: "Desenrola" }, de, ate)).toBe(18);
  });
  it("desconta ausências e aplica % de alocação", () => {
    const r = capacidade([aloc(1, "Dev"), aloc(2, "Dev", { percentual: 0.5 })],
      [{ pessoa_id: 1, inicio: "2026-10-13", fim: "2026-10-14" }], cal, { time: "Desenrola" }, de, ate);
    expect(r).toBe(7 + 4.5);
  });
  it("respeita entrada e saída no time", () => {
    expect(capacidade([aloc(1, "Dev", { fim: "2026-10-09" }), aloc(2, "Dev", { inicio: "2026-10-15" })], [], cal, { time: "Desenrola" }, de, ate)).toBe(5 + 2);
  });
  it("por frente conta só quem está na frente (ou no time inteiro)", () => {
    const a = [aloc(1, "Dev", { time: "Nexus", frente: "Integrações" }), aloc(2, "Dev", { time: "Nexus", frente: "Avaliações" })];
    expect(capacidade(a, [], cal, { time: "Nexus", frente: "Integrações" }, de, ate)).toBe(9);
    expect(capacidade(a, [], cal, { time: "Nexus" }, de, ate)).toBe(18);
  });
});
