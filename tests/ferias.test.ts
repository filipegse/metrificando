import { describe, expect, it } from "vitest";
import { tempoSemFerias } from "../src/lib/ferias";

const f = (pessoa_id: number, inicio: string, fim: string, tipo = "Férias") => ({ pessoa_id, inicio, fim, tipo });
const hoje = "2026-10-22";

describe("situação de férias (CLT)", () => {
  it("primeiro ano de casa não gera aviso", () => {
    expect(tempoSemFerias(1, "2026-01-10", [], hoje)).toBeNull();
  });
  it("até o mês 21 do período aquisitivo não avisa", () => {
    // admissão 01/02/2025 → hoje é o mês 21 (20 meses completos)
    expect(tempoSemFerias(1, "2025-02-01", [], hoje)!.nivel).toBe("ok");
  });
  it("a partir do mês 22 avisa; com 24 está vencido", () => {
    const r = tempoSemFerias(1, "2024-12-15", [], hoje)!; // 22 meses completos
    expect(r.nivel).toBe("atencao");
    expect(r.prazo).toBe("2026-12-15");
    expect(tempoSemFerias(1, "2024-09-01", [], hoje)!.nivel).toBe("critico");
  });
  it("férias tiradas no prazo atendem o período; conta o período seguinte", () => {
    // admissão 01/03/2023: período 2 começa 01/03/2024, prazo 01/03/2026 (depois do corte) → 31 meses: vencido
    expect(tempoSemFerias(1, "2023-03-01", [f(1, "2024-07-01", "2024-07-30")], hoje)!.nivel).toBe("critico");
    // com férias também em 2025 (prazo do período 2), o período 3 começa 01/03/2025 → 19 meses: ok
    expect(tempoSemFerias(1, "2023-03-01", [f(1, "2024-07-01", "2024-07-30"), f(1, "2025-08-04", "2025-08-23")], hoje)?.nivel ?? "ok").toBe("ok");
  });
  it("férias já marcadas dentro do prazo apagam o aviso", () => {
    // férias marcadas para 16/11/2026 (prazo do período vai até 15/12/2026): período considerado atendido
    expect(tempoSemFerias(1, "2024-12-15", [f(1, "2026-11-16", "2026-12-05")], hoje)).toBeNull();
    // marcadas depois do prazo: continua avisando e diz que está fora do prazo
    const r = tempoSemFerias(1, "2024-12-15", [f(1, "2027-01-11", "2027-01-30")], hoje)!;
    expect(r.nivel).toBe("atencao");
    expect(r.texto).toContain("depois do prazo");
  });
  it("períodos com prazo antes de 01/01/2026 são ignorados", () => {
    // admissão 01/06/2022: período 1 (prazo 01/06/2024) e período 2 (prazo 01/06/2025) ficam fora;
    // período 3 começa 01/06/2024, prazo 01/06/2026 → vencido (28 meses), mesmo sem nenhum registro antes
    const r = tempoSemFerias(1, "2022-06-01", [], hoje)!;
    expect(r.desde).toBe("2024-06-01");
    expect(r.nivel).toBe("critico");
    // com férias em 2025 (prazo do período 3), o período 4 começa 01/06/2025 → 16 meses: ok
    expect(tempoSemFerias(1, "2022-06-01", [f(1, "2025-09-01", "2025-09-30")], hoje)?.nivel ?? "ok").toBe("ok");
  });
  it("sem admissão (terceirizado) não calcula", () => {
    expect(tempoSemFerias(1, null, [], hoje)).toBeNull();
  });
});
