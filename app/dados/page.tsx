import { PERFIS } from "@/config/perfis";
import { EditorDados } from "./EditorDados";

export const metadata = { title: "Dados históricos — Metrificando" };

export default async function Pagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  return (
    <main className="largo">
      <p className="voltar"><a href="/">← Métricas da TAP</a></p>
      <h1>Dados históricos</h1>
      <p className="sub">Períodos importados das planilhas, por time. Edite as células e salve a linha. Toda alteração fica registrada com quem fez, o antes e o depois, e pode ser desfeita.</p>
      <EditorDados times={PERFIS.map((p) => ({ time: p.time, frentes: p.frentes ?? [] }))} inicial={q.time} />
    </main>
  );
}
