"use client";
// Assistente do deck da Sync em quatro passos: times e frentes → período e agrupamento → slides → confirmação.
// Scrum: escolha das sprints coletadas. Kanban: intervalo de datas (semanas sáb–sex que fecham no intervalo).
// O estado vive na URL do deck (mesmos parâmetros), então voltar da apresentação reabre a confirmação.
import { Icone } from "./componentes/Icone";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SLIDES, TODOS_SLIDES } from "@/lib/slides";

type Sprint = { id: string; nome: string; fim: string; frente?: string };
type Cartao = { projeto: string; time: string; metodologia: "scrum" | "kanban"; sprints: Sprint[]; frentes: string[]; sempreFrente?: boolean; conteudo: ReactNode };
type Recorte = { sprints: Set<string>; de: string; ate: string };
type Agrup = "periodo" | "quinzena" | "mes" | "trimestre";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const br = (d: string) => d.split("-").reverse().join("/");

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

/** Opções de agrupamento por metodologia: Scrum agrupa sprints, Kanban agrupa semanas. */
const OPCOES_AGRUP: Record<"scrum" | "kanban", [Agrup, string, string][]> = {
  kanban: [["periodo", "Semanal", "cada semana sáb–sex"], ["quinzena", "Quinzenal", "média das 2 semanas"], ["mes", "Mensal", "média das semanas do mês"], ["trimestre", "Trimestral", "média das semanas do trimestre"]],
  scrum: [["periodo", "Por sprint", "cada sprint"], ["mes", "Mensal", "média das sprints que fecham no mês"], ["trimestre", "Trimestral", "média das sprints do trimestre"]],
};
const ROTULO_AGRUP = (m: "scrum" | "kanban", a: Agrup) => OPCOES_AGRUP[m].find(([v]) => v === a)?.[1] ?? OPCOES_AGRUP[m][0][1];

const PASSOS = ["Times e frentes", "Período e agrupamento", "Slides", "Confirmação"];

type Inicial = Record<string, string | undefined>;

export function Seletor({ cartoes, trimestres, inicial = {} }: { cartoes: Cartao[]; trimestres: string[]; inicial?: Inicial }) {
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set((inicial.times ?? "").split(",").filter((p) => cartoes.some((c) => c.projeto === p))));
  // Voltando do deck (URL com times), abre direto na confirmação.
  const [passo, setPasso] = useState(() => (marcados.size ? 3 : 0));
  const [trimestre, setTrimestre] = useState(inicial.trimestre && trimestres.includes(inicial.trimestre) ? inicial.trimestre : trimestres[0]);
  const primeiraVez = useRef(true);
  const [recortes, setRecortes] = useState<Record<string, Recorte>>({});
  const [personalizar, setPersonalizar] = useState(() => Object.keys(inicial).some((k) => /^(s|de|ate)_/.test(k)));
  // Frentes escolhidas por time; ausente = time inteiro (ou todas as frentes, na Retaguarda).
  const [selFrentes, setSelFrentes] = useState<Record<string, string[]>>(() => Object.fromEntries(cartoes.flatMap((c) => {
    const v = inicial[`f_${c.projeto}`];
    if (!v || v === "geral") return [];
    return [[c.projeto, v === "frentes" ? c.frentes : v.split(",").filter((f) => c.frentes.includes(f))]];
  })));
  const frentesDe = (c: Cartao) => selFrentes[c.projeto] ?? (c.sempreFrente ? c.frentes : []);
  const alternarFrente = (c: Cartao, f?: string) => setSelFrentes((s) => {
    const n = { ...s };
    if (!f) { delete n[c.projeto]; return n; }
    const atual = new Set(frentesDe(c));
    atual.has(f) ? atual.delete(f) : atual.add(f);
    // Retaguarda precisa de ao menos uma frente; nos demais, nenhuma frente = time inteiro.
    if (!atual.size) { if (c.sempreFrente) return s; delete n[c.projeto]; return n; }
    n[c.projeto] = c.frentes.filter((x) => atual.has(x));
    return n;
  });
  const descricaoFrentes = (c: Cartao) => {
    const f = frentesDe(c);
    if (!c.frentes.length) return "";
    if (!f.length) return " · time inteiro";
    return f.length === c.frentes.length ? ` · por frente (${f.join(", ")})` : ` · só ${f.join(", ")}`;
  };
  const [agrup, setAgrup] = useState<Record<string, Agrup>>(() => Object.fromEntries(Object.entries(inicial)
    .filter(([k, v]) => k.startsWith("g_") && v && ["quinzena", "mes", "trimestre"].includes(v)).map(([k, v]) => [k.slice(2), v as Agrup])));
  const [slides, setSlides] = useState<Set<string>>(() => new Set(inicial.slides ? inicial.slides.split(",") : TODOS_SLIDES));

  // Trocar o trimestre recalcula o recorte padrão de todos os times.
  useEffect(() => {
    const padrao = Object.fromEntries(cartoes.map((c) => [c.projeto, recortePadrao(c, trimestre)]));
    // Só na primeira montagem: recortes vindos da URL sobrepõem o padrão.
    if (primeiraVez.current) {
      primeiraVez.current = false;
      for (const c of cartoes) {
        const s = inicial[`s_${c.projeto}`], de = inicial[`de_${c.projeto}`], ate = inicial[`ate_${c.projeto}`];
        if (s) padrao[c.projeto] = { ...padrao[c.projeto], sprints: new Set(s === "nenhuma" ? [] : s.split(",")) };
        if (de) padrao[c.projeto] = { ...padrao[c.projeto], de };
        if (ate) padrao[c.projeto] = { ...padrao[c.projeto], ate };
      }
    }
    setRecortes(padrao);
  }, [trimestre, cartoes]); // eslint-disable-line react-hooks/exhaustive-deps

  const alternar = (p: string) =>
    setMarcados((m) => { const n = new Set(m); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const todos = marcados.size === cartoes.length;
  const selecionados = cartoes.filter((c) => marcados.has(c.projeto));
  const metodologias = new Set(selecionados.map((c) => c.metodologia));
  // Slides que fazem sentido para a metodologia de algum time escolhido.
  const slidesAplicaveis = SLIDES.filter((s) => !s.metodologia || metodologias.has(s.metodologia));
  const slidesEscolhidos = slidesAplicaveis.filter((s) => slides.has(s.chave));

  const atualizar = (p: string, f: (r: Recorte) => Recorte) =>
    setRecortes((rs) => ({ ...rs, [p]: f(rs[p]) }));

  const destino = useMemo(() => {
    const q = new URLSearchParams({ trimestre, times: selecionados.map((c) => c.projeto).join(",") });
    for (const c of selecionados) {
      const f = selFrentes[c.projeto];
      if (f?.length) q.set(`f_${c.projeto}`, f.length === c.frentes.length ? "frentes" : f.join(","));
    }
    for (const c of selecionados) {
      const a = agrup[c.projeto];
      if (a && a !== "periodo" && OPCOES_AGRUP[c.metodologia].some(([v]) => v === a)) q.set(`g_${c.projeto}`, a);
    }
    if (personalizar) {
      for (const c of selecionados) {
        const r = recortes[c.projeto];
        if (!r) continue;
        if (c.metodologia === "scrum") q.set(`s_${c.projeto}`, [...r.sprints].join(",") || "nenhuma");
        else { q.set(`de_${c.projeto}`, r.de); q.set(`ate_${c.projeto}`, r.ate); }
      }
    }
    if (TODOS_SLIDES.some((s) => !slides.has(s))) q.set("slides", [...slides].join(","));
    return `/apresentacao?${q.toString()}`;
  }, [trimestre, selecionados, recortes, personalizar, selFrentes, agrup, slides]);

  // Salva a configuração e abre /apresentacao/<id>: os parâmetros não aparecem na URL.
  // Sem banco (demonstração), cai no formato antigo com os parâmetros na URL.
  const [abrindo, setAbrindo] = useState(false);
  const abrir = async (imprimir: boolean) => {
    setAbrindo(true);
    const janela = imprimir ? window.open("", "_blank") : null;
    let url = destino;
    try {
      const r = await fetch("/api/decks", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ parametros: Object.fromEntries(new URL(destino, location.origin).searchParams) }) });
      if (r.ok) url = `/apresentacao/${(await r.json()).id}`;
    } catch { /* mantém o formato antigo */ }
    const final = imprimir ? `${url}${url.includes("?") ? "&" : "?"}imprimir=1` : url;
    if (janela) janela.location.href = final; else location.href = final;
    setAbrindo(false);
  };

  const podeAvancar = passo === 0 ? selecionados.length > 0 : passo === 2 ? slidesEscolhidos.length > 0 : true;
  const rotuloTrimestre = trimestre.replace(/^(\d{4})-Q(\d)$/, "Q$2 $1");
  const periodoDe = (c: Cartao) => {
    const r = recortes[c.projeto];
    if (!personalizar || !r) return `${rotuloTrimestre} inteiro`;
    return c.metodologia === "scrum" ? `${r.sprints.size} sprint(s) escolhida(s)` : `${br(r.de)} a ${br(r.ate)}`;
  };

  return (
    <div className="assistente">
      <ol className="passos">
        {PASSOS.map((p, k) => (
          <li key={p} className={k === passo ? "atual" : k < passo ? "feito" : ""}>
            <button type="button" disabled={k > passo && (!selecionados.length || (k === 3 && !slidesEscolhidos.length))} onClick={() => setPasso(k)}>
              <span className="num">{k < passo ? "✓" : k + 1}</span>{p}
            </button>
          </li>
        ))}
      </ol>

      {passo === 0 && (
        <>
          <div className="barra">
            <span className="contagem">{selecionados.length ? `${selecionados.length} time(s): ${selecionados.map((c) => c.time).join(", ")}` : "Selecione os times do deck"}</span>
            <button type="button" className="link" onClick={() => setMarcados(todos ? new Set() : new Set(cartoes.map((c) => c.projeto)))}>
              {todos ? "Limpar seleção" : "Selecionar todos"}
            </button>
          </div>
          <div className="grid">
            {cartoes.map((c) => {
              const ativo = marcados.has(c.projeto);
              return (
                <section key={c.projeto} className={`card selecionavel ${ativo ? "ativo" : ""}`} role="checkbox" aria-checked={ativo} tabIndex={0}
                  onClick={() => alternar(c.projeto)} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); alternar(c.projeto); } }}>
                  <span className="marcador" aria-hidden>{ativo ? "✓" : ""}</span>
                  {c.conteudo}
                  {ativo && c.frentes.length > 0 && (
                    <div className="recorte" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <div className="recorte-titulo">Frentes</div>
                      <div className="alternador">
                        {!c.sempreFrente && (
                          <label className={`chip ${!frentesDe(c).length ? "ativo" : ""}`}>
                            <input type="checkbox" checked={!frentesDe(c).length} onChange={() => alternarFrente(c)} /> Time inteiro
                          </label>
                        )}
                        {c.frentes.map((f) => (
                          <label key={f} className={`chip ${frentesDe(c).includes(f) ? "ativo" : ""}`}>
                            <input type="checkbox" checked={frentesDe(c).includes(f)} onChange={() => alternarFrente(c, f)} /> {f}
                          </label>
                        ))}
                      </div>
                      <p className="dica">{!frentesDe(c).length ? "Um bloco com o time inteiro." : frentesDe(c).length === c.frentes.length ? "Um bloco por frente." : `Só ${frentesDe(c).join(", ")}.`}</p>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {passo === 1 && (
        <>
          <div className="barra">
            <label>
              Trimestre{" "}
              <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)}>
                {trimestres.map((t) => <option key={t} value={t}>{t.replace(/^(\d{4})-Q(\d)$/, "Q$2 $1")}</option>)}
              </select>
            </label>
            <label className="opcao">
              <input type="checkbox" checked={personalizar} onChange={(e) => setPersonalizar(e.target.checked)} /> Escolher sprints e períodos por time
            </label>
          </div>
          <div className="grid">
            {selecionados.map((c) => (
              <section key={c.projeto} className="card">
                <h2>{c.time}</h2>
                <div className="meta">{c.metodologia === "scrum" ? "Scrum" : "Kanban"}{descricaoFrentes(c)} · {periodoDe(c)}</div>
                <div className="recorte">
                  <div className="recorte-titulo">Agrupamento</div>
                  <div className="alternador" role="radiogroup">
                    {OPCOES_AGRUP[c.metodologia].map(([v, r, dica]) => {
                      const ativo = (agrup[c.projeto] ?? "periodo") === v;
                      return (
                        <label key={v} className={`chip ${ativo ? "ativo" : ""}`} title={dica}>
                          <input type="radio" name={`g_${c.projeto}`} checked={ativo} onChange={() => setAgrup((a) => ({ ...a, [c.projeto]: v }))} />
                          {r}
                        </label>
                      );
                    })}
                  </div>
                  <p className="dica">{OPCOES_AGRUP[c.metodologia].find(([v]) => v === (agrup[c.projeto] ?? "periodo"))?.[2]}</p>
                </div>
                {personalizar && recortes[c.projeto] && (
                  <div className="recorte">
                    <RecorteDoTime cartao={c.sempreFrente ? { ...c, sprints: c.sprints.filter((x) => !x.frente || frentesDe(c).includes(x.frente)) } : c} recorte={recortes[c.projeto]} mudar={(f) => atualizar(c.projeto, f)} />
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}

      {passo === 2 && (
        <>
          <div className="barra">
            <span className="contagem">{slidesEscolhidos.length} de {slidesAplicaveis.length} slides por time</span>
            <button type="button" className="link" onClick={() => setSlides(new Set(TODOS_SLIDES))}>Marcar todos</button>
            <button type="button" className="link" onClick={() => setSlides(new Set())}>Desmarcar todos</button>
          </div>
          <div className="lista-slides">
            {slidesAplicaveis.map((s) => {
              const ativo = slides.has(s.chave);
              return (
                <label key={s.chave} className={`card selecionavel item-slide ${ativo ? "ativo" : ""}`}>
                  <input type="checkbox" checked={ativo} onChange={() => setSlides((x) => { const n = new Set(x); n.has(s.chave) ? n.delete(s.chave) : n.add(s.chave); return n; })} />
                  <div>
                    <h3>{s.titulo} {s.metodologia && <span className="etiqueta">só {s.metodologia === "scrum" ? "Scrum" : "Kanban"}</span>}</h3>
                    <p>{s.descricao}</p>
                    {s.observacao && <p className="dica">{s.observacao}</p>}
                  </div>
                </label>
              );
            })}
          </div>
        </>
      )}

      {passo === 3 && (
        <section className="card confirmacao">
          <h2>Resumo do deck</h2>
          <dl>
            <dt>Trimestre</dt><dd>{rotuloTrimestre}</dd>
            <dt>Times</dt>
            <dd>
              <ul>
                {selecionados.map((c) => (
                  <li key={c.projeto}>
                    <b>{c.time}</b>{descricaoFrentes(c)}
                    {" · "}{periodoDe(c)} · {ROTULO_AGRUP(c.metodologia, agrup[c.projeto] ?? "periodo").toLowerCase()}
                  </li>
                ))}
              </ul>
            </dd>
            <dt>Slides ({slidesEscolhidos.length})</dt><dd>{slidesEscolhidos.map((s) => s.titulo).join(" · ")}</dd>
          </dl>
          <p className="dica">Abertura e encerramento entram sempre. Slides sem dados no período saem automaticamente.</p>
          <div className="acoes">
            <button type="button" className="botao" disabled={abrindo} onClick={() => abrir(false)}><Icone nome="apresentacao" /> Exibir apresentação</button>
            <button type="button" className="botao secundario" disabled={abrindo} onClick={() => abrir(true)}>Imprimir / salvar PDF</button>
          </div>
        </section>
      )}

      <div className="rodape-assistente">
        <button type="button" className="botao secundario" disabled={passo === 0} onClick={() => setPasso((p) => p - 1)}>Voltar</button>
        {passo < 3 && (
          <button type="button" className="botao" disabled={!podeAvancar} onClick={() => setPasso((p) => p + 1)}>
            {passo === 2 ? "Revisar" : "Avançar"}
          </button>
        )}
      </div>
    </div>
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
