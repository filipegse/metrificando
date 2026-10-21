"use client";
// Linha do tempo (gantt) de férias, licenças, folgas e feriados, por pessoa e agrupada por time.
import { useMemo, useState } from "react";

type Alocacao = { time: string; frente: string; cargo: string; inicio: string; fim: string | null };
type Pessoa = { id: number; nome: string; alocacoes: Alocacao[] };
type Ausencia = { id: number; pessoa_id: number; inicio: string; fim: string; tipo: string };
type Feriado = { data: string; nome: string; abrangencia: string };

const DIA = 86400000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const dia = (s: string) => Date.parse(`${s}T12:00:00Z`);
const COR_TIPO: Record<string, string> = { "Férias": "#00e175", "Licença": "#6e00ff", "Folga": "#ffbf00", "Outro": "#61807a" };
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function Gantt({ pessoas, ausencias, feriados, times }: { pessoas: Pessoa[]; ausencias: Ausencia[]; feriados: Feriado[]; times: string[] }) {
  const hoje = new Date();
  const [de, setDe] = useState(iso(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1) + DIA / 2));
  const [ate, setAte] = useState(iso(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 3, 0) + DIA / 2));
  const [time, setTime] = useState("");
  const [soComAusencia, setSoComAusencia] = useState(false);

  const dias = useMemo(() => {
    const r: string[] = [];
    for (let t = dia(de); t <= dia(ate) && r.length < 400; t += DIA) r.push(iso(t));
    return r;
  }, [de, ate]);
  const feriadoDe = useMemo(() => new Map(feriados.map((f) => [f.data, f])), [feriados]);

  // Grupos: time da alocação vigente no período (a pessoa aparece em cada time em que esteve no intervalo).
  const grupos = useMemo(() => {
    const g = new Map<string, { pessoa: Pessoa; cargo: string; frente: string }[]>();
    for (const p of pessoas) {
      for (const a of p.alocacoes) {
        if (a.inicio > ate || (a.fim && a.fim < de)) continue;
        if (time && a.time !== time) continue;
        const temAusencia = ausencias.some((x) => x.pessoa_id === p.id && x.inicio <= ate && x.fim >= de);
        if (soComAusencia && !temAusencia) continue;
        const lista = g.get(a.time) ?? [];
        if (!lista.some((x) => x.pessoa.id === p.id)) lista.push({ pessoa: p, cargo: a.cargo, frente: a.frente });
        g.set(a.time, lista);
      }
    }
    return [...g.entries()].sort(([a], [b]) => times.indexOf(a) - times.indexOf(b))
      .map(([t, l]) => [t, l.sort((x, y) => x.pessoa.nome.localeCompare(y.pessoa.nome))] as const);
  }, [pessoas, ausencias, de, ate, time, soComAusencia, times]);

  const col = (s: string) => Math.round((dia(s) - dia(de)) / DIA);
  const largura = 26;
  const meses = dias.reduce<{ rotulo: string; inicio: number; n: number }[]>((acc, d, i) => {
    const r = `${MES[Number(d.slice(5, 7)) - 1]}/${d.slice(2, 4)}`;
    if (acc.at(-1)?.rotulo === r) acc.at(-1)!.n++; else acc.push({ rotulo: r, inicio: i, n: 1 });
    return acc;
  }, []);
  const fundoDia = (d: string) => {
    const f = feriadoDe.get(d), semana = new Date(`${d}T12:00:00Z`).getUTCDay();
    return f ? "feriado" : semana === 0 || semana === 6 ? "fds" : "";
  };

  return (
    <section className="card">
      <h2>Calendário da equipe</h2>
      <p className="sub">Férias, licenças, folgas e feriados juntos. Colunas rosadas são feriados (passe o mouse para ver o nome); cinza, fins de semana.</p>
      <div className="linha-form">
        <label>De <input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label>Até <input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} /></label>
        <label>Time <select value={time} onChange={(e) => setTime(e.target.value)}><option value="">Todos</option>{times.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="opcao-linha"><input type="checkbox" checked={soComAusencia} onChange={(e) => setSoComAusencia(e.target.checked)} /> Só quem tem ausência no período</label>
        <span className="legenda-gantt">
          {Object.entries(COR_TIPO).map(([t, c]) => <span key={t}><i style={{ background: c }} />{t}</span>)}
          <span><i className="feriado" />Feriado</span>
        </span>
      </div>
      <div className="gantt-rolagem">
        <div className="gantt" style={{ gridTemplateColumns: `220px repeat(${dias.length}, ${largura}px)` }}>
          <div className="g-canto" />
          {meses.map((m) => <div key={m.rotulo} className="g-mes" style={{ gridColumn: `${m.inicio + 2} / span ${m.n}` }}>{m.rotulo}</div>)}
          <div className="g-canto" />
          {dias.map((d) => {
            const f = feriadoDe.get(d);
            return <div key={d} className={`g-dia ${fundoDia(d)}`} title={f ? `${f.nome} (${d.split("-").reverse().join("/")})` : undefined}>{Number(d.slice(8))}</div>;
          })}
          {grupos.map(([t, lista]) => (
            <Grupo key={t} time={t} lista={lista} dias={dias} fundoDia={fundoDia} feriadoDe={feriadoDe}
              ausencias={ausencias} de={de} ate={ate} col={col} />
          ))}
        </div>
        {!grupos.length && <p className="vazio">Nenhuma pessoa alocada nesse período{time ? ` em ${time}` : ""}. Cadastre em Pessoas e alocações.</p>}
      </div>
    </section>
  );
}

function Grupo({ time, lista, dias, fundoDia, feriadoDe, ausencias, de, ate, col }: {
  time: string; lista: { pessoa: Pessoa; cargo: string; frente: string }[]; dias: string[]; fundoDia: (d: string) => string;
  feriadoDe: Map<string, Feriado>; ausencias: Ausencia[]; de: string; ate: string; col: (s: string) => number;
}) {
  return (
    <>
      <div className="g-time" style={{ gridColumn: `1 / span ${dias.length + 1}` }}>{time}</div>
      {lista.map(({ pessoa, cargo, frente }) => (
        <div key={pessoa.id} className="g-linha" style={{ gridColumn: `1 / span ${dias.length + 1}`, gridTemplateColumns: "subgrid" }}>
          <div className="g-nome" style={{ gridColumn: 1, gridRow: 1 }} title={`${pessoa.nome} · ${cargo}${frente ? ` · ${frente}` : ""}`}>{pessoa.nome}<span>{cargo}{frente ? ` · ${frente}` : ""}</span></div>
          {dias.map((d, i) => <div key={d} className={`g-cel ${fundoDia(d)}`} style={{ gridColumn: i + 2, gridRow: 1 }} title={feriadoDe.get(d)?.nome} />)}
          {ausencias.filter((a) => a.pessoa_id === pessoa.id && a.inicio <= ate && a.fim >= de).map((a) => {
            const ini = Math.max(0, col(a.inicio)), fim = Math.min(dias.length - 1, col(a.fim));
            return (
              <div key={a.id} className="g-barra" style={{ gridColumn: `${ini + 2} / ${fim + 3}`, background: COR_TIPO[a.tipo] ?? COR_TIPO.Outro, color: a.tipo === "Licença" || !COR_TIPO[a.tipo] || a.tipo === "Outro" ? "#fff" : "#000" }}
                title={`${pessoa.nome}: ${a.tipo} de ${a.inicio.split("-").reverse().join("/")} a ${a.fim.split("-").reverse().join("/")}`}>
                {fim - ini >= 2 ? a.tipo : ""}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
