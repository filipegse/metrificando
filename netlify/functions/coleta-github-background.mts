// Background Function (até 15 min): coleta os PRs do GitHub e grava em itens_pr.
// Corpo: { dias?: number } (padrão 8) ou { reatribuir: true } para só recalcular a atribuição.
import { registrarColeta } from "../../src/lib/coleta";
import { coletarGithub, reatribuir } from "../../src/lib/github";

export default async (req: Request) => {
  if (!process.env.WEBHOOK_TOKEN || req.headers.get("x-webhook-token") !== process.env.WEBHOOK_TOKEN) {
    console.log("coleta-github-background: X-Webhook-Token ausente ou diferente de WEBHOOK_TOKEN; ignorado.");
    return;
  }
  const corpo = (await req.json().catch(() => ({}))) as { dias?: number; reatribuir?: boolean };
  console.log(`coleta-github-background: início ${JSON.stringify(corpo)}`);
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    if (corpo.reatribuir) {
      await registrarColeta("github_reatribuir", "GitHub", hoje, "ok", `prs=${await reatribuir()}`);
      return;
    }
    const r = await coletarGithub(Math.min(Math.max(Number(corpo.dias) || 8, 1), 365));
    console.log(`coleta-github-background: fim ${JSON.stringify(r)}`);
    await registrarColeta("github", "GitHub", hoje, "ok", `repos=${r.repos} prs=${r.prs} nao_atribuidos=${r.naoAtribuidos}`);
  } catch (erro) {
    console.error("coleta-github-background: erro", erro);
    await registrarColeta("github", "GitHub", hoje, "erro", String(erro));
    throw erro;
  }
};
