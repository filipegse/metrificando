import { describe, expect, it } from "vitest";
import { tempoSemFerias } from "../src/lib/ferias";

const f = (pessoa_id: number, inicio: string, fim: string, tipo = "Férias") => ({ pessoa_id, inicio, fim, tipo });

describe("tempo sem férias", () => {
  it("conta a partir do fim das últimas férias", () => {
    const r = tempoSemFerias(1, "2024-01-01", [f(1, "2025-11-10", "2025-11-24")], "2026-10-22")!;
    expect(r.meses).toBe(10);
    expect(r.nivel).toBe("atencao");
    expect(r.texto).toContain("24/11/2025");
  });
  it("sem férias registradas conta da entrada; 12+ meses é crítico", () => {
    const r = tempoSemFerias(2, "2025-08-01", [f(2, "2026-03-02", "2026-03-04", "Folga")], "2026-10-22")!;
    expect(r.semRegistro).toBe(true);
    expect(r.nivel).toBe("critico");
  });
  it("informa férias futuras e não alerta quem está de férias hoje", () => {
    const r = tempoSemFerias(3, "2024-01-01", [f(3, "2025-09-01", "2025-09-20"), f(3, "2027-01-04", "2027-01-23")], "2026-10-22")!;
    expect(r.nivel).toBe("critico");
    expect(r.texto).toContain("04/01/2027");
    expect(tempoSemFerias(4, "2024-01-01", [f(4, "2026-10-20", "2026-10-30")], "2026-10-22")).toBeNull();
  });
});
