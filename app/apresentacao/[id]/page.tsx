import { notFound } from "next/navigation";
import { lerDeckSalvo } from "@/lib/decks";
import { renderizarDeck } from "../conteudo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sync de Agilidade — Metrificando" };

// Deck salvo pelo assistente: a URL leva só o id; os parâmetros ficam no banco.
export default async function DeckSalvo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const p = await lerDeckSalvo(id);
  if (!p) notFound();
  const { imprimir } = await searchParams;
  return renderizarDeck({ ...p, imprimir }, `/?deck=${id}`);
}
