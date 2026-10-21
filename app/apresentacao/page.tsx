// Modo apresentação no formato da Sync de Agilidade.
// /apresentacao?trimestre=2026-Q4&times=SCOPS,DSR,IC  (demo=1 usa dados fictícios)
import { Work_Sans } from "next/font/google";
import { PERFIS } from "@/config/perfis";
import { carregarDeck, chaveLeitura, deckDemo, nomeDoTime, trimestreAtual, type DadosDeck, type DadosTime } from "@/lib/apresentacao";
import { corEntrega, corExtras, corPontos, corSaude, percentil, type Indicadores } from "@/lib/indicadores";
import { urlBanco } from "@/lib/db";
import { numeroDe } from "@/lib/teamretro";
import { Barras, COR_CATEGORIA, Linhas } from "./graficos";
import { Deck } from "./Deck";
import { Leitura } from "./Leitura";
import "./deck.css";

// Reserva até os arquivos da At Hauss Aero (fonte oficial, licenciada) estarem em public/fonts.
const fonte = Work_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--fonte-reserva" });

export const dynamic = "force-dynamic";
export const metadata = { title: "Sync de Agilidade — Metrificando" };

type Busca = Promise<Record<string, string | undefined>>;

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const num = (v: number | null) => (v == null ? "—" : String(Math.round(v * 10) / 10).replace(".", ","));
const dataBR = (d: string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Bahia", day: "2-digit", month: "2-digit" });
// Número da sprint ("Sprint 110 - 13/10 - 26/10" → 110, "X-Reta | Sprint 132" → 132); semana Kanban pela data.
const rotulo = (p: Indicadores) => (p.periodo.nome ? numeroDe(p.periodo.nome) ?? p.periodo.nome : dataBR(p.periodo.inicio));

const TIPOS: Record<string, string> = { entrega: "História", tecnologia: "Tecnologia", bug: "Correção", operacional: "Operacional", ajuste: "Ajuste", outro: "Outro" };

function series(periodos: Indicadores[], campo: "porPlanejamento" | "porTipo" | "porRoadmap", nomes?: Record<string, string>) {
  const chaves = [...new Set(periodos.flatMap((p) => Object.keys(p[campo])))];
  return chaves.map((c) => {
    const nome = nomes?.[c] ?? c;
    return { nome, valores: periodos.map((p) => p[campo][c] ?? 0), cor: COR_CATEGORIA[nome] };
  });
}

const secao = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

function Cabecalho({ t, eyebrow, titulo, sub }: { t: DadosTime; eyebrow: string; titulo: string; sub?: string }) {
  return (
    <>
      <div className="trilha">Sync de Agilidade &gt; {nomeDoTime(t)} &gt; <b>{secao(eyebrow)}</b></div>
      <h1>{titulo}</h1>
      {sub && <div className="subtitulo">{sub}</div>}
    </>
  );
}

/** Grafismos Movimento do brandbook: retângulos inclinados em progressão. */
function Grafismo({ tipo, cor = "#00e175" }: { tipo: "linhas" | "blocos"; cor?: string }) {
  if (tipo === "linhas") {
    const linhas = [[150, 0, 90, 300], [300, 0, 250, 220], [470, 0, 420, 160], [590, 0, 555, 90], [1240, 40, 1262, 540], [1190, 290, 1196, 560]];
    return (
      <svg className="grafismo" viewBox="0 0 1280 720" aria-hidden>
        {linhas.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth={9} />)}
      </svg>
    );
  }
  const blocos = ["1090,0 1280,0 1280,300 1120,290", "980,90 1100,95 1060,560 940,550", "860,330 960,340 900,700 800,690", "720,470 790,480 740,720 670,720"];
  return (
    <svg className="grafismo" viewBox="0 0 1280 720" aria-hidden>
      {blocos.map((p, i) => <polygon key={i} points={p} fill={cor} opacity={0.18 + i * 0.06} />)}
    </svg>
  );
}

/** Times da área pedagógica usam a paleta Pedagógico do brandbook na capa. */
const PEDAGOGICOS = new Set(["NXS", "EFC"]);

function Slide({ children, escuro, rodape, demo, pedagogico }: { children: React.ReactNode; escuro?: boolean; rodape?: string; demo?: boolean; pedagogico?: boolean }) {
  return (
    <section className={`slide ${escuro ? "escuro" : ""} ${pedagogico ? "pedagogico" : ""}`}>
      {!escuro && <span className="sinal" aria-hidden />}
      {children}
      {demo && <span className="selo-demo">DADOS FICTÍCIOS</span>}
      <div className="rodape">{rodape ?? "Área TAP · Grupo Salta Educação"}</div>
    </section>
  );
}

function slidesDoTime(d: DadosDeck, t: DadosTime) {
  const ps = t.periodos;
  const scrum = t.perfil.metodologia === "scrum";
  const unidade = scrum ? "Sprints" : "Semanas (sáb–sex)";
  const rot = ps.map(rotulo);
  const L = (slide: string, placeholder?: string) => (
    <Leitura deck={d.deck} time={nomeDoTime(t)} slide={slide} inicial={d.leituras[chaveLeitura(nomeDoTime(t), slide)]} demo={d.demo} placeholder={placeholder} />
  );
  const Faixa = ({ slide }: { slide: string }) => <div className="faixa"><b>Leitura:</b>{L(slide)}</div>;
  const rodape = `${nomeDoTime(t)} · Indicadores · Área TAP · Grupo Salta Educação`;
  const medianaPts = percentil(ps.map((p) => p.ptsSdd), 0.5);
  const intervalo = ps.length ? `${rotulo(ps[0])} a ${rotulo(ps.at(-1)!)}` : "sem períodos coletados";

  const capa = (
    <Slide escuro key="capa" demo={d.demo} pedagogico={PEDAGOGICOS.has(t.perfil.projeto)}>
      <Grafismo tipo="blocos" cor={PEDAGOGICOS.has(t.perfil.projeto) ? "#ff47ff" : "#00e175"} />
      <span className="tap" aria-label="TAP" />
      <span className="assinatura branca" aria-label="Grupo Salta" />
      <div className="capa">
        <div className="sub-capa">Área TAP · {d.rotulo}</div>
        <h1>{t.perfil.time}</h1>
        {t.frente && <div className="frente-capa">Frente {t.frente}</div>}
        <div className="sub">{unidade}: {intervalo}</div>
      </div>
    </Slide>
  );

  if (!ps.length) {
    return [capa, (
      <Slide key="vazio" rodape={rodape} demo={d.demo}>
        <Cabecalho t={t} eyebrow="INDICADORES" titulo={`Sem dados coletados no ${d.rotulo}`} />
        <div className="vazio">Nenhum período fechado deste time foi coletado no trimestre.</div>
      </Slide>
    )];
  }

  const linhasMatriz: [string, (p: Indicadores) => React.ReactNode][] = [
    ...(scrum ? [
      ["Entrega", (p: Indicadores) => <span className={`s-${corEntrega(p.entrega)}`}>{pct(p.entrega)}</span>],
      ["Extras", (p: Indicadores) => <span className={`s-${corExtras(p.extras)}`}>{pct(p.extras)}</span>],
    ] as [string, (p: Indicadores) => React.ReactNode][] : []),
    ["Pontos COM SDD", (p) => <span className={`s-${corPontos(p.ptsSdd, medianaPts)}`}>{num(p.ptsSdd)}</span>],
    ["Pontos SEM SDD", (p) => num(p.ptsSemSdd)],
    ["Itens entregues", (p) => p.itensEntregues],
    ["Cycle time P50 (dias)", (p) => num(p.cycleP50)],
    ["Chamados resolvidos (N3)", (p) => `${p.chamados} (${p.chamadosN3})`],
    ...(t.perfil.teamRetroId ? [
      ["Produtividade", (p: Indicadores) => <span className={`s-${corSaude(p.produtividade)}`}>{pct(p.produtividade)}</span>],
      ["Motivação", (p: Indicadores) => <span className={`s-${corSaude(p.motivacao)}`}>{pct(p.motivacao)}</span>],
    ] as [string, (p: Indicadores) => React.ReactNode][] : []),
  ];
  // Kanban tem muitas semanas: a matriz mostra as 8 mais recentes.
  const psMatriz = ps.slice(-8);

  const slides = [
    capa,
    <Slide key="matriz" rodape={rodape} demo={d.demo}>
      <Cabecalho t={t} eyebrow="INDICADORES" titulo={`${unidade} do ${d.rotulo}`} />
      <table className="matriz">
        <thead><tr><th>Indicador</th>{psMatriz.map((p) => <th key={p.periodo.periodo_id}>{rotulo(p)}</th>)}</tr></thead>
        <tbody>
          {linhasMatriz.map(([nome, f]) => (
            <tr key={nome}><td>{nome}</td>{psMatriz.map((p) => <td key={p.periodo.periodo_id}>{f(p)}</td>)}</tr>
          ))}
        </tbody>
      </table>
      <div className="cards">
        {[["c1", "Entrega e pontuação"], ["c2", "Fluxo e suporte"], ["c3", "Moral do time"]].map(([k, titulo]) => (
          <div className="card" key={k}><h4>{titulo}</h4>{L(`matriz-${k}`)}</div>
        ))}
      </div>
    </Slide>,
  ];

  if (scrum) {
    slides.push(
      <Slide key="entrega" rodape={rodape} demo={d.demo}>
        <Cabecalho t={t} eyebrow="ENTREGA" titulo="Proporção de entrega em pontos" sub="Pontos planejados concluídos ÷ pontos planejados" />
        <div className="grafico"><Barras rotulos={rot} series={[{ nome: "Entrega", valores: ps.map((p) => p.entrega) }]} formato={pct} referencia={{ valor: 1, rotulo: "100%" }} /></div>
        <Faixa slide="entrega" />
      </Slide>,
    );
  } else {
    slides.push(
      <Slide key="vazao" rodape={rodape} demo={d.demo}>
        <Cabecalho t={t} eyebrow="VAZÃO" titulo="Itens entregues por semana" sub="Janela sábado a sexta" />
        <div className="grafico"><Barras rotulos={rot} series={[{ nome: "Itens entregues", valores: ps.map((p) => p.itensEntregues) }]} /></div>
        <Faixa slide="vazao" />
      </Slide>,
    );
  }

  slides.push(
    <Slide key="desempenho" rodape={rodape} demo={d.demo}>
      <Cabecalho t={t} eyebrow="DESEMPENHO" titulo="Desempenho por pontos" sub="Pontos concluídos COM SDD e SEM SDD" />
      <div className="grafico"><Barras rotulos={rot} series={[{ nome: "COM SDD", valores: ps.map((p) => p.ptsSdd) }, { nome: "SEM SDD", valores: ps.map((p) => p.ptsSemSdd) }]} formato={num} /></div>
      <Faixa slide="desempenho" />
    </Slide>,
    <Slide key="cycle" rodape={rodape} demo={d.demo}>
      <Cabecalho t={t} eyebrow="FLUXO" titulo="Tempo de ciclo" sub="Dias corridos do início do trabalho até Concluído · P50 e P85" />
      <div className="grafico"><Linhas rotulos={rot} series={[{ nome: "P50", valores: ps.map((p) => p.cycleP50) }, { nome: "P85", valores: ps.map((p) => p.cycleP85), cor: "#007875" }]} formato={num} /></div>
      <Faixa slide="cycle" />
    </Slide>,
  );

  if (t.perfil.teamRetroId) {
    slides.push(
      <Slide key="saude" rodape={rodape} demo={d.demo}>
        <Cabecalho t={t} eyebrow="MORAL DO TIME" titulo="Produtividade e motivação" sub="Health check TeamRetro (Squad Feeling v2) · média das percepções coletiva e individual" />
        <div className="grafico"><Barras rotulos={rot} series={[{ nome: "Produtividade", valores: ps.map((p) => p.produtividade) }, { nome: "Motivação", valores: ps.map((p) => p.motivacao), cor: "#007875" }]} formato={pct} referencia={{ valor: 0.9, rotulo: "90%" }} /></div>
        <Faixa slide="saude" />
      </Slide>,
    );
  }

  if (scrum) {
    slides.push(
      <Slide key="comp-plan" rodape={rodape} demo={d.demo}>
        <Cabecalho t={t} eyebrow="COMPOSIÇÃO" titulo="Proporção dos pontos por tipo de planejamento" sub="Composição da sprint com base em seu planejamento" />
        <div className="grafico"><Barras modo="empilhado100" rotulos={rot} series={series(ps, "porPlanejamento")} /></div>
        <Faixa slide="comp-plan" />
      </Slide>,
    );
  }

  slides.push(
    <Slide key="comp-tipo" rodape={rodape} demo={d.demo}>
      <Cabecalho t={t} eyebrow="COMPOSIÇÃO" titulo="Proporção dos pontos por tipo de item" sub={`Comparativo entre ${unidade.toLowerCase()} do trimestre`} />
      <div className="grafico"><Barras modo="empilhado100" rotulos={rot} series={series(ps, "porTipo", TIPOS)} /></div>
      <Faixa slide="comp-tipo" />
    </Slide>,
    <Slide key="roadmap" rodape={rodape} demo={d.demo}>
      <Cabecalho t={t} eyebrow="ROADMAP" titulo="Proporção dos pontos por categoria de roadmap" sub="Realizado (entrega)" />
      <div className="grafico"><Barras modo="empilhado100" rotulos={rot} series={series(ps, "porRoadmap")} /></div>
      <Faixa slide="roadmap" />
    </Slide>,
    <Slide key="suporte" rodape={`${nomeDoTime(t)} · Suporte · Área TAP · Grupo Salta Educação`} demo={d.demo}>
      <Cabecalho t={t} eyebrow="SUPORTE" titulo="Chamados resolvidos" sub={`Por nível · ${t.perfil.suporte.filter((f) => f.papel === "chamado").map((f) => f.projeto).join(", ")}`} />
      <div className="grafico metade"><h3>Chamados por nível</h3>
        <Barras largura={560} rotulos={rot} series={[
          { nome: "N2", valores: ps.map((p) => p.chamados - p.chamadosN3) },
          { nome: "N3", valores: ps.map((p) => p.chamadosN3), cor: "#007875" },
          ...(t.perfil.suporte.some((f) => f.papel === "trabalho_n3") ? [{ nome: "Trabalho N3 (SIS)", valores: ps.map((p) => p.trabalhoN3), cor: "#61807a" }] : []),
        ]} />
      </div>
      <div className="grafico metade"><h3>Tempo de resolução P50 (dias)</h3>
        <Linhas largura={560} rotulos={rot} series={[{ nome: "P50", valores: ps.map((p) => p.resolucaoP50) }]} formato={num} />
      </div>
      <Faixa slide="suporte" />
    </Slide>,
    <Slide key="destaques" rodape={`${nomeDoTime(t)} · Roadmap de Negócio · Área TAP · Grupo Salta Educação`} demo={d.demo}>
      <Cabecalho t={t} eyebrow="ROADMAP DE NEGÓCIO" titulo="Destaques do roadmap" />
      <div className="blocos">
        <div className="bloco"><header>Atividades previstas para o {d.rotulo}</header>{L("destaques-principal", "Liste as atividades previstas…")}</div>
        <div className="bloco"><header>Destaque</header>{L("destaques-1")}</div>
        <div className="bloco"><header>Destaque</header>{L("destaques-2")}</div>
      </div>
    </Slide>,
  );
  return slides;
}

export default async function Apresentacao({ searchParams }: { searchParams: Busca }) {
  const q = await searchParams;
  const deck = q.trimestre ?? trimestreAtual();
  const projetos = q.times ? q.times.split(",").map((s) => s.trim().toUpperCase()) : PERFIS.map((p) => p.projeto);
  const demo = q.demo === "1" || (!urlBanco());
  const d = demo ? deckDemo(deck, projetos) : await carregarDeck(deck, projetos);

  return (
    <div className={fonte.variable}>
      <Deck>
        <section className="slide verde" key="abertura">
          <Grafismo tipo="linhas" />
          <div className="capa">
            <h1>Sync de Agilidade</h1>
            <div className="sub">Área TAP · {d.rotulo}</div>
            <div className="times">{[...new Set(d.times.map((t) => t.perfil.time))].join("   ·   ")}</div>
          </div>
          <span className="assinatura" aria-label="Grupo Salta" />
          {d.demo && <span className="selo-demo">DADOS FICTÍCIOS</span>}
        </section>
        {d.times.flatMap((t) => slidesDoTime(d, t))}
        <section className="slide verde" key="fim">
          <Grafismo tipo="linhas" />
          <div className="capa"><h1>Obrigado!</h1></div>
          <span className="assinatura" aria-label="Grupo Salta" />
        </section>
      </Deck>
    </div>
  );
}
