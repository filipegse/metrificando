import { describe, expect, it } from "vitest";
import { boardsDoProjeto, sprintsDoBoard } from "../src/lib/jira";

describe("boardsDoProjeto", () => {
  it("descarta boards de outro projeto que só incluem o projeto no filtro", () => {
    const boards = [{ id: 1, location: { projectKey: "SCOPS" } }, { id: 2, location: { projectKey: "NXS" } }, { id: 3 }];
    expect(boardsDoProjeto(boards, "SCOPS").map((b) => b.id)).toEqual([1]);
  });
});

describe("sprintsDoBoard", () => {
  it("mantém só as sprints criadas no próprio board", () => {
    const sprints = [
      { id: 10, name: "SCOPS 50", originBoardId: 1 },
      { id: 20, name: "NXS 34 2a.Q4.26 20/10~02/11", originBoardId: 2 },
      { id: 30, name: "Sem origem" },
    ];
    expect(sprintsDoBoard(sprints, 1).map((s) => s.name)).toEqual(["SCOPS 50"]);
  });
});
