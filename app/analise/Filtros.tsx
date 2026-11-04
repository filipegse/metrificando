"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SelecaoEtiquetas } from "../componentes/SelecaoEtiquetas";

type Time = { projeto: string; time: string; frentes: string[]; scrum: boolean };
type Atual = { time: string; frente: string; de: string; ate: string; g: string; s: string[] };

const AGRUP: [string, string][] = [["periodo", "Por sprint/semana"], ["quinzena", "Quinzenal"], ["mes", "Mensal"], ["trimestre", "Trimestral"]];

export function Filtros({ times, atual, sprints }: { times: Time[]; atual: Atual; sprints: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [f, setF] = useState(atual);
  const time = times.find((t) => t.projeto === f.time)!;
  const aplicar = (n: Atual) => {
    setF(n);
    const q = new URLSearchParams({ time: n.time, de: n.de, ate: n.ate, g: n.g });
    if (n.frente) q.set("frente", n.frente);
    if (n.s.length) q.set("s", n.s.join(","));
    router.push(`/analise?${q}`);
  };
  return (
    <section className="barra filtros-analise">
      <label>Time
        <select value={f.time} onChange={(e) => aplicar({ ...f, time: e.target.value, frente: "", s: [] })}>
          {times.map((t) => <option key={t.projeto} value={t.projeto}>{t.time}</option>)}
        </select>
      </label>
      {time.frentes.length > 0 && (
        <label>Frente
          <select value={f.frente} onChange={(e) => aplicar({ ...f, frente: e.target.value, s: [] })}>
            <option value="">{time.projeto === "TRG" ? "Todas" : "Time inteiro"}</option>
            {time.frentes.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      )}
      <label>De <input type="date" value={f.de} disabled={f.s.length > 0} onChange={(e) => aplicar({ ...f, de: e.target.value })} /></label>
      <label>Até <input type="date" value={f.ate} min={f.de} disabled={f.s.length > 0} onChange={(e) => aplicar({ ...f, ate: e.target.value })} /></label>
      <label>Agrupamento
        <select value={f.g} onChange={(e) => aplicar({ ...f, g: e.target.value })}>
          {AGRUP.filter(([v]) => !(time.scrum && v === "quinzena")).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </label>
      {sprints.length > 0 && (
        <SelecaoEtiquetas rotulo="Sprints/Semana" vazio="Todas do período (De/Até)"
          opcoes={sprints.map((s) => ({ valor: s.id, rotulo: s.nome }))} valor={f.s}
          onAplicar={(s) => aplicar({ ...f, s })} />
      )}
    </section>
  );
}
