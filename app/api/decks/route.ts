import { salvarDeck } from "@/lib/decks";
import { urlBanco } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Só chaves conhecidas do deck: trimestre, times, slides e recortes por time (s_/de_/ate_/f_/g_ + sigla).
const CHAVE = /^(trimestre|times|slides|demo|(s|de|ate|f|g)_[A-Z0-9]+)$/;

export async function POST(req: Request) {
  if (!urlBanco()) return Response.json({ erro: "sem banco" }, { status: 503 });
  const corpo = await req.json().catch(() => null);
  const p = corpo?.parametros;
  if (!p || typeof p !== "object") return Response.json({ erro: "parametros obrigatório" }, { status: 400 });
  const limpos = Object.fromEntries(Object.entries(p).filter(([k, v]) => CHAVE.test(k) && typeof v === "string" && v.length < 4000)) as Record<string, string>;
  if (!limpos.times) return Response.json({ erro: "times obrigatório" }, { status: 400 });
  return Response.json({ id: await salvarDeck(limpos) });
}
