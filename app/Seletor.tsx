"use client";
// Seleção dos times e do recorte de cada um para o deck da Sync.
// Scrum: escolha das sprints coletadas. Kanban: intervalo de datas (semanas sáb–sex que fecham no intervalo).
import { useEffect, useMemo, useState, type ReactNode } from "react";

type Sprint = { id: string; nome: string; fim: string };
type Cartao = { projeto: string; time: string; metodologia: "scrum" | "kanban"; sprints: Sprint[]; conteudo: ReactNode };
type Recorte = { sprints: Set<string>; de: string; ate: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);

function limitesTrimestre(t: string) {
  const [ano, q] = t.split("-Q").map(Number);
  const de = new Date(Date.UTC(ano, (q - 1) * 3, 1));
  const fim = new Date(Date.UTC(ano, q * 3, 0));
  const hoje = new Date();
  return { de: iso(de), ate: iso(fim < hoje ? fim : hoje), deMs: de.getTime(), ateMs: Date.UTC(ano, q * 3, 1) };
}

function recortePadrao(c: Cartao, trimestre: string): Recorte {
  const l = limitesTrimestre(trimestre);
  const doTrimestre = c.sprints.filter((s) => { const t = new Date(s.fim).getTime(); return t >= l.deMs && t < l.ateMs; });
  return { sprints: new Set(doTrimestre.map((s) => s.id)), de: l.de, ate: l.ate };
}

export function Seletor({ cartoes, trimestres }: { cartoes: Cartao[]; trimestres: string[] }) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [trimestre, setTrimestre] = useState(trimestres[0]);
  const [recortes, setRecortes] = useState<Record<string, Recorte>>({});
  const [personalizar, setPersonalizar] = useState(false);

  // Trocar o trimestre recalcula o recorte padrão de todos os times.
  useEffect(() => {
    setRecortes(Object.fromEntries(cartoes.map((c) => [c.projeto, recortePadrao(c, trimestre)])));
  }, [trimestre, cartoes]);

  const alternar = (p: string) =>
    setMarcados((m) => { const n = new Set(m); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const todos = marcados.size === cartoes.length;
  const selecionados = cartoes.filter((c) => marcados.has(c.projeto));

  const atualizar = (p: string, f: (r: Recorte) => Recorte) =>
    setRecortes((rs) => ({ ...rs, [p]: f(rs[p]) }));

  const destino = useMemo(() => {
    const q = new URLSearchParams({ trimestre, times: selecionados.map((c) => c.projeto).join(",") });
    if (personalizar) {
      for (const c of selecionados) {
        const r = recortes[c.projeto];
        if (!r) continue;
        if (c.metodologia === "scrum") q.set(`s_${c.projeto}`, [...r.sprints].join(",") || "nenhuma");
        else { q.set(`de_${c.projeto}`, r.de); q.set(`ate_${c.projeto}`, r.ate); }
      }
    }
    return `/apresentacao?${q.toString()}`;
  }, [trimestre, selecionados, recortes, personalizar]);

  return (
    <>
      <div className="barra">
        <label>
          Trimestre{" "}
          <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)}>
            {trimestres.map((t) => <option key={t} value={t}>{t.replace(/^(\d{4})-Q(\d)$/, "Q$2 $1")}</option>)}
          </select>
        </label>
        <label className="opcao">
          <input type="checkbox" checked={personalizar} onChange={(e) => setPersonalizar(e.target.checked)} /> Escolher sprints e períodos
        </label>
        <button type="button" className="link" onClick={() => setMarcados(todos ? new Set() : new Set(cartoes.map((c) => c.projeto)))}>
          {todos ? "Limpar seleção" : "Selecionar todos"}
        </button>
        <span className="contagem">{selecionados.length ? `${selecionados.length} time(s): ${selecionados.map((c) => c.time).join(", ")}` : "Selecione os times do deck"}</span>
        <a className={`botao ${selecionados.length ? "" : "desativado"}`} href={selecionados.length ? destino : undefined} aria-disabled={!selecionados.length}>
          Gerar apresentação →
        </a>
      </div>

      <div className="grid">
        {cartoes.map((c) => {
          const ativo = marcados.has(c.projeto);
          return (
            <section key={c.projeto} className={`card selecionavel ${ativo ? "ativo" : ""}`} role="checkbox" aria-checked={ativo} tabIndex={0}
              onClick={() => alternar(c.projeto)} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); alternar(c.projeto); } }}>
              <span className="marcador" aria-hidden>{ativo ? "✓" : ""}</span>
              {c.conteudo}
              {ativo && personalizar && recortes[c.projeto] && (
                // Cliques e teclas dentro do recorte não alternam a seleção do cartão.
                <div className="recorte" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <RecorteDoTime cartao={c} recorte={recortes[c.projeto]} mudar={(f) => atualizar(c.projeto, f)} />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function RecorteDoTime({ cartao: c, recorte: r, mudar }: { cartao: Cartao; recorte: Recorte; mudar: (f: (r: Recorte) => Recorte) => void }) {
  if (c.metodologia === "kanban") {
    return (
      <>
        <div className="recorte-titulo">Período (semanas sáb–sex que fecham no intervalo)</div>
        <div className="datas">
          <label>De <input type="date" value={r.de} onChange={(e) => mudar((x) => ({ ...x, de: e.target.value }))} /></label>
          <label>Até <input type="date" value={r.ate} min={r.de} onChange={(e) => mudar((x) => ({ ...x, ate: e.target.value }))} /></label>
        </div>
      </>
    );
  }
  if (!c.sprints.length) return <p className="vazio">Nenhuma sprint coletada ainda.</p>;
  const alternar = (id: string) => mudar((x) => { const n = new Set(x.sprints); n.has(id) ? n.delete(id) : n.add(id); return { ...x, sprints: n }; });
  return (
    <>
      <div className="recorte-titulo">Sprints ({r.sprints.size} de {c.sprints.length})</div>
      <div className="chips">
        {c.sprints.map((s) => (
          <label key={s.id} className={`chip ${r.sprints.has(s.id) ? "ativo" : ""}`}>
            <input type="checkbox" checked={r.sprints.has(s.id)} onChange={() => alternar(s.id)} />
            {s.nome}
          </label>
        ))}
      </div>
    </>
  );
}
