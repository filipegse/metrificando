import { describe, expect, it } from "vitest";
import { atribuir, chaveJira, indicadores, type AlocacaoLogin, type PR } from "../src/lib/github";

const aloc: AlocacaoLogin[] = [
  { login: "Barbara0609", time: "Nexus", frente: "", percentual: 1, inicio: "2026-01-01", fim: null },
  { login: "paafs", time: "Nexus", frente: "Integrações", percentual: 1, inicio: "2026-01-01", fim: null },
  { login: "troca", time: "Eficientes", frente: "", percentual: 1, inicio: "2026-01-01", fim: "2026-08-31" },
  { login: "troca", time: "Nexus", frente: "Avaliações", percentual: 1, inicio: "2026-09-01", fim: null },
];
const pr = (x: Partial<PR>): PR => ({
  repo: "r", numero: 1, autor: "x", titulo: "", head: "feature/x", base: "develop", estado: "closed", rascunho: false,
  criadoEm: "2026-10-01T12:00:00Z", mergedEm: null, fechadoEm: null, primeiraReviewEm: null, adicoes: null, delecoes: null, arquivos: null, ...x,
});

describe("chave do Jira", () => {
  it("só projetos da TAP, no branch ou no título", () => {
    expect(chaveJira("feature/NXS-9779-ajuste")).toBe("NXS-9779");
    expect(chaveJira("hotfix/x", "feat(efc-7045): x")).toBe("EFC-7045");
    expect(chaveJira("feature/CT-12-caso", "REG-3")).toBeNull();
  });
});

describe("atribuição", () => {
  it("chave do Jira manda; frente vem do autor se for do mesmo time", () => {
    expect(atribuir(pr({ autor: "paafs", head: "feature/NXS-1" }), aloc)).toMatchObject({ time: "Nexus", frente: "Integrações", origem: "jira" });
    expect(atribuir(pr({ autor: "paafs", head: "feature/EFC-1" }), aloc)).toMatchObject({ time: "Eficientes", frente: "", origem: "jira" });
  });
  it("sem chave, alocação vigente na data do merge (login sem diferenciar maiúsculas)", () => {
    expect(atribuir(pr({ autor: "barbara0609", head: "feature/qa-smoke" }), aloc)).toMatchObject({ time: "Nexus", origem: "login" });
    expect(atribuir(pr({ autor: "troca", mergedEm: "2026-08-20T10:00:00Z" }), aloc).time).toBe("Eficientes");
    expect(atribuir(pr({ autor: "troca", mergedEm: "2026-09-10T10:00:00Z" }), aloc)).toMatchObject({ time: "Nexus", frente: "Avaliações" });
    expect(atribuir(pr({ autor: "ninguem" }), aloc).origem).toBe("nao_atribuido");
  });
});

describe("indicadores", () => {
  it("release em master e production no mesmo dia conta um deploy; hotfix é falha", () => {
    const i = indicadores([
      pr({ head: "release/1", base: "master", mergedEm: "2026-10-02T15:00:00Z" }),
      pr({ head: "release/1", base: "production", mergedEm: "2026-10-02T16:00:00Z" }),
      pr({ head: "hotfix/NXS-2", base: "master", mergedEm: "2026-10-05T15:00:00Z" }),
      pr({ criadoEm: "2026-10-01T00:00:00Z", mergedEm: "2026-10-01T10:00:00Z", primeiraReviewEm: "2026-10-01T02:00:00Z", adicoes: 30, delecoes: 10 }),
      pr({ estado: "closed" }),
    ]);
    expect(i).toMatchObject({ deploys: 2, deploysHotfix: 1, taxaFalha: 0.5, prsMergeados: 1, leadTimeH: 10, primeiraReviewH: 2, tamanhoMediano: 40, fechadosSemMerge: 1 });
  });
});
