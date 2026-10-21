import { PERFIS } from "@/config/perfis";
import { Configuracoes } from "./Configuracoes";

export const metadata = { title: "Configurações — Metrificando" };

export default function Pagina() {
  return (
    <main>
      <p className="voltar"><a href="/">← Métricas da TAP</a></p>
      <h1>Configurações</h1>
      <p className="sub">Expediente e feriados definem o tempo útil (cycle time e resolução). Pessoas, alocações e ausências definem a capacidade dos times. Tudo tem vigência por data, então o histórico é preservado.</p>
      <Configuracoes times={PERFIS.map((p) => ({ time: p.time, frentes: p.frentes ?? [] }))} />
    </main>
  );
}
