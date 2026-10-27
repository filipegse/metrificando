// Background Function (até 15 min): coleta os PRs do GitHub e grava em itens_pr.
// Corpo: { dias?: number } (padrão 8) ou { reatribuir: true } para só recalcular a atribuição.
import { registrarColeta } from "../../src/lib/coleta";
import { coletarGithub, reatribuir } from "../../src/lib/github";

export default async (req: Request) => {
  if (req.headers.get("x-webhook-token") !== process.env.WEBHOOK_TOKEN) return;
  const corpo = (await req.json().catch(() => ({}))) as { dias?: number; reatribuir?: boolean };
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    if (corpo.reatribuir) {
      await registrarColeta("github_reatribuir", "GitHub", hoje, "ok", `prs=${await reatribuir()}`);
      return;
    }
    const r = await coletarGithub(Math.min(Math.max(Number(corpo.dias) || 8, 1), 365));
    await registrarColeta("github", "GitHub", hoje, "ok", `repos=${r.repos} prs=${r.prs} nao_atribuidos=${r.naoAtribuidos}`);
  } catch (erro) {
    await registrarColeta("github", "GitHub", hoje, "erro", String(erro));
    throw erro;
  }
};
