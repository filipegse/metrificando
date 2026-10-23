import { renderizarDeck } from "./conteudo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sync de Agilidade — Metrificando" };

// Formato antigo, com os parâmetros na URL (continua funcionando para links já salvos).
export default async function Apresentacao({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return renderizarDeck(await searchParams);
}
