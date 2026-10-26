"use client";
import type { Indicadores } from "@/lib/indicadores";
import { dataCurta, detalheContexto } from "@/lib/contexto";
import { segundaDaSemana } from "@/lib/indicadores";
import { Icone } from "../componentes/Icone";

export type LinhaAnalise = Indicadores & { frenteBloco: string; fase: string };

const num = (v?: number | null, c = 1) => (v == null ? "" : String(Math.round(v * 10 ** c) / 10 ** c).replace(".", ","));
const pct = (v?: number | null) => (v == null ? "" : `${Math.round(v * 1000) / 10}%`.replace(".", ","));
const TIPOS: Record<string, string> = { entrega: "História", tecnologia: "Tecnologia", bug: "Correção", operacional: "Operacional", ajuste: "Ajuste", outro: "Outro" };

type Col = { grupo: string; rotulo: string; v: (p: LinhaAnalise) => string; destaque?: (p: LinhaAnalise) => boolean; titulo?: (p: LinhaAnalise) => string };

function colunas(ls: LinhaAnalise[]): Col[] {
  const chaves = (c: "porPlanejamento" | "porTipo" | "porRoadmap") => [...new Set(ls.flatMap((p) => Object.keys(p[c])))];
  const temSemTl = ls.some((p) => p.pctItensTl != null || p.pctPtsTl != null);
  const tl = (p: LinhaAnalise) => (p.pctItensTl ?? 0) >= 0.3 || (p.pctPtsTl ?? 0) >= 0.3;
  const ctx = (p: LinhaAnalise) => !!p.contexto && (p.contexto.feriados.length > 0 || p.contexto.ausencias.length > 0);
  return [
    { grupo: "Período", rotulo: "Período", v: (p) => (p.periodo.rotulo ?? (p.periodo.tipo === "semana" ? dataCurta(segundaDaSemana(p.periodo.inicio)) : p.periodo.nome ?? "")) },
    { grupo: "Período", rotulo: "Início", v: (p) => dataCurta(p.periodo.inicio.slice(0, 10)) },
    { grupo: "Período", rotulo: "Fim", v: (p) => dataCurta(p.periodo.fim.slice(0, 10)) },
    { grupo: "Período", rotulo: "Frente", v: (p) => p.frenteBloco || p.periodo.frente || "" },
    { grupo: "Período", rotulo: "Metodologia", v: (p) => (p.fase === "scrum" ? "Scrum" : "Kanban") },
    { grupo: "Período", rotulo: "Fonte", v: (p) => (p.historico ? "Planilha" : "Jira") },
    { grupo: "Entrega", rotulo: "Entrega %", v: (p) => pct(p.entrega) },
    { grupo: "Entrega", rotulo: "Extras %", v: (p) => pct(p.extras) },
    { grupo: "Entrega", rotulo: "Itens", v: (p) => num(p.itensEntregues) },
    { grupo: "Entrega", rotulo: "Pts COM SDD", v: (p) => num(p.ptsSdd) },
    { grupo: "Entrega", rotulo: "Pts SEM SDD", v: (p) => num(p.ptsSemSdd) },
    { grupo: "Entrega", rotulo: "Esforço COM SDD", v: (p) => num(p.esforcoSdd) },
    { grupo: "Entrega", rotulo: "Ganho SDD", v: (p) => pct(p.ganhoSdd) },
    { grupo: "Entrega", rotulo: "Capacidade (dias-dev)", v: (p) => num(p.capacidade) },
    ...(temSemTl ? [
      { grupo: "Entrega", rotulo: "TL itens %", v: (p: LinhaAnalise) => pct(p.pctItensTl), destaque: tl },
      { grupo: "Entrega", rotulo: "TL pontos %", v: (p: LinhaAnalise) => pct(p.pctPtsTl), destaque: tl },
    ] : []),
    { grupo: "Fluxo", rotulo: "Ciclo P50 (d)", v: (p) => `${num(p.cycleP50, 2)}${p.cycleP50EhMedia ? "*" : ""}`, titulo: (p) => (p.cycleP50EhMedia ? "Média: o histórico não tem P50" : "") },
    { grupo: "Fluxo", rotulo: "Ciclo P85 (d)", v: (p) => num(p.cycleP85, 2) },
    { grupo: "Fluxo", rotulo: "Ciclo médio (d)", v: (p) => num(p.cycleMedia, 2) },
    { grupo: "Fluxo", rotulo: "Ciclo P50 outra regra (d)", v: (p) => num(p.cycleP50Alt, 2) },
    { grupo: "Fluxo", rotulo: "Hora extra (h)", v: (p) => num(p.horaExtraH) },
    { grupo: "Fluxo", rotulo: "Itens c/ hora extra", v: (p) => num(p.itensHoraExtra) },
    ...chaves("porPlanejamento").map((k) => ({ grupo: "Planejamento (pts)", rotulo: k, v: (p: LinhaAnalise) => num(p.porPlanejamento[k]) })),
    ...chaves("porTipo").map((k) => ({ grupo: "Tipo (pts)", rotulo: TIPOS[k] ?? k, v: (p: LinhaAnalise) => num(p.porTipo[k]) })),
    ...chaves("porRoadmap").map((k) => ({ grupo: "Roadmap (pts)", rotulo: k, v: (p: LinhaAnalise) => num(p.porRoadmap[k]) })),
    { grupo: "Suporte", rotulo: "Chamados", v: (p) => num(p.chamados) },
    { grupo: "Suporte", rotulo: "N3", v: (p) => num(p.chamadosN3) },
    { grupo: "Suporte", rotulo: "Trabalho N3", v: (p) => num(p.trabalhoN3) },
    { grupo: "Suporte", rotulo: "Resolução P50 (d)", v: (p) => num(p.resolucaoP50, 2) },
    { grupo: "Moral", rotulo: "Produtividade", v: (p) => pct(p.produtividade) },
    { grupo: "Moral", rotulo: "Motivação", v: (p) => pct(p.motivacao) },
    { grupo: "Calendário", rotulo: "Dias úteis", v: (p) => num(p.contexto?.diasUteis), destaque: ctx },
    { grupo: "Calendário", rotulo: "Não úteis", v: (p) => num(p.contexto?.diasNaoUteis), destaque: ctx },
    { grupo: "Calendário", rotulo: "Feriados", v: (p) => p.contexto?.feriados.map((f) => `${dataCurta(f.data)} ${f.nome}`).join("; ") ?? "", destaque: ctx },
    { grupo: "Calendário", rotulo: "Férias, folgas e licenças", v: (p) => p.contexto?.ausencias.map((a) => `${a.pessoa}: ${a.tipo.toLowerCase()} ${dataCurta(a.de)}${a.de !== a.ate ? `–${dataCurta(a.ate)}` : ""}`).join("; ") ?? "", destaque: ctx },
  ];
}

export function Tabela({ linhas, nomeArquivo }: { linhas: LinhaAnalise[]; nomeArquivo: string }) {
  const cols = colunas(linhas);
  const grupos = cols.reduce<{ g: string; n: number }[]>((a, c) => { const u = a.at(-1); if (u?.g === c.grupo) u.n++; else a.push({ g: c.grupo, n: 1 }); return a; }, []);
  const exportar = () => {
    const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const csv = [cols.map((c) => esc(`${c.grupo} · ${c.rotulo}`)).join(";"), ...linhas.map((l) => cols.map((c) => esc(c.v(l))).join(";"))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = nomeArquivo; a.click(); URL.revokeObjectURL(a.href);
  };
  if (!linhas.length) return <section className="card"><p className="vazio">Nenhum período encontrado com esses filtros.</p></section>;
  return (
    <section className="card">
      <div className="barra-tabela">
        <span className="contagem">{linhas.length} período(s) · <span className="legenda-ctx">■</span> período com feriado ou ausência · <span className="legenda-tl">■</span> tech lead ≥ 30%</span>
        <button type="button" className="botao secundario" onClick={exportar}><Icone nome="importar" tamanho={16} /> Exportar CSV</button>
      </div>
      <div className="tabela-rolagem">
        <table className="analise">
          <thead>
            <tr>{grupos.map((g) => <th key={g.g} colSpan={g.n} className="grupo">{g.g}</th>)}</tr>
            <tr>{cols.map((c) => <th key={c.grupo + c.rotulo}>{c.rotulo}</th>)}</tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.periodo.periodo_id + l.frenteBloco}>
                {cols.map((c) => {
                  const d = c.destaque?.(l);
                  const cls = d ? (c.grupo === "Calendário" ? "ctx" : "tl") : "";
                  const titulo = c.titulo?.(l) || (c.grupo === "Calendário" ? detalheContexto(l.contexto).join("\n") : "");
                  return <td key={c.grupo + c.rotulo} className={cls} title={titulo || undefined}>{c.v(l)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
