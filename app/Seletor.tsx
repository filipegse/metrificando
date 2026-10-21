"use client";
// Seleção dos times que entram no deck da Sync. O cartão inteiro é clicável.
import { useState, type ReactNode } from "react";

type Cartao = { projeto: string; time: string; conteudo: ReactNode };

export function Seletor({ cartoes, trimestres }: { cartoes: Cartao[]; trimestres: string[] }) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [trimestre, setTrimestre] = useState(trimestres[0]);
  const alternar = (p: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      n.has(p) ? n.delete(p) : n.add(p);
      return n;
    });
  const todos = marcados.size === cartoes.length;
  // Mantém a ordem dos cartões, que é a ordem dos times no deck.
  const selecionados = cartoes.filter((c) => marcados.has(c.projeto));
  const destino = `/apresentacao?trimestre=${trimestre}&times=${selecionados.map((c) => c.projeto).join(",")}`;

  return (
    <>
      <div className="barra">
        <label>
          Trimestre{" "}
          <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)}>
            {trimestres.map((t) => <option key={t} value={t}>{t.replace(/^(\d{4})-Q(\d)$/, "Q$2 $1")}</option>)}
          </select>
        </label>
        <button type="button" className="link" onClick={() => setMarcados(todos ? new Set() : new Set(cartoes.map((c) => c.projeto)))}>
          {todos ? "Limpar seleção" : "Selecionar todos"}
        </button>
        <span className="contagem">{selecionados.length ? `${selecionados.length} time(s): ${selecionados.map((c) => c.time).join(", ")}` : "Selecione os times do deck"}</span>
        <a className={`botao ${selecionados.length ? "" : "desativado"}`} href={selecionados.length ? destino : undefined} aria-disabled={!selecionados.length}>
          Gerar apresentação →
        </a>
      </div>
      <div className="grid">
        {cartoes.map((c) => {
          const ativo = marcados.has(c.projeto);
          return (
            <section key={c.projeto} className={`card selecionavel ${ativo ? "ativo" : ""}`} role="checkbox" aria-checked={ativo} tabIndex={0}
              onClick={() => alternar(c.projeto)} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); alternar(c.projeto); } }}>
              <span className="marcador" aria-hidden>{ativo ? "✓" : ""}</span>
              {c.conteudo}
            </section>
          );
        })}
      </div>
    </>
  );
}
