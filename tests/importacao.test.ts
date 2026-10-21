import { describe, expect, it } from "vitest";
import { data, fracao, lerCsv, montarLinhas, numero, sugerirMapa } from "../src/lib/importacao";

const csv = [
  "Identificação,,,,Pontos,,,",
  ",,,,,,,",
  'Time,Sprint,Data início,Data fim,Qtd Pontos Concluídos COM SDD,Qtd Pontos de Esforço COM SDD,Ganho SDD,Produtividade',
  'DSR,DSR 61 4ª.Q2.26,19/05/2026,02/06/2026,"27,8","28,8",32%,95%',
  'REX,REX 39 1ª.Q3.26,07/07/2026,18/07/2026,30,"32,5","0,21",87%',
  'XYZ,XYZ 1,01/07/2026,10/07/2026,1,1,1,1',
].join("\n");

describe("importação de planilha", () => {
  const dados = lerCsv(csv);
  const mapa = sugerirMapa(dados[2]);

  it("monta o mapa pelos títulos, não pela posição", () => {
    expect(mapa).toMatchObject({ time: 0, nome: 1, inicio: 2, fim: 3, pts_sdd: 4, esforco_sdd: 5, ganho_sdd: 6, produtividade: 7 });
  });

  it("converte números brasileiros, percentuais e datas", () => {
    expect(numero("27,8")).toBe(27.8);
    expect(numero("1.234,5")).toBe(1234.5);
    expect(fracao("32%")).toBeCloseTo(0.32);
    expect(fracao("0,21")).toBeCloseTo(0.21);
    expect(fracao("95")).toBeCloseTo(0.95);
    expect(data("02/06/2026")).toBe("2026-06-02");
  });

  it("gera as linhas e avisa as que não reconhece", () => {
    const r = montarLinhas(dados, 3, mapa, { tipo: "sprint", duracaoDias: 14 });
    expect(r.linhas).toHaveLength(2);
    expect(r.linhas[0]).toMatchObject({ time: "Desenrola", nome: "DSR 61 4ª.Q2.26", fim: "2026-06-02", pts_sdd: 27.8, produtividade: 0.95 });
    expect(r.linhas[1]).toMatchObject({ time: "Rematrix", ganho_sdd: 0.21 });
    expect(r.avisos[0].motivo).toContain("XYZ");
  });

  it("Kanban sem data de fim usa início + 7 dias", () => {
    const k = lerCsv("Time,Ciclo,Início\nFOL,FOL 8.Q3.26 24/08,22/08/2026");
    const r = montarLinhas(k, 1, sugerirMapa(k[0]), { tipo: "semana", duracaoDias: 7 });
    expect(r.linhas[0]).toMatchObject({ time: "Eficientes", frente: "Folha de Professores", fim: "2026-08-28" });
  });
});
