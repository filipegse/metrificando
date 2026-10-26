import { describe, expect, it } from "vitest";
import { tempoPorStatus } from "../src/lib/tempoStatus";

const cal = { expedientes: [], feriados: new Set<string>(["2026-10-12"]) };
// horário de Brasília → Date
const br = (s: string) => new Date(`${s}-03:00`);
const mov = (de: string, para: string, em: string) => ({ de, para, em: br(em) });

describe("tempo por status (regras do script da planilha)", () => {
  it("ignora Backlog/Aberto, separa A Fazer e soma o resto em horas úteis", () => {
    const t = tempoPorStatus(br("2026-10-13T08:00:00"), [
      mov("Backlog", "Aberto", "2026-10-13T09:00:00"),
      mov("Aberto", "A Fazer", "2026-10-13T10:00:00"),
      mov("A Fazer", "Em Desenvolvimento", "2026-10-13T12:00:00"),
      mov("Em Desenvolvimento", "Aguardando QA", "2026-10-13T16:00:00"),
      mov("Aguardando QA", "Concluído", "2026-10-13T17:00:00"),
    ], cal);
    expect(t.ciclo).toEqual({ util: 7, extra: 0 });   // A Fazer 2h + dev 4h + QA 1h
    expect(t.cicloDev).toEqual({ util: 5, extra: 0 });
    expect(t.porStatus["A Fazer"].util).toBe(2);
  });
  it("hora extra só na janela com movimentação; feriado conta como fim de semana", () => {
    const t = tempoPorStatus(null, [
      mov("Aberto", "Em Desenvolvimento", "2026-10-12T10:00:00"), // feriado
      mov("Em Desenvolvimento", "Concluído", "2026-10-12T12:00:00"),
    ], cal);
    expect(t.ciclo).toEqual({ util: 0, extra: 2 });
    const u = tempoPorStatus(null, [
      mov("Aberto", "Em Desenvolvimento", "2026-10-13T17:48:00"),
      mov("Em Desenvolvimento", "Concluído", "2026-10-13T20:48:00"),
    ], cal);
    expect(u.ciclo).toEqual({ util: 1, extra: 2 });
  });
  it("sem movimentação na janela noturna, a noite não vira hora extra", () => {
    const t = tempoPorStatus(null, [
      mov("Aberto", "Em Desenvolvimento", "2026-10-13T18:00:00"),
      mov("Em Desenvolvimento", "Concluído", "2026-10-14T10:00:00"),
    ], cal);
    expect(t.ciclo).toEqual({ util: 1.8, extra: 0 });
  });
});
