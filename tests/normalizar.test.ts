import { describe, expect, it } from "vitest";
import { perfilPorProjeto } from "../src/config/perfis";
import { normalizarDelivery, normalizarSuporte } from "../src/lib/normalizar";
import { issue } from "./fixtures";

const dsr = perfilPorProjeto("DSR")!;
const trg = perfilPorProjeto("TRG")!;
const efc = perfilPorProjeto("EFC")!;
const ic = perfilPorProjeto("IC")!;

describe("delivery", () => {
  it("exclui Épico, Subtarefa e Suporte", () => {
    expect(normalizarDelivery(issue("DSR-1", "Épico", "Concluído", []), dsr)).toBeNull();
    expect(normalizarDelivery(issue("DSR-2", "Subtarefa", "Concluído", []), dsr)).toBeNull();
    expect(normalizarDelivery(issue("TRG-1", "Suporte", "Concluído", []), trg)).toBeNull();
  });

  it("respeita o subconjunto de tipos do TRG", () => {
    expect(normalizarDelivery(issue("TRG-2", "Correção", "Concluído", []), trg)).toBeNull();
    expect(normalizarDelivery(issue("TRG-3", "História", "Concluído", []), trg)).not.toBeNull();
  });

  it("calcula cycle time aceitando etapa pulada (TRG: validação → Concluído)", () => {
    const i = normalizarDelivery(issue("TRG-4", "História", "Concluído", [
      ["2026-10-01T10:00:00.000-0300", "Backlog", "Em progresso"],
      ["2026-10-03T10:00:00.000-0300", "Em progresso", "Liberado para validação"],
      ["2026-10-05T10:00:00.000-0300", "Liberado para validação", "Concluído"],
    ]), trg)!;
    expect(i.entregue).toBe(true);
    expect(i.cycleTimeDias).toBe(4);
  });

  it("lê a frente pelo campo do perfil", () => {
    const i = normalizarDelivery(issue("EFC-1", "História", "Concluído", [], { customfield_12590: { value: "Pedagógico" } }), efc)!;
    expect(i.frente).toBe("Pedagógico");
  });
});

describe("suporte", () => {
  const sc = ic.suporte.find((f) => f.projeto === "SC")!;
  const sis = ic.suporte.find((f) => f.projeto === "SIS")!;

  it("resolução conta na entrada em Resolvido, não em Fechado com êxito", () => {
    const s = normalizarSuporte(issue("SC-1", "Suporte", "Fechado com êxito", [
      ["2026-10-02T12:00:00.000-0300", "Aberto", "Em atendimento"],
      ["2026-10-03T12:00:00.000-0300", "Em atendimento", "Resolvido"],
      ["2026-10-06T12:00:00.000-0300", "Resolvido", "Fechado com êxito"],
    ]), ic, sc)!;
    expect(s.resolvidoEm.toISOString()).toBe("2026-10-03T15:00:00.000Z");
    expect(s.tempoResolucaoDias).toBe(2);
    expect(s.nivel).toBe("N2");
  });

  it("N3 = passou pelo status Enviado para N3", () => {
    const s = normalizarSuporte(issue("SC-2", "Suporte", "Resolvido", [
      ["2026-10-02T12:00:00.000-0300", "Em atendimento", "Enviado para N3"],
      ["2026-10-04T12:00:00.000-0300", "Enviado para N3", "Resolvido"],
    ]), ic, sc)!;
    expect(s.nivel).toBe("N3");
  });

  it("chamado sem resolução não entra", () => {
    expect(normalizarSuporte(issue("SC-3", "Suporte", "Em atendimento", []), ic, sc)).toBeNull();
  });

  it("SIS é trabalho N3 e não soma no volume de chamados", () => {
    const s = normalizarSuporte(issue("SIS-1", "Suporte", "Concluído", [
      ["2026-10-04T12:00:00.000-0300", "Liberado para validação", "Concluído"],
    ]), ic, sis)!;
    expect(s.papel).toBe("trabalho_n3");
    expect(s.nivel).toBe("N3");
  });
});
