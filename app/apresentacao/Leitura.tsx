"use client";
// Texto editável do slide (leitura do agilista). Salva ao sair do campo.
import { useState } from "react";

type Props = { deck: string; time: string; slide: string; inicial?: string; demo: boolean; placeholder?: string; className?: string };

export function Leitura({ deck, time, slide, inicial = "", demo, placeholder = "Clique para escrever a leitura…", className }: Props) {
  const [texto, setTexto] = useState(inicial);
  const [estado, setEstado] = useState<"" | "salvando" | "salvo" | "erro">("");

  async function salvar() {
    if (demo || texto === inicial) return;
    setEstado("salvando");
    const r = await fetch("/api/leituras", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ deck, time, slide, texto }),
    }).catch(() => null);
    setEstado(r?.ok ? "salvo" : "erro");
  }

  return (
    <div className={`leitura ${className ?? ""}`}>
      <textarea value={texto} placeholder={placeholder} onChange={(e) => setTexto(e.target.value)} onBlur={salvar}
        onKeyDown={(e) => e.stopPropagation()} rows={2} />
      {estado && <span className={`estado ${estado}`}>{estado === "salvando" ? "salvando…" : estado === "salvo" ? "salvo" : "erro ao salvar"}</span>}
    </div>
  );
}
