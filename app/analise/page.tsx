// Análise em tabela: todos os indicadores por período de um time, com filtros e exportação CSV.
// Visão por time e frente, nunca por pessoa (ausências aparecem só como contexto de disponibilidade).
import { PERFIS } from "@/config/perfis";
import { carregarDeck, deckDemo, trimestreAtual, type Recorte } from "@/lib/apresentacao";
import { db, urlBanco } from "@/lib/db";
import type { Agrupamento } from "@/lib/agrupamento";
import { Filtros } from "./Filtros";
import { Tabela, type LinhaAnalise } from "./Tabela";

export const dynamic = "force-dynamic";
export const metadata = { title: "Análise — Metrificando" };

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function Analise({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const perfil = PERFIS.find((p) => p.projeto === q.time) ?? PERFIS[0];
  const frentes = perfil.sprintsPorFrente?.map((f) => f.frente) ?? perfil.frentes ?? [];
  const frente = q.frente && frentes.includes(q.frente) ? q.frente : "";
  const hoje = new Date();
  const de = q.de ?? iso(new Date(Date.UTC(hoje.getUTCFullYear(), Math.floor(hoje.getUTCMonth() / 3) * 3 - 3, 1)));
  const ate = q.ate ?? iso(hoje);
  const agrup = (["periodo", "quinzena", "mes", "trimestre"].includes(q.g ?? "") ? q.g : "periodo") as Agrupamento;
  const sprintsSel = q.s ? q.s.split(",").filter(Boolean) : [];

  const demo = !urlBanco();
  const sprints = demo ? [] : ((await db()`
    select periodo_id as id, coalesce(nome, periodo_id) as nome, frente, fim::text from periodos where time = ${perfil.time} and tipo = 'sprint'
    union all select 'h:' || nome, nome, frente, fim::text from historico_periodos where time = ${perfil.time} and tipo = 'sprint'
    order by fim desc limit 300`) as { id: string; nome: string; frente: string; fim: string }[])
    .filter((s) => !frente || !perfil.sprintsPorFrente || s.frente === frente);

  const recorte: Recorte = {
    ...(sprintsSel.length ? { sprints: sprintsSel } : { de, ate }),
    ...(frente ? { porFrente: true, frentes: [frente] } : {}),
    agrupamento: agrup,
  };
  const d = demo ? deckDemo(trimestreAtual(), [perfil.projeto], { [perfil.projeto]: recorte })
    : await carregarDeck(trimestreAtual(), [perfil.projeto], { [perfil.projeto]: recorte });
  // TRG sem frente escolhida traz um bloco por frente: a tabela junta tudo, com a coluna Frente.
  const linhas: LinhaAnalise[] = d.times.flatMap((t) => t.periodos.map((p) => ({ ...p, frenteBloco: t.frente ?? "", fase: t.fase ?? t.perfil.metodologia })));

  return (
    <main className="largo">
      <h1>Análise em tabela</h1>
      <p className="sub">Todos os indicadores por período, com feriados, dias não úteis e ausências do time como contexto. Visão por time e frente, nunca por pessoa.</p>
      <Filtros
        times={PERFIS.map((p) => ({ projeto: p.projeto, time: p.time, frentes: p.sprintsPorFrente?.map((f) => f.frente) ?? p.frentes ?? [], scrum: p.metodologia === "scrum" }))}
        atual={{ time: perfil.projeto, frente, de, ate, g: agrup, s: sprintsSel }}
        sprints={sprints.map((s) => ({ id: s.id, nome: s.frente && s.frente !== perfil.time ? `${s.nome} (${s.frente})` : s.nome }))}
      />
      {d.demo && <p className="msg">Sem banco configurado: dados fictícios.</p>}
      <Tabela linhas={linhas} nomeArquivo={`metrificando-${perfil.projeto}${frente ? `-${frente}` : ""}-${de}_${ate}.csv`} />
    </main>
  );
}
