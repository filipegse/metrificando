"use client";
// Menu lateral comum a todas as telas (a apresentação cobre a tela inteira e não o mostra).
import { usePathname } from "next/navigation";
import { Icone, type NomeIcone } from "./Icone";

const ITENS: { href: string; rotulo: string; icone: NomeIcone }[] = [
  { href: "/", rotulo: "Times e apresentação", icone: "apresentacao" },
  { href: "/analise", rotulo: "Análise", icone: "analise" },
  { href: "/engenharia", rotulo: "Engenharia", icone: "relogio" },
  { href: "/configuracoes", rotulo: "Configurações", icone: "config" },
];

export function Cabecalho() {
  const caminho = usePathname();
  if (caminho?.startsWith("/apresentacao")) return null;
  return (
    <aside className="lateral">
      <a href="/" className="marca-app" aria-label="Metrificando · TAP">
        <span className="sinal-app" aria-hidden />
        <span><b>Metrificando</b><small>Área TAP · Grupo Salta</small></span>
      </a>
      <nav className="menu" aria-label="Principal">
        {ITENS.map((i) => {
          const ativo = i.href === "/" ? caminho === "/" : caminho?.startsWith(i.href);
          return (
            <a key={i.href} href={i.href} className={ativo ? "ativo" : ""} aria-current={ativo ? "page" : undefined}>
              <Icone nome={i.icone} /> <span>{i.rotulo}</span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
