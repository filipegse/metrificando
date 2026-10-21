"use client";
// Navegação do modo apresentação: um slide 1280×720 por vez, escalado para a tela.
// ← → / PageUp PageDown / espaço navegam; F tela cheia; P imprime (PDF, um slide por página).
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export function Deck({ children }: { children: ReactNode }) {
  const slides = Children.toArray(children);
  const [i, setI] = useState(0);
  const [escala, setEscala] = useState(1);
  const palco = useRef<HTMLDivElement>(null);

  const ir = useCallback((n: number) => setI((a) => Math.max(0, Math.min(slides.length - 1, a + n))), [slides.length]);

  useEffect(() => {
    const h = Number(location.hash.slice(1));
    if (h > 0) setI(Math.min(h - 1, slides.length - 1));
  }, [slides.length]);
  useEffect(() => { history.replaceState(null, "", `#${i + 1}`); }, [i]);

  useEffect(() => {
    const ajustar = () => setEscala(Math.min(window.innerWidth / 1280, (window.innerHeight - 40) / 720));
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); ir(1); }
      else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); ir(-1); }
      else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(slides.length - 1);
      else if (e.key === "f") document.documentElement.requestFullscreen?.();
      else if (e.key === "p") window.print();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [ir, slides.length]);

  return (
    <div className="deck">
      <div className="palco" ref={palco}>
        {slides.map((s, k) => (
          <div key={k} className={`moldura ${k === i ? "ativo" : ""}`} style={{ transform: `scale(${escala})` }}>
            {s}
            {k > 0 && <span className="numero">{k + 1}</span>}
          </div>
        ))}
      </div>
      <nav className="controles">
        <button onClick={() => ir(-1)} aria-label="Slide anterior">‹</button>
        <span>{i + 1} / {slides.length}</span>
        <button onClick={() => ir(1)} aria-label="Próximo slide">›</button>
        <span className="dica">← → navegar · F tela cheia · P imprimir/PDF</span>
      </nav>
      <div className="progresso" style={{ width: `${((i + 1) / slides.length) * 100}%` }} />
    </div>
  );
}
