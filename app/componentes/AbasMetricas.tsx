"use client";
// Abas da área Métricas. Cada aba é uma rota própria (dados carregados no servidor), então as abas são links.
import { usePathname } from "next/navigation";
import { Icone, type NomeIcone } from "./Icone";

export const ABAS_METRICAS: { href: string; rotulo: string; icone: NomeIcone }[] = [
  { href: "/", rotulo: "Times e apresentação", icone: "apresentacao" },
  { href: "/analise", rotulo: "Análise", icone: "analise" },
  { href: "/engenharia", rotulo: "Engenharia", icone: "relogio" },
];

export function AbasMetricas() {
  const caminho = usePathname();
  return (
    <nav className="abas abas-pagina" aria-label="Métricas">
      {ABAS_METRICAS.map((a) => {
        const ativa = a.href === "/" ? caminho === "/" : caminho?.startsWith(a.href);
        return (
          <a key={a.href} href={a.href} className={ativa ? "ativa" : ""} aria-current={ativa ? "page" : undefined}>
            <Icone nome={a.icone} tamanho={16} /> {a.rotulo}
          </a>
        );
      })}
    </nav>
  );
}
