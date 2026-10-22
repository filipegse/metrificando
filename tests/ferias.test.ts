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
    // admissão 01/11/2023: período 2 começa 01/11/2024, prazo 01/11/2026 → 23 meses sem férias: aviso
    expect(tempoSemFerias(1, "2023-11-01", [], hoje)!.nivel).toBe("atencao");
    // com férias em 03/2026 (dentro do prazo do período 2), o período 3 ainda está em aquisição: sem alerta
    expect(tempoSemFerias(1, "2023-11-01", [f(1, "2026-03-02", "2026-03-21")], hoje)).toBeNull();
  });
  it("férias já marcadas dentro do prazo apagam o aviso", () => {
    // férias marcadas para 16/11/2026 (prazo do período vai até 15/12/2026): período considerado atendido
    expect(tempoSemFerias(1, "2024-12-15", [f(1, "2026-11-16", "2026-12-05")], hoje)).toBeNull();
    // marcadas depois do prazo: continua avisando e diz que está fora do prazo
    const r = tempoSemFerias(1, "2024-12-15", [f(1, "2027-01-11", "2027-01-30")], hoje)!;
    expect(r.nivel).toBe("atencao");
    expect(r.texto).toContain("depois do prazo");
  });
  it("períodos com prazo antes de 01/09/2026 são ignorados", () => {
    // admissão 01/06/2022: prazos 06/2024, 06/2025 e 06/2026 ficam fora do corte; o período 4 (desde 01/06/2025) tem 16 meses: sem alerta
    expect(tempoSemFerias(1, "2022-06-01", [], hoje)?.nivel ?? "ok").toBe("ok");
    // admissão 15/09/2024: prazo do 1º período em 15/09/2026, depois do corte → vencido
    const r = tempoSemFerias(1, "2024-09-15", [], hoje)!;
    expect(r.desde).toBe("2024-09-15");
    expect(r.nivel).toBe("critico");
  });
  it("sem admissão (terceirizado) não calcula", () => {
    expect(tempoSemFerias(1, null, [], hoje)).toBeNull();
  });
});

describe("janelas pelo aniversário da admissão (regra confirmada)", () => {
  // admissão 01/03/2024: cada janela de 12 meses (01/03 a 01/03) precisa de férias; aviso a partir de 01/01 da janela
  const adm = "2024-03-01";
  it("2ª janela (01/03/2026–01/03/2027): aviso a partir de 01/01/2027, vencida em 01/03/2027", () => {
    const tirou1 = [f(1, "2025-07-07", "2025-07-26")];
    expect(tempoSemFerias(1, adm, tirou1, "2026-12-31")?.nivel ?? "ok").toBe("ok");
    expect(tempoSemFerias(1, adm, tirou1, "2027-01-01")!.nivel).toBe("atencao");
    expect(tempoSemFerias(1, adm, tirou1, "2027-03-01")!.nivel).toBe("critico");
  });
  it("a data das férias anteriores não desloca as janelas seguintes", () => {
    // férias tiradas tarde na 1ª janela (02/2026) não empurram o prazo da 2ª janela
    expect(tempoSemFerias(1, adm, [f(1, "2026-02-02", "2026-02-21")], "2027-01-01")!.prazo).toBe("2027-03-01");
  });
});
