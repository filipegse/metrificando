// Recebe a Jira Automation (sprint concluída / agendada semanal), responde 202 e delega a coleta.
import type { Config } from "@netlify/functions";
import { perfilPorProjeto } from "../../src/config/perfis";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405 });
  if (!process.env.WEBHOOK_TOKEN || req.headers.get("x-webhook-token") !== process.env.WEBHOOK_TOKEN) {
    return new Response("Não autorizado", { status: 401 });
  }
  const corpo = await req.json().catch(() => null);
  if (!corpo?.evento || !perfilPorProjeto(corpo.projeto)) {
    return new Response("Payload inválido ou projeto sem perfil", { status: 400 });
  }
  await fetch(new URL("/.netlify/functions/coleta-background", req.url), {
    method: "POST",
    headers: { "content-type": "application/json", "x-webhook-token": process.env.WEBHOOK_TOKEN },
    body: JSON.stringify(corpo),
  });
  return new Response(JSON.stringify({ aceito: true }), { status: 202, headers: { "content-type": "application/json" } });
};

export const config: Config = { path: "/api/webhooks/jira" };
