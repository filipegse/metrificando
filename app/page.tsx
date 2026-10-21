// Visão consolidada por time — último período coletado. Sem dimensão de pessoa (princípio de métricas da TAP).
import { PERFIS } from "@/config/perfis";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Resumo = {
  time: string; periodo_id: string; nome: string | null; tipo: string; inicio: string; fim: string;
  itens: number; sp_sdd: number | null; cycle_p50: number | null;
  chamados: number; n3: number; resolucao_p50: number | null;
};

async function carregar(): Promise<Resumo[]> {
  if (!process.env.NETLIFY_DATABASE_URL && !process.env.DATABASE_URL) return [];
  const sql = db();
  return (await sql`
    with ultimo as (
      select distinct on (time) * from periodos order by time, fim desc
    )
    select u.time, u.periodo_id, u.nome, u.tipo, u.inicio, u.fim,
      (select count(*) from itens_delivery d where d.time = u.time and d.periodo_id = u.periodo_id and d.entregue)::int as itens,
      (select sum(sp_sdd) from itens_delivery d where d.time = u.time and d.periodo_id = u.periodo_id and d.entregue)::float as sp_sdd,
      (select percentile_cont(0.5) within group (order by cycle_time_dias) from itens_delivery d
         where d.time = u.time and d.periodo_id = u.periodo_id and d.entregue)::float as cycle_p50,
      (select count(*) from itens_suporte s where s.time = u.time and s.periodo_id = u.periodo_id and s.papel = 'chamado')::int as chamados,
      (select count(*) from itens_suporte s where s.time = u.time and s.periodo_id = u.periodo_id and s.papel = 'chamado' and s.nivel = 'N3')::int as n3,
      (select percentile_cont(0.5) within group (order by tempo_resolucao_dias) from itens_suporte s
         where s.time = u.time and s.periodo_id = u.periodo_id and s.papel = 'chamado')::float as resolucao_p50
    from ultimo u
  `) as Resumo[];
}

const fmt = (v: number | null, sufixo = "") => (v == null ? "—" : `${Math.round(v * 10) / 10}${sufixo}`);
const dataBR = (d: string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Bahia" });

export default async function Pagina() {
  const resumos = await carregar();
  return (
    <main>
      <h1>Métricas da TAP</h1>
      <p className="sub">Último período coletado de cada time. Visão por time e frente, nunca por pessoa. · <a href="/apresentacao">Modo apresentação</a></p>
      <div className="grid">
        {PERFIS.map((perfil) => {
          const r = resumos.find((x) => x.time === perfil.time);
          return (
            <section className="card" key={perfil.time}>
              <h2>{perfil.time}</h2>
              <div className="meta">
                {perfil.metodologia === "scrum" ? "Scrum" : "Kanban"} ·{" "}
                {r ? `${r.nome ?? `Semana de ${dataBR(r.inicio)}`} (${dataBR(r.inicio)}–${dataBR(r.fim)})` : "sem coleta ainda"}
              </div>
              {r && (
                <table>
                  <tbody>
                    <tr><td>Itens entregues</td><td className="n">{r.itens}</td></tr>
                    {perfil.metodologia === "scrum" && <tr><td>Pontos COM SDD</td><td className="n">{fmt(r.sp_sdd)}</td></tr>}
                    <tr><td>Cycle time (P50)</td><td className="n">{fmt(r.cycle_p50, " d")}</td></tr>
                    <tr><td>Chamados resolvidos</td><td className="n">{r.chamados}</td></tr>
                    <tr><td>…dos quais N3</td><td className="n">{r.n3}</td></tr>
                    <tr><td>Tempo de resolução (P50)</td><td className="n">{fmt(r.resolucao_p50, " d")}</td></tr>
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
