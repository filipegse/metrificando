import { describe, expect, it } from "vitest";
import { feriadosDoAno, pascoa } from "../src/config/feriados";

describe("feriados por ano", () => {
  it("Páscoa", () => {
    expect(pascoa(2025).toISOString().slice(0, 10)).toBe("2025-04-20");
    expect(pascoa(2026).toISOString().slice(0, 10)).toBe("2026-04-05");
    expect(pascoa(2027).toISOString().slice(0, 10)).toBe("2027-03-28");
  });
  it("2026 bate com o calendário da TAP do vault (datas corrigidas)", () => {
    const d = Object.fromEntries(feriadosDoAno(2026).map(([data, nome]) => [data, nome]));
    expect(d["2026-02-16"]).toBe("Carnaval");
    expect(d["2026-02-18"]).toBe("Cinzas");
    expect(d["2026-04-03"]).toBe("Paixão de Cristo");
    expect(d["2026-06-04"]).toBe("Corpus Christi");
    expect(feriadosDoAno(2026)).toHaveLength(19);
  });
  it("2027 calcula as datas móveis", () => {
    const d = Object.fromEntries(feriadosDoAno(2027).map(([data, nome]) => [nome + data.slice(5), data]));
    expect(d["Carnaval02-08"]).toBe("2027-02-08");
    expect(d["Paixão de Cristo03-26"]).toBe("2027-03-26");
    expect(d["Corpus Christi05-27"]).toBe("2027-05-27");
  });
});
