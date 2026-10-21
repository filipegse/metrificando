import { describe, expect, it } from "vitest";
import { diasUteis, tempoUtil, type Calendario } from "../src/lib/calendario";

const cal: Calendario = { expedientes: [{ validoDe: "2026-01-01", inicio: "09:00", fim: "18:48" }], feriados: new Set(["2026-10-12"]) };
const bahia = (s: string) => new Date(`${s}-03:00`);

describe("tempo útil", () => {
  it("um expediente inteiro = 9h48 = 1 dia útil", () => {
    expect(tempoUtil(bahia("2026-10-13T09:00:00"), bahia("2026-10-13T18:48:00"), cal)).toEqual({ horas: 9.8, dias: 1 });
  });
  it("ignora noite, fim de semana e feriado", () => {
    // sex 09/10 17:00 → ter 13/10 10:00: sex 1h48 + (sáb, dom, seg feriado) + ter 1h
    const r = tempoUtil(bahia("2026-10-09T17:00:00"), bahia("2026-10-13T10:00:00"), cal);
    expect(r.horas).toBeCloseTo(2.8);
    expect(r.dias).toBeCloseTo(1.8 / 9.8 + 1 / 9.8, 2);
  });
  it("mudança de expediente vale a partir da data configurada", () => {
    const c2: Calendario = { ...cal, expedientes: [...cal.expedientes, { validoDe: "2026-11-02", inicio: "09:00", fim: "18:00" }] };
    expect(tempoUtil(bahia("2026-11-03T09:00:00"), bahia("2026-11-03T18:00:00"), c2)).toEqual({ horas: 9, dias: 1 });
  });
  it("conta dias úteis do período", () => {
    expect(diasUteis("2026-10-09", "2026-10-16", cal)).toEqual(["2026-10-09", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]);
  });
});
