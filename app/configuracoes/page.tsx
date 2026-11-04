import { PERFIS } from "@/config/perfis";
import { Configuracoes } from "./Configuracoes";
import { ABAS, type Aba } from "./abas";

export const metadata = { title: "Configurações — Metrificando" };

export default async function Pagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const aba = (ABAS as readonly string[]).includes(q.aba ?? "") ? (q.aba as Aba) : "calendario";
  return (
    <main className="largo">
      <h1>Configurações</h1>
      <p className="sub">Expediente e feriados definem o tempo útil (cycle time e resolução). Pessoas, alocações e ausências definem a capacidade dos times. Importar histórico traz as planilhas em CSV; Dados históricos permite revisar e corrigir o que foi importado, com auditoria de cada alteração.</p>
      <Configuracoes times={PERFIS.map((p) => ({ time: p.time, frentes: p.frentes ?? [] }))} inicialAba={aba} inicialTime={q.time} />
    </main>
  );
}
