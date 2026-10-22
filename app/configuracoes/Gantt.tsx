"use client";
// Linha do tempo (gantt) de férias, licenças, folgas e feriados, por pessoa e agrupada por time.
import { useMemo, useState } from "react";
import { tempoSemFerias, type SemFerias } from "@/lib/ferias";
import { Icone } from "../componentes/Icone";

type Alocacao = { time: string; frente: string; cargo: string; inicio: string; fim: string | null };
type Pessoa = { id: number; nome: string; vinculo?: string; admissao?: string | null; alocacoes: Alocacao[] };
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
  // Quem mostrar: todos, só quem tem ausência ou só quem não teve férias no período.
  const [filtro, setFiltro] = useState<"todos" | "com_ausencia" | "sem_ferias">("todos");
  const hojeIso = iso(Date.now());
  const SEM_ALOCACAO = "Sem alocação no período";

  const dias = useMemo(() => {
    const r: string[] = [];
    for (let t = dia(de); t <= dia(ate) && r.length < 400; t += DIA) r.push(iso(t));
    return r;
  }, [de, ate]);
  const feriadoDe = useMemo(() => new Map(feriados.map((f) => [f.data, f])), [feriados]);

  // Grupos: time da alocação vigente no período (a pessoa aparece em cada time em que esteve no intervalo).
  // Quem tem ausência no período mas nenhuma alocação nele vai para "Sem alocação no período" (senão sumiria).
  const grupos = useMemo(() => {
    const g = new Map<string, { pessoa: Pessoa; cargo: string; frente: string }[]>();
    const noPeriodo = (p: Pessoa, tipo?: string) => ausencias.some((x) => x.pessoa_id === p.id && x.inicio <= ate && x.fim >= de && (!tipo || x.tipo === tipo));
    const passa = (p: Pessoa) => filtro === "todos" || (filtro === "com_ausencia" ? noPeriodo(p) : !noPeriodo(p, "Férias"));
    const add = (chave: string, item: { pessoa: Pessoa; cargo: string; frente: string }) => {
      const lista = g.get(chave) ?? [];
      if (!lista.some((x) => x.pessoa.id === item.pessoa.id)) lista.push(item);
      g.set(chave, lista);
    };
    for (const p of pessoas) {
      if (!passa(p)) continue;
      const vigentes = p.alocacoes.filter((a) => a.inicio <= ate && (!a.fim || a.fim >= de) && (!time || a.time === time));
      for (const a of vigentes) add(a.time, { pessoa: p, cargo: a.cargo, frente: a.frente });
      if (!vigentes.length && !time && noPeriodo(p)) add(SEM_ALOCACAO, { pessoa: p, cargo: p.alocacoes.at(-1)?.cargo ?? "sem alocação", frente: "" });
    }
    const ordem = (t: string) => (t === SEM_ALOCACAO ? 999 : times.indexOf(t));
    return [...g.entries()].sort(([a], [b]) => ordem(a) - ordem(b))
      .map(([t, l]) => [t, l.sort((x, y) => x.pessoa.nome.localeCompare(y.pessoa.nome))] as const);
  }, [pessoas, ausencias, de, ate, time, filtro, times]);

  // Ausências cadastradas que ficaram fora do período exibido (ex.: 2027 com o calendário em 2026).
  const fora = useMemo(() => ausencias.filter((a) => a.fim < de || a.inicio > ate).sort((a, b) => a.inicio.localeCompare(b.inicio)), [ausencias, de, ate]);
  const proximaFora = fora.find((a) => a.inicio > ate) ?? fora.at(-1);

  // Situação de férias (referência: hoje). Só funcionários; a contagem parte de "funcionário desde"
  // (sem a data, usa a primeira alocação e avisa no tooltip). Terceirizados não têm alerta.
  const semFerias = useMemo(() => new Map(pessoas.map((p) => {
    if (p.vinculo === "terceirizado") return [p.id, null] as const;
    const base = p.admissao ?? p.alocacoes.map((a) => a.inicio).sort()[0] ?? null;
    const r = tempoSemFerias(p.id, base, ausencias, hojeIso);
    return [p.id, r && !p.admissao ? { ...r, texto: `${r.texto} (Data de "funcionário desde" não informada: contando da primeira alocação.)` } : r] as const;
  })), [pessoas, ausencias, hojeIso]);

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
        <label>Mostrar
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
            <option value="todos">Todas as pessoas</option>
            <option value="com_ausencia">Só quem tem ausência no período</option>
            <option value="sem_ferias">Só quem não tem férias no período</option>
          </select>
        </label>
        <span className="legenda-gantt">
          {Object.entries(COR_TIPO).map(([t, c]) => <span key={t}><i style={{ background: c }} />{t}</span>)}
          <span><i className="feriado" />Feriado</span>
          <span><i className="alerta-ferias" />Férias a marcar (mês 22+)</span>
          <span><i className="critico-ferias" />Férias vencidas (mês 24+)</span>
        </span>
      </div>
      {fora.length > 0 && proximaFora && (
        <p className="msg aviso">
          <Icone nome="alerta" tamanho={16} /> {fora.length} ausência(s) cadastrada(s) fora do período exibido
          ({fora.slice(0, 3).map((a) => `${a.inicio.split("-").reverse().join("/")}–${a.fim.split("-").reverse().join("/")}`).join(", ")}{fora.length > 3 ? "…" : ""}).{" "}
          <button type="button" className="link" onClick={() => {
            const ini = proximaFora.inicio.slice(0, 7) + "-01";
            const [a, m] = ini.split("-").map(Number);
            setDe(ini); setAte(iso(Date.UTC(a, m + 2, 0) + DIA / 2));
          }}>Ver a partir de {proximaFora.inicio.split("-").reverse().join("/")}</button>
        </p>
      )}
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
              ausencias={ausencias} de={de} ate={ate} col={col} semFerias={semFerias} />
          ))}
        </div>
        {!grupos.length && <p className="vazio">Nenhuma pessoa alocada nesse período{time ? ` em ${time}` : ""}. Cadastre em Pessoas e alocações.</p>}
      </div>
    </section>
  );
}

function Grupo({ time, lista, dias, fundoDia, feriadoDe, ausencias, de, ate, col, semFerias }: {
  time: string; lista: { pessoa: Pessoa; cargo: string; frente: string }[]; dias: string[]; fundoDia: (d: string) => string;
  feriadoDe: Map<string, Feriado>; ausencias: Ausencia[]; de: string; ate: string; col: (s: string) => number;
  semFerias: Map<number, SemFerias | null>;
}) {
  return (
    <>
      <div className="g-time" style={{ gridColumn: `1 / span ${dias.length + 1}` }}>{time}</div>
      {lista.map(({ pessoa, cargo, frente }) => {
        const sf = semFerias.get(pessoa.id);
        const nivel = sf && sf.nivel !== "ok" ? sf.nivel : "";
        const dica = `${pessoa.nome} · ${cargo}${frente ? ` · ${frente}` : ""}${sf ? `\n${sf.texto}` : ""}`;
        return (
        <div key={pessoa.id} className={`g-linha ${nivel ? `ferias-${nivel}` : ""}`} style={{ gridColumn: `1 / span ${dias.length + 1}`, gridTemplateColumns: "subgrid" }}>
          <div className="g-nome" style={{ gridColumn: 1, gridRow: 1 }} title={dica}>
            <b>{pessoa.nome}{nivel && <span className="selo-ferias" aria-label={sf!.texto}><Icone nome="alerta" tamanho={13} /> {nivel === "critico" ? "vencidas" : `${sf!.meses} meses`}</span>}</b>
            <span>{cargo}{frente ? ` · ${frente}` : ""}{pessoa.vinculo === "terceirizado" ? " · terceirizado" : ""}</span>
          </div>
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
        );
      })}
    </>
  );
}
