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

describe("planilha da Retaguarda / Contas a Pagar", () => {
  const csv = [
    ",,,,,,,,,,,",
    ",,,,,,,,,,,",
    ",,,Informações da Sprint,,,,,,Avaliação do Squad,,",
    'Squad,Sprint,Início,Fim,Total de itens extras,Qtd Itens Concluídos,Itens concluídos sem suporte,Qtd Pontos Concluídos,Acréscimo (%),Eficiência Média (%),"Produtividade\nColetiva","Produtividade\nIndividual","Motivação\nColetiva","Motivação\nIndividual",Motivação',
    'X-Retaguarda,S107 25.Q4.3,04/11/2025,18/11/2025,5,58,40,"21,50","10,64%","82,69%","4,8","4,5","4,8","4,5","4,7"',
    'CF,S58 25.Q4.3,04/11/2025,18/11/2025,1,8,6,"7,50","5,56%","78,95%","4,8","4,6","4,6","4,6","4,6"',
    ",,,,,,,,,,,,,,",
  ].join("\n");
  const d = lerCsv(csv);
  it("detecta o cabeçalho na linha 4 e mapeia as colunas certas", async () => {
    const { detectarCabecalho } = await import("../src/lib/importacao");
    const lt = detectarCabecalho(d);
    expect(lt).toBe(4);
    const r = montarLinhas(d, lt, sugerirMapa(d[lt - 1]), { tipo: "sprint", duracaoDias: 14 });
    expect(r.avisos).toEqual([]);
    expect(r.linhas[0]).toMatchObject({ time: "Retaguarda", frente: "X-Retaguarda", itens_entregues: 40, pts_sdd: 21.5 });
    expect(r.linhas[0].entrega).toBeCloseTo(0.8269);
    expect(r.linhas[0].extras).toBeCloseTo(0.1064);
    // (4,8 + 4,5) / 2 / 5 = 93%
    expect(r.linhas[0].produtividade).toBeCloseTo(0.93);
    expect(r.linhas[0].motivacao).toBeCloseTo(0.93);
    expect(r.linhas[1]).toMatchObject({ time: "Contas a Pagar", frente: "" });
    // CF: "sem suporte" = 8 − 15 = −7 na planilha → usa o total de concluídos
    expect(montarLinhas(lerCsv(csv.replace(',8,6,', ',8,-7,')), 4, sugerirMapa(d[3]), { tipo: "sprint", duracaoDias: 14 }).linhas[1].itens_entregues).toBe(8);
    expect(r.linhas[1].produtividade).toBeCloseTo(0.94);
  });
});

describe("tempo de ciclo da planilha", async () => {
  const { unidadeCiclo } = await import("../src/lib/importacao");
  it("horas úteis viram dias úteis (÷ 9,8)", () => {
    const d = lerCsv("Squad,Sprint,Fim,Tempo do Ciclo\nRetaguarda,S86,21/11/2025,\"220,01\"\nX-Retaguarda,S107,18/11/2025,\"73,85\"");
    const r = montarLinhas(d, 1, sugerirMapa(d[0]), { tipo: "sprint", duracaoDias: 14 });
    expect(r.unidadeCiclo).toBe("horas");
    expect(r.linhas[0].cycle_p50).toBeCloseTo(22.45, 1);
    expect(r.linhas[1].cycle_p50).toBeCloseTo(7.54, 1);
  });
  it("valores pequenos já são dias", () => expect(unidadeCiclo([2.3, 4.1, 5])).toBe("dias"));
});

describe("composição (tipo, planejamento, roadmap)", async () => {
  const { indicadoresDoHistorico } = await import("../src/lib/indicadores");
  const csv = [
    "Squad,Sprint,Fim,Qtd Pontos Concluídos Planejados,Qtd Pontos Concluídos Extras,Qtd Pontos Concluídos Bônus,Qtd Pontos Concluídos História,Qtd Pontos Concluídos Tecnologia,Qtd Pontos Concluídos Bug,Grandes entregas concluídos,Pequenas entregas concluídos,Evolução técnica concluídos,Suporte/rotina concluídos",
    'DSR,DSR 61,02/06/2026,"20,5",5,2,"18,5",6,3,4,3,1,2',
  ].join("\n");
  const d = lerCsv(csv);
  const m = sugerirMapa(d[0]);
  it("reconhece as colunas de composição pelo título", () => {
    expect(m).toMatchObject({ plan_planejado_pts: 3, plan_extra_pts: 4, plan_bonus_pts: 5, tipo_historia_pts: 6, tipo_tecnologia_pts: 7, tipo_correcao_pts: 8,
      rm_grandes_itens: 9, rm_pequenas_itens: 10, rm_evolucao_itens: 11, rm_suporte_rotina_itens: 12 });
  });
  it("o deck usa pontos quando houver e itens como reserva", () => {
    const l = montarLinhas(d, 1, m, { tipo: "sprint", duracaoDias: 14 }).linhas[0];
    const ind = indicadoresDoHistorico({ ...l, inicio: null, frente: "" } as never);
    expect(ind.porPlanejamento).toEqual({ Planejado: 20.5, Extra: 5, "Bônus": 2 });
    expect(ind.porTipo).toMatchObject({ entrega: 18.5, tecnologia: 6, bug: 3 });
    expect(ind.porRoadmap).toEqual({ "Grandes entregas": 4, "Pequenas entregas": 3, "Evolução técnica": 1, "Suporte/rotina": 2 });
    expect(ind.medidaComposicao).toEqual({ porPlanejamento: "pontos", porTipo: "pontos", porRoadmap: "itens" });
  });
});

describe("planilha Kanban (resumo semanal)", () => {
  const cab = ["Semana início", "Semana", "Time", "Itens", "Média útil (h)", "P85 útil (h)", "P85 útil (dias)", "Story Points", "Story points sem SDD", "Ganho SDD"];
  const dados = [cab,
    ["29/06/2026", "27/06–03/07/2026", "EFC total", "15", "41,8", "68,56", "6,9964", "22", "46", "187,50%"],
    ["29/06/2026", "27/06–03/07/2026", "EFC – Pedagógico", "7", "55,8", "82,08", "8,3755", "13", "39", "200,00%"],
    ["29/06/2026", "27/06–03/07/2026", "IC (Rematrix)", "2", "13,5", "18,07", "1,8442", "6", "11", "83,33%"],
    ["28/12/2026", "26/12–01/01/2027", "IC (Rematrix)", "3", "1", "1", "1", "1", "1", "0%"]];
  it("reconhece colunas, times e a janela sábado–sexta", () => {
    const mapa = sugerirMapa(cab);
    expect(mapa.cycle_p85).toBe(6);
    expect(mapa.itens_entregues).toBe(3);
    expect(mapa.pts_sdd).toBe(7);
    expect(mapa.pts_sem_sdd).toBe(8);
    const r = montarLinhas(dados, 1, mapa, { tipo: "semana", duracaoDias: 7, unidadeCiclo: "auto" });
    expect(r.avisos).toEqual([]);
    expect(r.linhas[0]).toMatchObject({ time: "Eficientes", frente: "", inicio: "2026-06-27", fim: "2026-07-03", itens_entregues: 15, pts_sdd: 22 });
    expect(r.linhas[1]).toMatchObject({ time: "Eficientes", frente: "Pedagógico" });
    expect(r.linhas[2]).toMatchObject({ time: "Rematrix", cycle_p85: 1.8442 });
    expect(r.linhas[3]).toMatchObject({ inicio: "2026-12-26", fim: "2027-01-01" });
  });
});

describe("planilha Kanban: padrão/urgente e tech lead", () => {
  it("reconhece as colunas", () => {
    const m = sugerirMapa(["Semana", "Time", "Pontos padrão", "Itens urgentes", "% itens tech lead", "% pontos tech lead", "Itens História"]);
    expect(m.plan_padrao_pts).toBe(2);
    expect(m.plan_urgente_itens).toBe(3);
    expect(m.pct_itens_tl).toBe(4);
    expect(m.pct_pts_tl).toBe(5);
    expect(m.tipo_historia_itens).toBe(6);
  });
});
