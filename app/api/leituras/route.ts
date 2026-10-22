import { db } from "@/lib/db";

// Dados mudam a cada gravação: nunca servir resposta em cache (navegador, CDN ou Next).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const { deck, time, slide, texto } = await req.json();
  if (![deck, time, slide].every((v) => typeof v === "string" && v) || typeof texto !== "string") {
    return Response.json({ erro: "deck, time, slide e texto são obrigatórios" }, { status: 400 });
  }
  await db()`
    insert into leituras (deck, time, slide, texto) values (${deck}, ${time}, ${slide}, ${texto})
    on conflict (deck, time, slide) do update set texto = excluded.texto, atualizado_em = now()`;
  return Response.json({ ok: true });
}
