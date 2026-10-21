import { describe, expect, it } from "vitest";
import { saudeDoPeriodo, corEntrega, corExtras, corPontos, indicadores, type LinhaDelivery } from "../src/lib/indicadores";

const periodo = { periodo_id: "1", nome: "DSR 70", tipo: "sprint", inicio: "2026-10-01", fim: "2026-10-14" };
const item = (sp: number, planejamento: string, entregue: boolean, cycle: number | null = 2): LinhaDelivery => ({
  periodo_id: "1", tipo_canonico: "entrega", sp_sdd: sp, sp_sem_sdd: sp * 1.5,
  planejamento, categoria_roadmap: "Pequenas entregas", entregue, cycle_time_dias: cycle,
});

describe("indicadores", () => {
  const ind = indicadores(periodo, [
    item(8, "Planejado", true), item(2, "Planejado", false),
    item(3, "Não planejado (extra)", true), item(1, "Não planejado (bônus)", true),
  ], [
    { periodo_id: "1", nivel: "N3", papel: "chamado", tempo_resolucao_dias: 4 },
    { periodo_id: "1", nivel: "N2", papel: "chamado", tempo_resolucao_dias: 1 },
    { periodo_id: "1", nivel: "N3", papel: "trabalho_n3", tempo_resolucao_dias: 9 },
  ]);

  it("entrega = planejado concluído / planejado", () => expect(ind.entrega).toBeCloseTo(0.8));
  it("extras = (extra + bônus) / concluído", () => expect(ind.extras).toBeCloseTo(4 / 12));
  it("pontos e itens só dos concluídos", () => {
    expect(ind.ptsSdd).toBe(12);
    expect(ind.itensEntregues).toBe(3);
  });
  it("trabalho N3 não soma nos chamados", () => {
    expect(ind.chamados).toBe(2);
    expect(ind.chamadosN3).toBe(1);
    expect(ind.trabalhoN3).toBe(1);
    expect(ind.resolucaoP50).toBe(2.5);
  });
  it("Kanban não tem entrega/extras", () => {
    const k = indicadores({ ...periodo, tipo: "semana" }, [item(5, "Planejado", true)], []);
    expect(k.entrega).toBeNull();
    expect(k.extras).toBeNull();
  });
});

describe("semáforo", () => {
  it("segue as faixas da Sync", () => {
    expect(corEntrega(1)).toBe("bom");
    expect(corEntrega(0.85)).toBe("neutro");
    expect(corEntrega(0.7)).toBe("atencao");
    expect(corExtras(0.1)).toBe("bom");
    expect(corExtras(0.25)).toBe("atencao");
    expect(corPontos(55, 50)).toBe("bom");
    expect(corPontos(42, 50)).toBe("atencao");
  });
});

describe("saúde com frentes", () => {
  it("pondera as frentes pelo número de respostas", () => {
    const h = saudeDoPeriodo([
      { periodo_id: "1", frente: "Retaguarda", produtividade: 0.9, motivacao: 0.8, respostas: 6 },
      { periodo_id: "1", frente: "X-Retaguarda", produtividade: 0.7, motivacao: 1, respostas: 2 },
    ])!;
    expect(h.produtividade).toBeCloseTo(0.85);
    expect(h.motivacao).toBeCloseTo(0.85);
  });
});

describe("recortes da URL", async () => {
  const { recortesDaUrl } = await import("../src/lib/apresentacao");
  it("lê sprints e intervalos por projeto", () => {
    expect(recortesDaUrl({ trimestre: "2026-Q4", s_DSR: "101,102", de_EFC: "2026-09-01", ate_EFC: "2026-10-15" })).toEqual({
      DSR: { sprints: ["101", "102"] }, EFC: { de: "2026-09-01", ate: "2026-10-15" },
    });
  });
});
