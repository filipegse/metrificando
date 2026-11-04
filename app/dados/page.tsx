import { redirect } from "next/navigation";

// Dados históricos agora é uma aba de Configurações; o endereço antigo continua funcionando.
export default async function Pagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { time } = await searchParams;
  redirect(`/configuracoes?aba=dados${time ? `&time=${encodeURIComponent(time)}` : ""}`);
}
