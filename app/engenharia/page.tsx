// Métricas de engenharia (DORA e parte do SPACE) a partir dos PRs do GitHub, por time e semana sábado–sexta.
// Visão por time e frente, nunca por pessoa.
import { PERFIS } from "../../src/config/perfis";
import { db, urlBanco } from "../../src/lib/db";
import { indicadores, type PR } from "../../src/lib/github";
import { janelaSemanal } from "../../src/lib/periodo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Engenharia — Metrificando" };

const SEMANAS = 12;
const h = (x: number | null) => (x == null ? "—" : x < 48 ? `${x.toFixed(1)} h` : `${(x / 24).toFixed(1)} d`);
const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);
const dataBR = (d: string) => d.split("-").reverse().join("/");

export default async function Engenharia({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const perfil = PERFIS.find((p) => p.projeto === q.time) ?? PERFIS.find((p) => p.projeto === "NXS")!;
  const frentes = perfil.sprintsPorFrente?.map((f) => f.frente) ?? perfil.frentes ?? [];
  const frente = q.frente && frentes.includes(q.frente) ? q.frente : "";
  const semanas = Array.from({ length: SEMANAS }, (_, k) => janelaSemanal(new Date(Date.now() - k * 7 * 86_400_000))).reverse();
  const desde = semanas[0].inicio.toISOString();

  const semBanco = !urlBanco();
  const linhas = semBanco ? [] : ((await db()`
    select repo, numero, autor, titulo, head, base, estado, rascunho, criado_em::text as "criadoEm", merged_em::text as "mergedEm",
      fechado_em::text as "fechadoEm", primeira_review_em::text as "primeiraReviewEm", adicoes, delecoes, arquivos, origem
    from itens_pr where time = ${perfil.time} and (${frente} = '' or frente = ${frente})
      and coalesce(merged_em, fechado_em, criado_em) >= ${desde}`) as (PR & { origem: string })[]);
  const cobertura = semBanco ? [] : ((await db()`
    select coalesce(time, 'Não atribuído') as time, origem, count(*)::int as n from itens_pr
    where coalesce(merged_em, fechado_em, criado_em) >= ${desde} group by 1, 2 order by 1, 2`) as { time: string; origem: string; n: number }[]);

  const quando = (p: PR) => new Date(p.mergedEm ?? p.fechadoEm ?? p.criadoEm).getTime();
  const porSemana = semanas.map((j) => ({ j, i: indicadores(linhas.filter((p) => quando(p) >= j.inicio.getTime() && quando(p) <= j.fim.getTime())) }));
  const total = indicadores(linhas);
  const repos = [...new Set(linhas.filter((p) => p.mergedEm).map((p) => p.repo))].sort();

  return (
    <main className="largo">
      <h1>Engenharia</h1>
      <p className="sub">
        DORA e fluxo de PRs do GitHub, semanas sábado–sexta. Deploy = merge em master/main/production (release de um repo num dia conta uma vez);
        falha = deploy com branch hotfix/fix/bugfix. Lead time = PR aberto → merge. Atribuição: chave do Jira no branch/título, senão o login
        cadastrado em Configurações → Pessoas (alocação vigente no merge). Visão por time e frente, nunca por pessoa.
      </p>
      <form className="linha-form">
        <label>Time <select name="time" defaultValue={perfil.projeto}>{PERFIS.map((p) => <option key={p.projeto} value={p.projeto}>{p.time}</option>)}</select></label>
        {frentes.length > 0 && <label>Frente <select name="frente" defaultValue={frente}><option value="">Time inteiro</option>{frentes.map((f) => <option key={f}>{f}</option>)}</select></label>}
        <button className="botao">Ver</button>
      </form>
      {semBanco && <p className="msg">Sem banco configurado.</p>}
      {!semBanco && !linhas.length && <p className="msg">Nenhum PR coletado para {perfil.time} nas últimas {SEMANAS} semanas. A coleta roda todo dia às 07h (exige GITHUB_TOKEN).</p>}

      <section className="card">
        <h2>{perfil.time}{frente ? ` · ${frente}` : ""} — últimas {SEMANAS} semanas</h2>
        <table>
          <thead><tr><th>Semana</th><th className="n">Deploys</th><th className="n">Falha</th><th className="n">PRs mergeados</th><th className="n">Lead time (mediana)</th><th className="n">Lead time p85</th><th className="n">1ª review (mediana)</th><th className="n">Tamanho (linhas)</th><th className="n">Fechados sem merge</th></tr></thead>
          <tbody>
            {porSemana.map(({ j, i }) => (
              <tr key={j.periodoId}>
                <td>{dataBR(j.periodoId)}</td><td className="n">{i.deploys}</td><td className="n">{pct(i.taxaFalha)}</td><td className="n">{i.prsMergeados}</td>
                <td className="n">{h(i.leadTimeH)}</td><td className="n">{h(i.leadTimeP85H)}</td><td className="n">{h(i.primeiraReviewH)}</td>
                <td className="n">{i.tamanhoMediano == null ? "—" : Math.round(i.tamanhoMediano)}</td><td className="n">{i.fechadosSemMerge}</td>
              </tr>
            ))}
            <tr><td><b>Período</b></td><td className="n"><b>{total.deploys}</b></td><td className="n"><b>{pct(total.taxaFalha)}</b></td><td className="n"><b>{total.prsMergeados}</b></td>
              <td className="n"><b>{h(total.leadTimeH)}</b></td><td className="n"><b>{h(total.leadTimeP85H)}</b></td><td className="n"><b>{h(total.primeiraReviewH)}</b></td>
              <td className="n"><b>{total.tamanhoMediano == null ? "—" : Math.round(total.tamanhoMediano)}</b></td><td className="n"><b>{total.fechadosSemMerge}</b></td></tr>
          </tbody>
        </table>
        {repos.length > 0 && <p className="sub">Repos com merge no período: {repos.join(", ")}.</p>}
      </section>

      <section className="card">
        <h2>Cobertura da atribuição (todos os times)</h2>
        <p className="sub">PRs não atribuídos indicam login sem cadastro ou branch sem chave do Jira.</p>
        <table>
          <thead><tr><th>Time</th><th className="n">Pela chave do Jira</th><th className="n">Pelo login</th><th className="n">Sem atribuição</th></tr></thead>
          <tbody>
            {[...new Set(cobertura.map((c) => c.time))].map((t) => {
              const n = (o: string) => cobertura.find((c) => c.time === t && c.origem === o)?.n ?? 0;
              return <tr key={t}><td>{t}</td><td className="n">{n("jira")}</td><td className="n">{n("login")}</td><td className="n">{n("nao_atribuido")}</td></tr>;
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
