// Modo apresentação no formato da Sync de Agilidade.
// /apresentacao/<id> (deck salvo pelo assistente) ou /apresentacao?trimestre=2026-Q4&times=SCOPS,DSR,IC (demo=1 usa dados fictícios)
import { Work_Sans } from "next/font/google";
import { PERFIS } from "@/config/perfis";
import { carregarDeck, chaveLeitura, deckDemo, metodologiaDe, nomeDoTime, recortesDaUrl, trimestreAtual, type DadosDeck, type DadosTime } from "@/lib/apresentacao";
import { corEntrega, corExtras, corGanho, corPontos, corSaude, percentil, segundaDaSemana, tlEmDestaque, type Indicadores } from "@/lib/indicadores";
import { urlBanco } from "@/lib/db";
import { numeroDe } from "@/lib/teamretro";
import { Barras, COR_CATEGORIA, Linhas } from "./graficos";
import { Deck } from "./Deck";
import { Leitura } from "./Leitura";
import { slidesDaUrl } from "@/lib/slides";
import { dataCurta, detalheContexto, resumoContexto } from "@/lib/contexto";
import "./deck.css";

// Reserva até os arquivos da At Hauss Aero (fonte oficial, licenciada) estarem em public/fonts.
const fonte = Work_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--fonte-reserva" });


const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const num = (v: number | null) => (v == null ? "—" : String(Math.round(v * 10) / 10).replace(".", ","));
const dataBR = (d: string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Bahia", day: "2-digit", month: "2-digit" });
// Número da sprint ("Sprint 110 - 13/10 - 26/10" → 110, "X-Reta | Sprint 132" → 132); semana Kanban pela data.
// Semana Kanban: a janela é sáb–sex, mas o rótulo mostra sempre a segunda-feira.
const diaMes = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const rotulo = (p: Indicadores) => (p.periodo.rotulo ? p.periodo.rotulo : p.periodo.tipo === "semana" ? diaMes(segundaDaSemana(p.periodo.inicio))
  : p.periodo.nome ? numeroDe(p.periodo.nome) ?? p.periodo.nome : dataBR(p.periodo.inicio));

const TIPOS: Record<string, string> = { entrega: "História", tecnologia: "Tecnologia", bug: "Correção", operacional: "Operacional", ajuste: "Ajuste", outro: "Outro" };

/** Rodapé de medida quando algum período do histórico trouxe a composição em itens (e não em pontos). */
function notaMedida(ps: Indicadores[], campo: "porPlanejamento" | "porTipo" | "porRoadmap") {
  const itens = ps.filter((p) => p.medidaComposicao?.[campo] === "itens").map(rotulo);
  return itens.length ? ` · em quantidade de itens: ${itens.join(", ")}` : "";
}

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

const NOME_GRUPO = { quinzena: ["Quinzenas", "quinzena"], mes: ["Meses", "mês"], trimestre: ["Trimestres", "trimestre"] } as const;

function slidesDoTime(d: DadosDeck, t: DadosTime, escolhidos: Set<string>) {
  const ps = t.periodos;
  const scrum = metodologiaDe(t) === "scrum";
  const g = t.agrupamento && t.agrupamento !== "periodo" ? NOME_GRUPO[t.agrupamento] : null;
  // Agrupado: cada grupo mostra a média das semanas (Kanban) ou das sprints (Scrum) que o compõem.
  const base = scrum ? "sprint" : "semana";
  const unidade = g ? `${g[0]} (média por ${base})` : scrum ? "Sprints" : "Semanas (sáb–sex)";
  const notaGrupo = g ? ` · média por ${base} de cada ${g[1]}` : "";
  const desdeDev = t.perfil.cicloDesde === "desenvolvimento";
  // Períodos do histórico sem mediana: o P50 exibido é a média.
  const comMedia = ps.filter((p) => p.cycleP50EhMedia).map(rotulo);
  const avisoMedia = comMedia.length ? ` · ⚠ média, não mediana, em: ${comMedia.join(", ")}` : "";
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
    ...(ps.some((p) => p.esforcoSdd != null) ? [["Pontos de esforço COM SDD", (p: Indicadores) => num(p.esforcoSdd ?? null)]] as [string, (p: Indicadores) => React.ReactNode][] : []),
    ...(ps.some((p) => p.ganhoSdd != null) ? [["Ganho SDD", (p: Indicadores) => <span className={`s-${corGanho(p.ganhoSdd)}`}>{pct(p.ganhoSdd ?? null)}</span>]] as [string, (p: Indicadores) => React.ReactNode][] : []),
    ["Itens entregues", (p) => p.itensEntregues],
    ...(ps.some((p) => p.pctItensTl != null || p.pctPtsTl != null) ? [["Tech lead (itens / pontos)", (p: Indicadores) =>
      <span className={tlEmDestaque(p) ? "s-ruim" : undefined} title={tlEmDestaque(p) ? "Tech lead entregou 30% ou mais no período" : undefined}>
        {pct(p.pctItensTl ?? null)} / {pct(p.pctPtsTl ?? null)}</span>]] as [string, (p: Indicadores) => React.ReactNode][] : []),
    ...(ps.some((p) => p.capacidade) ? [["Capacidade (dias-dev)", (p: Indicadores) => num(p.capacidade ?? null)]] as [string, (p: Indicadores) => React.ReactNode][] : []),
    [`Cycle time P50 (dias)${scrum ? "" : desdeDev ? " · desde dev" : " · com A Fazer"}`, (p) => (p.cycleP50EhMedia ? <span title="Média (o histórico importado não tem mediana)">{num(p.cycleP50)}*</span> : num(p.cycleP50))],
    ...(ps.some((p) => p.cycleP50Alt != null) ? [[`Cycle time P50 ${desdeDev ? "com A Fazer" : "desde dev"}`, (p: Indicadores) => num(p.cycleP50Alt ?? null)]] as [string, (p: Indicadores) => React.ReactNode][] : []),
    ...(ps.some((p) => p.cycleMedia != null) ? [["Cycle time médio (dias)", (p: Indicadores) => num(p.cycleMedia ?? null)]] as [string, (p: Indicadores) => React.ReactNode][] : []),
    ...(ps.some((p) => p.horaExtraH != null) ? [["Hora extra (h · itens)", (p: Indicadores) =>
      (p.horaExtraH == null ? "—" : `${num(p.horaExtraH)} · ${p.itensHoraExtra ?? "—"}`)]] as [string, (p: Indicadores) => React.ReactNode][] : []),
    ...(ps.some((p) => p.contexto) ? [["Feriados e ausências", (p: Indicadores) => {
      const r = resumoContexto(p.contexto);
      return r === "—" ? "—" : <span className="s-contexto" title={detalheContexto(p.contexto).join("\n")}>{r}</span>;
    }]] as [string, (p: Indicadores) => React.ReactNode][] : []),
    ["Chamados resolvidos (N3)", (p) => (p.chamados == null ? "—" : `${p.chamados} (${p.chamadosN3})`)],
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
      <div className={`matriz-area ${linhasMatriz.length > 14 ? "densa muito-densa" : linhasMatriz.length > 10 ? "densa" : ""}`}>
      <table className="matriz">
        <thead><tr><th>Indicador</th>{psMatriz.map((p) => <th key={p.periodo.periodo_id}>{rotulo(p)}</th>)}</tr></thead>
        <tbody>
          {linhasMatriz.map(([nome, f]) => (
            <tr key={nome}><td>{nome}</td>{psMatriz.map((p) => <td key={p.periodo.periodo_id}>{f(p)}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {psMatriz.some((p) => p.cycleP50EhMedia) && <p className="nota-matriz">* Tempo de ciclo médio: o histórico importado não tem a mediana (P50) desses períodos.</p>}
      <div className="cards">
        {[["c1", "Entrega e pontuação"], ["c2", "Fluxo e suporte"], ["c3", "Moral do time"]].map(([k, titulo]) => (
          <div className="card" key={k}><h4>{titulo}</h4>{L(`matriz-${k}`)}</div>
        ))}
      </div>
      </div>
    </Slide>,
  ];

  // Feriados, dias não úteis e ausências: contexto para ler vazão, pontos e capacidade.
  const comContexto = psMatriz.filter((p) => p.contexto);
  if (comContexto.length) {
    slides.push(
      <Slide key="calendario" rodape={rodape} demo={d.demo}>
        <Cabecalho t={t} eyebrow="CALENDÁRIO" titulo="Feriados, dias não úteis e ausências" sub={`Contexto de cada ${scrum ? "sprint" : g ? g[1] : "semana"} · disponibilidade do time, não desempenho individual`} />
        <table className="matriz calendario">
          <thead><tr><th>{scrum ? "Sprint" : "Período"}</th><th>Dias úteis</th><th>Não úteis</th><th>Feriados</th><th>Férias, folgas e licenças</th></tr></thead>
          <tbody>
            {comContexto.map((p) => (
              <tr key={p.periodo.periodo_id}>
                <td>{rotulo(p)}</td><td>{p.contexto!.diasUteis}</td><td>{p.contexto!.diasNaoUteis}</td>
                <td>{p.contexto!.feriados.map((f) => `${dataCurta(f.data)} ${f.nome}`).join(" · ") || "—"}</td>
                <td>{p.contexto!.ausencias.map((a) => `${a.pessoa} (${a.tipo.toLowerCase()} ${dataCurta(a.de)}${a.de !== a.ate ? `–${dataCurta(a.ate)}` : ""})`).join(" · ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Slide>,
    );
  }

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
        <Cabecalho t={t} eyebrow="VAZÃO" titulo={g ? `Itens entregues por semana · média do ${g[1]}` : "Itens entregues por semana"} sub={`${g ? `Média das semanas (sáb–sex) de cada ${g[1]}${t.agrupamento === "quinzena" ? " · quinzena identificada pela primeira segunda-feira" : ""}` : "Semana identificada pela segunda-feira · janela sábado a sexta"}${
          ps.some(tlEmDestaque) ? ` · tech lead com 30% ou mais: ${ps.filter(tlEmDestaque).map(rotulo).join(", ")}` : ""}`} />
        <div className="grafico"><Barras rotulos={rot} series={[{ nome: "Itens entregues", valores: ps.map((p) => p.itensEntregues) }]} /></div>
        <Faixa slide="vazao" />
      </Slide>,
    );
  }

  slides.push(
    <Slide key="desempenho" rodape={rodape} demo={d.demo}>
      <Cabecalho t={t} eyebrow="DESEMPENHO" titulo="Desempenho por pontos" sub={`Pontos concluídos COM SDD e SEM SDD${notaGrupo}`} />
      <div className="grafico"><Barras rotulos={rot} series={[{ nome: "COM SDD", valores: ps.map((p) => p.ptsSdd) }, { nome: "SEM SDD", valores: ps.map((p) => p.ptsSemSdd) }]} formato={num} /></div>
      <Faixa slide="desempenho" />
    </Slide>,
    <Slide key="cycle" rodape={rodape} demo={d.demo}>
      <Cabecalho t={t} eyebrow="FLUXO" titulo="Tempo de ciclo" sub={`Dias úteis ${desdeDev ? "a partir do desenvolvimento (sem A Fazer)" : "da entrada em A Fazer"} até Concluído · P50 e P85${g ? ` · ${g[1]} = média dos períodos ponderada por itens` : ""}${avisoMedia}`} />
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
        <Cabecalho t={t} eyebrow="COMPOSIÇÃO" titulo="Proporção dos pontos por tipo de planejamento" sub={`Composição da sprint com base em seu planejamento${notaMedida(ps, "porPlanejamento")}`} />
        <div className="grafico"><Barras modo="empilhado100" rotulos={rot} series={series(ps, "porPlanejamento")} /></div>
        <Faixa slide="comp-plan" />
      </Slide>,
    );
  }

  if (!scrum && ps.some((p) => Object.keys(p.porPlanejamento).length)) {
    slides.push(
      <Slide key="comp-urgencia" rodape={rodape} demo={d.demo}>
        <Cabecalho t={t} eyebrow="COMPOSIÇÃO" titulo="Itens padrão e urgentes" sub={`Proporção por classe de serviço${notaMedida(ps, "porPlanejamento")}`} />
        <div className="grafico"><Barras modo="empilhado100" rotulos={rot} series={series(ps, "porPlanejamento")} /></div>
        <Faixa slide="comp-urgencia" />
      </Slide>,
    );
  }

  slides.push(
    <Slide key="comp-tipo" rodape={rodape} demo={d.demo}>
      <Cabecalho t={t} eyebrow="COMPOSIÇÃO" titulo="Proporção dos pontos por tipo de item" sub={`Comparativo entre ${unidade.toLowerCase()} do trimestre${notaMedida(ps, "porTipo")}`} />
      <div className="grafico"><Barras modo="empilhado100" rotulos={rot} series={series(ps, "porTipo", TIPOS)} /></div>
      <Faixa slide="comp-tipo" />
    </Slide>,
    <Slide key="roadmap" rodape={rodape} demo={d.demo}>
      <Cabecalho t={t} eyebrow="ROADMAP" titulo="Proporção dos pontos por categoria de roadmap" sub={`Realizado (entrega)${notaMedida(ps, "porRoadmap")}`} />
      <div className="grafico"><Barras modo="empilhado100" rotulos={rot} series={series(ps, "porRoadmap")} /></div>
      <Faixa slide="roadmap" />
    </Slide>,
    <Slide key="suporte" rodape={`${nomeDoTime(t)} · Suporte · Área TAP · Grupo Salta Educação`} demo={d.demo}>
      <Cabecalho t={t} eyebrow="SUPORTE" titulo="Chamados resolvidos" sub={`Por nível · ${t.perfil.suporte.filter((f) => f.papel === "chamado").map((f) => f.projeto).join(", ")}`} />
      <div className="grafico metade"><h3>Chamados por nível</h3>
        <Barras largura={560} rotulos={rot} series={[
          { nome: "N2", valores: ps.map((p) => (p.chamados == null ? null : p.chamados - (p.chamadosN3 ?? 0))) },
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
  // Períodos só do histórico não têm composição nem suporte: slides sem nenhum dado saem do deck.
  const vazio = (campo: "porPlanejamento" | "porTipo" | "porRoadmap") => ps.every((p) => !Object.keys(p[campo]).length);
  const sem: Record<string, boolean> = {
    "comp-plan": vazio("porPlanejamento"), "comp-tipo": vazio("porTipo"), roadmap: vazio("porRoadmap"),
    suporte: ps.every((p) => p.chamados == null), cycle: ps.every((p) => p.cycleP50 == null),
  };
  return slides.filter((el) => !sem[String(el.key)] && escolhidos.has(String(el.key)));
}

/**
 * Comparações que fazem sentido entre a fase Scrum e a fase Kanban, numa linha do tempo única.
 * Sprints viram taxa semanal (itens e chamados ÷ semanas da sprint). Pontos e entrega % ficam de fora.
 */
function slideTransicao(d: DadosDeck, scrum: DadosTime, kanban: DadosTime) {
  const semanas = (p: Indicadores) => Math.max(1, Math.round((Date.parse(p.periodo.fim) - Date.parse(p.periodo.inicio)) / (7 * 86400000)));
  const ps = [...scrum.periodos, ...kanban.periodos];
  const rot = ps.map((p) => (p.periodo.tipo === "sprint" ? `S${rotulo(p)}` : rotulo(p)));
  const porSemana = (p: Indicadores, v: number | null) => (v == null ? null : semanas(p) > 1 ? Math.round((v / semanas(p)) * 10) / 10 : v);
  const marco = scrum.periodos.length - 0.5;
  const nome = nomeDoTime({ ...kanban, fase: undefined });
  const L = (slide: string) => (
    <Leitura deck={d.deck} time={nome} slide={slide} inicial={d.leituras[chaveLeitura(nome, slide)]} demo={d.demo} />
  );
  return (
    <Slide key={`transicao-${nome}`} rodape={`${nome} · Transição Scrum → Kanban · Área TAP · Grupo Salta Educação`} demo={d.demo}>
      <div className="trilha">Sync de Agilidade &gt; {nome} &gt; <b>Transição Scrum → Kanban</b></div>
      <h1>O que mudou com o Kanban</h1>
      <div className="subtitulo">Só indicadores comparáveis entre as fases · sprints convertidas em taxa semanal · linha tracejada = migração</div>
      <div className="quadro4">
        <div><h3>Itens entregues por semana</h3><Linhas largura={560} altura={190} rotulos={rot} marco={marco} series={[{ nome: "Itens/semana", valores: ps.map((p) => porSemana(p, p.itensEntregues)) }]} formato={num} /></div>
        <div><h3>Tempo de ciclo P50 (dias úteis)</h3><Linhas largura={560} altura={190} rotulos={rot} marco={marco} series={[{ nome: "P50", valores: ps.map((p) => p.cycleP50) }, { nome: "P85", valores: ps.map((p) => p.cycleP85), cor: "#007875" }]} formato={num} /></div>
        <div><h3>Chamados resolvidos por semana</h3><Linhas largura={560} altura={190} rotulos={rot} marco={marco} series={[{ nome: "Chamados/semana", valores: ps.map((p) => porSemana(p, p.chamados)) }]} formato={num} /></div>
        <div><h3>Moral do time</h3><Linhas largura={560} altura={190} rotulos={rot} marco={marco} series={[{ nome: "Produtividade", valores: ps.map((p) => p.produtividade) }, { nome: "Motivação", valores: ps.map((p) => p.motivacao), cor: "#007875" }]} formato={pct} /></div>
      </div>
      <div className="faixa"><b>Leitura:</b>{L("transicao")}</div>
    </Slide>
  );
}

/** Deck a partir dos parâmetros (vindos da URL antiga ou de um deck salvo). `voltar`: destino da "Seleção de times". */
export async function renderizarDeck(q: Record<string, string | undefined>, voltarPara?: string) {
  const deck = q.trimestre ?? trimestreAtual();
  const projetos = q.times ? q.times.split(",").map((s) => s.trim().toUpperCase()) : PERFIS.map((p) => p.projeto);
  const demo = q.demo === "1" || q.demo === "misto" || (!urlBanco());
  const recortes = recortesDaUrl(q);
  const escolhidos = slidesDaUrl(q.slides);
  // Volta para a página inicial com a mesma seleção (times, trimestre, frentes e recortes).
  const voltar = voltarPara ?? `/?${new URLSearchParams(Object.entries(q).filter(([k, v]) => v && k !== "demo") as [string, string][]).toString()}`;
  const d = demo ? deckDemo(deck, projetos, recortes, q.demo === "misto") : await carregarDeck(deck, projetos, recortes);

  return (
    <div className={fonte.variable}>
      <Deck voltar={voltar} imprimir={q.imprimir === "1"}>
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
        {d.times.flatMap((t, i) => {
          const s = slidesDoTime(d, t, escolhidos);
          const ant = d.times[i - 1];
          // Depois do bloco Kanban de um time que também teve bloco Scrum no recorte: slide de transição.
          return t.fase === "kanban" && ant?.fase === "scrum" && ant.perfil === t.perfil && ant.frente === t.frente
            ? [...s, ...(escolhidos.has("transicao") ? [slideTransicao(d, ant, t)] : [])] : s;
        })}
        <section className="slide verde" key="fim">
          <Grafismo tipo="linhas" />
          <div className="capa"><h1>Obrigado!</h1></div>
          <span className="assinatura" aria-label="Grupo Salta" />
        </section>
      </Deck>
    </div>
  );
}
