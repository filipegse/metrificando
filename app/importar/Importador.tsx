"use client";
import { Icone } from "../componentes/Icone";
import { useEffect, useMemo, useState } from "react";
import { lerUsuario } from "../dados/usuario";
import { AUXILIARES, CAMPOS, ROTULO_GRUPO, VERSAO_MAPA, type DefCampo, detectarCabecalho, lerCsv, montarLinhas, normalizar, sugerirMapa, type Campo } from "@/lib/importacao";

const FONTES = {
  dados_sprints: { rotulo: "Planilha de Métricas — aba Dados Sprints (Scrum)", tipo: "sprint" as const, dias: 14, linha: 3 },
  kanban: { rotulo: "Planilha de Métricas Kanban — aba Dados Ciclos", tipo: "semana" as const, dias: 7, linha: 3 },
  outra: { rotulo: "Outra planilha (Retaguarda, X-Retaguarda, Contas a Pagar…)", tipo: "sprint" as const, dias: 14, linha: 1 },
};
type Fonte = keyof typeof FONTES;

const TIMES_PADRAO = [
  { rotulo: "(pela coluna de time ou pelo nome da sprint)", valor: "" },
  { rotulo: "Retaguarda — frente Retaguarda", valor: "Retaguarda|Retaguarda" },
  { rotulo: "Retaguarda — frente X-Retaguarda", valor: "Retaguarda|X-Retaguarda" },
  { rotulo: "Contas a Pagar", valor: "Contas a Pagar|" },
];

export function Importador() {
  const [fonte, setFonte] = useState<Fonte>("dados_sprints");
  const [dados, setDados] = useState<string[][]>([]);
  const [arquivo, setArquivo] = useState("");
  const [linhaTitulo, setLinhaTitulo] = useState(FONTES.dados_sprints.linha);
  const [mapa, setMapa] = useState<Partial<Record<Campo, number>>>({});
  const [timePadrao, setTimePadrao] = useState("");
  const [estado, setEstado] = useState("");
  const [unidade, setUnidade] = useState<"auto" | "horas" | "dias">("auto");

  const cabecalho = dados[linhaTitulo - 1] ?? [];

  // Mapa: o salvo na última importação desta fonte (pelo título) e, no que faltar, a sugestão automática.
  useEffect(() => {
    if (!cabecalho.length) return;
    const sugestao = sugerirMapa(cabecalho);
    fetch(`/api/historico?fonte=${fonte}`).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((salvo) => {
      // Mapeamento salvo (só da versão atual das regras) sobrepõe a sugestão: é o que você confirmou da última vez.
      const doSalvo: Partial<Record<Campo, number>> = {};
      const salvoValido = salvo?.mapa?._v === VERSAO_MAPA ? (salvo.mapa as Record<string, string>) : {};
      for (const [campo, titulo] of Object.entries(salvoValido)) {
        if (campo === "_v") continue;
        const i = cabecalho.findIndex((t) => normalizar(t) === normalizar(titulo));
        if (i >= 0) doSalvo[campo as Campo] = i;
      }
      setMapa({ ...sugestao, ...doSalvo });
    });
  }, [dados, linhaTitulo, fonte]); // eslint-disable-line react-hooks/exhaustive-deps

  const resultado = useMemo(() => {
    if (!dados.length) return null;
    const [time, frente] = timePadrao.split("|");
    return montarLinhas(dados, linhaTitulo, mapa, {
      tipo: FONTES[fonte].tipo, duracaoDias: FONTES[fonte].dias,
      timePadrao: time ? { time, frente: frente || undefined } : undefined, unidadeCiclo: unidade,
    });
  }, [dados, linhaTitulo, mapa, fonte, timePadrao, unidade]);

  async function abrir(f: File | undefined) {
    if (!f) return;
    setArquivo(f.name);
    setEstado("");
    const lidos = lerCsv(await f.text());
    setDados(lidos);
    // Linha do cabeçalho detectada pelos títulos (ajustável no campo ao lado).
    setLinhaTitulo(detectarCabecalho(lidos));
  }

  async function importar() {
    if (!resultado?.linhas.length) return;
    setEstado("importando…");
    const lote = 200;
    let total = 0;
    for (let i = 0; i < resultado.linhas.length; i += lote) {
      const r = await fetch("/api/historico", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ fonte, linhaTitulo, mapa, cabecalho, linhas: resultado.linhas.slice(i, i + lote), usuario: lerUsuario() }),
      });
      if (!r.ok) { setEstado(`erro ao gravar: ${await r.text()}`); return; }
      total += (await r.json()).gravadas;
    }
    setEstado(`${total} período(s) importado(s). Confira e corrija em Dados históricos.`);
  }

  // Percentuais na prévia como na planilha (92%), para conferir antes de importar.
  const pct = (v: unknown) => (v == null ? "—" : `${String(Math.round(Number(v) * 1000) / 10).replace(".", ",")}%`);
  const fmt = (v: unknown) => (v == null ? "—" : typeof v === "number" ? String(Math.round(v * 1000) / 1000).replace(".", ",") : String(v));

  const campoMapa = ({ campo, rotulo }: DefCampo) => (
    <label key={campo} className={mapa[campo] === undefined ? "faltando" : ""}>
      {rotulo}
      <select value={mapa[campo] ?? ""} onChange={(e) => setMapa((m) => {
        const n = { ...m };
        if (e.target.value === "") delete n[campo]; else n[campo] = Number(e.target.value);
        return n;
      })}>
        <option value="">— sem coluna —</option>
        {cabecalho.map((t, i) => t.trim() && <option key={i} value={i}>{t}</option>)}
      </select>
    </label>
  );
  // Prévia: indicadores + uma coluna-resumo por grupo de composição (evita 22 colunas a mais).
  const colunasPrevia = CAMPOS.slice(4).filter((c) => !AUXILIARES.includes(c.campo) && !c.grupo);
  const resumoGrupo = (l: Record<string, unknown>, g: string) => {
    const partes = CAMPOS.filter((c) => c.grupo === g && l[c.campo] != null).map((c) => `${c.rotulo.replace(" · pontos", " pts").replace(" · itens", " it.")}: ${fmt(l[c.campo])}`);
    return partes.length ? partes.join(" · ") : "—";
  };

  return (
    <div className="importador">
      <section className="card">
        <div className="campos-form">
          <label>Tipo de planilha
            <select value={fonte} onChange={(e) => { const f = e.target.value as Fonte; setFonte(f); setLinhaTitulo(FONTES[f].linha); }}>
              {Object.entries(FONTES).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
            </select>
          </label>
          <label>Arquivo CSV
            <span className="arquivo">
              <span className="botao secundario"><Icone nome="importar" tamanho={16} /> Escolher arquivo</span>
              <span className="nome-arquivo">{arquivo || "nenhum arquivo selecionado"}</span>
              <input type="file" accept=".csv,text/csv" onChange={(e) => abrir(e.target.files?.[0])} />
            </span>
          </label>
          <label>Linha do cabeçalho
            <input type="number" min={1} max={Math.max(1, dados.length)} value={linhaTitulo} onChange={(e) => setLinhaTitulo(Number(e.target.value) || 1)} />
          </label>
          <label>Unidade do tempo de ciclo
            <select value={unidade} onChange={(e) => setUnidade(e.target.value as typeof unidade)}>
              <option value="auto">Detectar{resultado?.unidadeCiclo ? ` (${resultado.unidadeCiclo === "horas" ? "horas úteis" : "dias úteis"})` : ""}</option>
              <option value="horas">Horas úteis (÷ 9,8 → dias úteis)</option>
              <option value="dias">Dias úteis</option>
            </select>
          </label>
          <label>Time da planilha
            <select value={timePadrao} onChange={(e) => setTimePadrao(e.target.value)}>
              {TIMES_PADRAO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
            </select>
          </label>
        </div>
        {arquivo && <p className="sub">{dados.length} linhas lidas.</p>}
      </section>

      {cabecalho.length > 0 && (
        <section className="card">
          <h2>Mapeamento de colunas</h2>
          <p className="sub">Reconhecidas pelo título da linha {linhaTitulo}. Ajuste o que estiver errado. Na reimportação, só os campos mapeados aqui são atualizados; os demais mantêm o valor já gravado.</p>
          <div className="mapa">{CAMPOS.filter((c) => !c.grupo).map(campoMapa)}</div>
          {(["tipo", "planejamento", "roadmap"] as const).map((g) => {
            const campos = CAMPOS.filter((c) => c.grupo === g);
            const n = campos.filter((c) => mapa[c.campo] !== undefined).length;
            return (
              <details key={g} className="grupo-mapa" open={n > 0}>
                <summary>{ROTULO_GRUPO[g]} <span className="sub">({n} de {campos.length} colunas reconhecidas · pontos e itens concluídos)</span></summary>
                <div className="mapa">{campos.map(campoMapa)}</div>
              </details>
            );
          })}
        </section>
      )}

      {resultado && (
        <section className="card">
          <h2>Prévia</h2>
          <p className="sub">{resultado.linhas.length} período(s) prontos{resultado.avisos.length ? ` · ${resultado.avisos.length} linha(s) ignorada(s)` : ""}.</p>
          <div className="tabela-rolagem">
            <table>
              <thead><tr><th>Time</th><th>Frente</th><th>Sprint/ciclo</th><th>Fim</th>{colunasPrevia.map((c) => <th key={c.campo} className="n">{c.rotulo}</th>)}<th>Tipo de item</th><th>Planejamento</th><th>Roadmap</th></tr></thead>
              <tbody>
                {resultado.linhas.slice(0, 15).map((l) => (
                  <tr key={`${l.time}${l.frente}${l.nome}`}>
                    <td>{l.time}</td><td>{l.frente || "—"}</td><td>{l.nome}</td><td>{l.fim}</td>
                    {colunasPrevia.map((c) => <td key={c.campo} className="n">{c.tipo === "fracao" || c.tipo === "escala" ? pct(l[c.campo as "entrega"]) : fmt(l[c.campo as "pts_sdd"])}</td>)}
                    {(["tipo", "planejamento", "roadmap"] as const).map((g) => <td key={g} className="resumo-grupo">{resumoGrupo(l as Record<string, unknown>, g)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {resultado.avisos.length > 0 && (
            <details><summary>Linhas ignoradas</summary>
              <ul>{resultado.avisos.slice(0, 50).map((a) => <li key={a.linha}>Linha {a.linha}: {a.motivo}</li>)}</ul>
            </details>
          )}
          <div className="acoes">
            <button type="button" className="botao" disabled={!resultado.linhas.length} onClick={importar}><Icone nome="importar" /> Importar {resultado.linhas.length} período(s)</button>
            <span className="sub">{estado}</span>
          </div>
        </section>
      )}
    </div>
  );
}
