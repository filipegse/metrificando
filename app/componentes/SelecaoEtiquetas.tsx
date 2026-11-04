"use client";
// Seleção múltipla em dropdown com etiquetas (no estilo dos campos de seleção do Jira).
// A escolha é aplicada ao fechar a lista ou ao remover uma etiqueta, para não recarregar a página a cada clique.
import { useEffect, useMemo, useRef, useState } from "react";

export type OpcaoEtiqueta = { valor: string; rotulo: string };

export function SelecaoEtiquetas({ rotulo, opcoes, valor, onAplicar, vazio = "Todas" }: {
  rotulo: string; opcoes: OpcaoEtiqueta[]; valor: string[]; onAplicar: (v: string[]) => void; vazio?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState<string[]>(valor);
  const [busca, setBusca] = useState("");
  const [cursor, setCursor] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const idLista = useMemo(() => `lista-${rotulo.replace(/\W+/g, "-").toLowerCase()}`, [rotulo]);

  useEffect(() => setSel(valor), [valor]);
  const porValor = useMemo(() => new Map(opcoes.map((o) => [o.valor, o])), [opcoes]);
  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return t ? opcoes.filter((o) => o.rotulo.toLowerCase().includes(t)) : opcoes;
  }, [opcoes, busca]);

  const mudou = (a: string[]) => a.length !== valor.length || a.some((x) => !valor.includes(x));
  const fechar = (aplicarEscolha = true) => {
    setAberto(false); setBusca(""); setCursor(0);
    if (aplicarEscolha && mudou(sel)) onAplicar(sel);
    if (!aplicarEscolha) setSel(valor);
  };
  const alternar = (v: string) => setSel((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  const remover = (v: string) => { const n = sel.filter((x) => x !== v); setSel(n); if (!aberto) onAplicar(n); };

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) fechar(); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  });

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!aberto) setAberto(true); else setCursor((c) => Math.min(c + 1, filtradas.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (!aberto) setAberto(true); else if (filtradas[cursor]) alternar(filtradas[cursor].valor); }
    else if (e.key === "Escape") { if (aberto) { e.preventDefault(); fechar(false); } }
    else if (e.key === "Backspace" && !busca && sel.length) remover(sel[sel.length - 1]);
    else if (e.key === "Tab" && aberto) fechar();
  };

  return (
    <div className="selecao-etiquetas" ref={raiz}>
      <span className="rotulo-campo" id={`${idLista}-rotulo`}>{rotulo}</span>
      <div className={`se-caixa ${aberto ? "aberta" : ""}`} onClick={() => { setAberto(true); campo.current?.focus(); }}>
        <div className="se-valores">
          {sel.map((v) => (
            <span key={v} className="se-etiqueta">
              {porValor.get(v)?.rotulo ?? v}
              <button type="button" aria-label={`Remover ${porValor.get(v)?.rotulo ?? v}`} onClick={(e) => { e.stopPropagation(); remover(v); }}>×</button>
            </span>
          ))}
          <input ref={campo} role="combobox" aria-expanded={aberto} aria-controls={idLista} aria-labelledby={`${idLista}-rotulo`}
            aria-activedescendant={aberto && filtradas[cursor] ? `${idLista}-${cursor}` : undefined}
            value={busca} placeholder={sel.length ? "" : vazio} onChange={(e) => { setBusca(e.target.value); setCursor(0); setAberto(true); }}
            onFocus={() => setAberto(true)} onKeyDown={teclas} />
        </div>
        {sel.length > 0 && (
          <button type="button" className="se-limpar" aria-label="Limpar seleção" onClick={(e) => { e.stopPropagation(); setSel([]); if (!aberto) onAplicar([]); }}>×</button>
        )}
        <svg className="se-seta" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
      </div>
      {aberto && (
        <ul className="se-lista" id={idLista} role="listbox" aria-multiselectable>
          {filtradas.length === 0 && <li className="se-vazia">Nada encontrado</li>}
          {filtradas.map((o, i) => {
            const marcada = sel.includes(o.valor);
            return (
              <li key={o.valor} id={`${idLista}-${i}`} role="option" aria-selected={marcada}
                className={`${marcada ? "marcada" : ""} ${i === cursor ? "cursor" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); alternar(o.valor); }} onMouseEnter={() => setCursor(i)}>
                <span className="se-etiqueta">{o.rotulo}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
