"use client";
import { useEffect, useMemo, useState } from "react";
import { CAMPOS, lerCsv, montarLinhas, normalizar, sugerirMapa, type Campo } from "@/lib/importacao";

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

  const cabecalho = dados[linhaTitulo - 1] ?? [];

  // Mapa: o salvo na última importação desta fonte (pelo título) e, no que faltar, a sugestão automática.
  useEffect(() => {
    if (!cabecalho.length) return;
    const sugestao = sugerirMapa(cabecalho);
    fetch(`/api/historico?fonte=${fonte}`).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((salvo) => {
      const doSalvo: Partial<Record<Campo, number>> = {};
      for (const [campo, titulo] of Object.entries((salvo?.mapa ?? {}) as Record<string, string>)) {
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
      timePadrao: time ? { time, frente: frente || undefined } : undefined,
    });
  }, [dados, linhaTitulo, mapa, fonte, timePadrao]);

  async function abrir(f: File | undefined) {
    if (!f) return;
    setArquivo(f.name);
    setEstado("");
    setDados(lerCsv(await f.text()));
  }

  async function importar() {
    if (!resultado?.linhas.length) return;
    setEstado("importando…");
    const lote = 200;
    let total = 0;
    for (let i = 0; i < resultado.linhas.length; i += lote) {
      const r = await fetch("/api/historico", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ fonte, linhaTitulo, mapa, cabecalho, linhas: resultado.linhas.slice(i, i + lote) }),
      });
      if (!r.ok) { setEstado(`erro ao gravar: ${await r.text()}`); return; }
      total += (await r.json()).gravadas;
    }
    setEstado(`${total} período(s) importado(s).`);
  }

  const fmt = (v: unknown) => (v == null ? "—" : typeof v === "number" ? String(Math.round(v * 1000) / 1000).replace(".", ",") : String(v));

  return (
    <div className="importador">
      <section className="card">
        <div className="campos-form">
          <label>Tipo de planilha
            <select value={fonte} onChange={(e) => { const f = e.target.value as Fonte; setFonte(f); setLinhaTitulo(FONTES[f].linha); }}>
              {Object.entries(FONTES).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
            </select>
          </label>
          <label>Arquivo CSV <input type="file" accept=".csv,text/csv" onChange={(e) => abrir(e.target.files?.[0])} /></label>
          <label>Linha do cabeçalho
            <input type="number" min={1} max={Math.max(1, dados.length)} value={linhaTitulo} onChange={(e) => setLinhaTitulo(Number(e.target.value) || 1)} />
          </label>
          <label>Time da planilha
            <select value={timePadrao} onChange={(e) => setTimePadrao(e.target.value)}>
              {TIMES_PADRAO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
            </select>
          </label>
        </div>
        {arquivo && <p className="sub">{arquivo}: {dados.length} linhas lidas.</p>}
      </section>

      {cabecalho.length > 0 && (
        <section className="card">
          <h2>Mapeamento de colunas</h2>
          <p className="sub">Reconhecidas pelo título da linha {linhaTitulo}. Ajuste o que estiver errado; campos sem coluna ficam vazios.</p>
          <div className="mapa">
            {CAMPOS.map(({ campo, rotulo }) => (
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
            ))}
          </div>
        </section>
      )}

      {resultado && (
        <section className="card">
          <h2>Prévia</h2>
          <p className="sub">{resultado.linhas.length} período(s) prontos{resultado.avisos.length ? ` · ${resultado.avisos.length} linha(s) ignorada(s)` : ""}.</p>
          <div className="tabela-rolagem">
            <table>
              <thead><tr><th>Time</th><th>Frente</th><th>Sprint/ciclo</th><th>Fim</th>{CAMPOS.slice(4).map((c) => <th key={c.campo} className="n">{c.rotulo}</th>)}</tr></thead>
              <tbody>
                {resultado.linhas.slice(0, 15).map((l) => (
                  <tr key={`${l.time}${l.frente}${l.nome}`}>
                    <td>{l.time}</td><td>{l.frente || "—"}</td><td>{l.nome}</td><td>{l.fim}</td>
                    {CAMPOS.slice(4).map((c) => <td key={c.campo} className="n">{fmt(l[c.campo as "pts_sdd"])}</td>)}
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
            <button type="button" className="botao" disabled={!resultado.linhas.length} onClick={importar}>Importar {resultado.linhas.length} período(s)</button>
            <span className="sub">{estado}</span>
          </div>
        </section>
      )}
    </div>
  );
}
