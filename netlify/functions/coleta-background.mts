// Background Function (até 15 min): faz a coleta no Jira e grava no banco.
import { coletar, registrarColeta, type Evento } from "../../src/lib/coleta";

export default async (req: Request) => {
  if (req.headers.get("x-webhook-token") !== process.env.WEBHOOK_TOKEN) return;
  const evento = (await req.json()) as Evento;
  const periodo = evento.evento === "sprint_concluida" ? evento.sprint_id : "semana";
  try {
    const r = await coletar(evento);
    await registrarColeta(evento.evento, r.time, r.periodoId, "ok", `delivery=${r.delivery} suporte=${r.suporte}`);
  } catch (erro) {
    await registrarColeta(evento.evento, evento.projeto, periodo, "erro", String(erro));
    throw erro;
  }
};
