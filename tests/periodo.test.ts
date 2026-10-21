import { describe, expect, it } from "vitest";
import { janelaSemanal } from "../src/lib/periodo";

describe("janela semanal sábado–sexta (America/Bahia)", () => {
  it("disparo de sexta 23h cobre a janela que acabou de fechar", () => {
    const j = janelaSemanal(new Date("2026-10-24T02:00:00Z")); // sex 23/10 23h na Bahia
    expect(j.periodoId).toBe("2026-10-17");
    expect(j.inicio.toISOString()).toBe("2026-10-17T03:00:00.000Z");
    expect(j.fim.toISOString()).toBe("2026-10-24T02:59:59.000Z");
  });

  it("sábado já abre a janela seguinte", () => {
    expect(janelaSemanal(new Date("2026-10-24T12:00:00Z")).periodoId).toBe("2026-10-24");
  });
});
