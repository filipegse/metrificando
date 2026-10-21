import { describe, expect, it } from "vitest";
import { diferencas, usuarioDe } from "../src/lib/historico";

describe("auditoria do histórico", () => {
  it("registra só os campos que mudaram", () => {
    const antes = { time: "Retaguarda", frente: "Retaguarda", nome: "Sprint 109", pts_sdd: 30, entrega: 0.9, fim: "2026-10-12" };
    expect(diferencas(antes, { ...antes, pts_sdd: 32 })).toEqual({ pts_sdd: [30, 32] });
    expect(diferencas(null, antes)).toMatchObject({ nome: [null, "Sprint 109"], pts_sdd: [null, 30] });
  });
  it("identifica o usuário pelo nome informado e pelo login da aplicação", () => {
    const req = new Request("http://x", { headers: { authorization: "Basic " + btoa("tap:segredo") } });
    expect(usuarioDe(req, "Filipe")).toBe("Filipe · login: tap");
    expect(usuarioDe(new Request("http://x"), "")).toBe("não identificado");
  });
});
