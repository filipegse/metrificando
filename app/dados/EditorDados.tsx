"use client";
import { Icone } from "../componentes/Icone";
import { useCallback, useEffect, useMemo, useState } from "react";
import { lerUsuario, salvarUsuario } from "./usuario";

type Linha = Record<string, string | number | null> & { time: string; frente: string; nome: string };
type Registro = { id: number; quando: string; usuario: string; acao: string; frente: string; nome: string;
  mudancas: Record<string, [unknown, unknown]>; revertida_em: string | null; revertida_por: string | null; reverte_id: number | null };

// Colunas editáveis. "fracao" é guardada como 0–1 e editada em %.
const COLUNAS: { campo: string; rotulo: string; tipo: "texto" | "data" | "numero" | "fracao" | "tipo" }[] = [
  { campo: "nome", rotulo: "Sprint / ciclo", tipo: "texto" },
  { campo: "tipo", rotulo: "Tipo", tipo: "tipo" },
  { campo: "inicio", rotulo: "Início", tipo: "data" },
  { campo: "fim", rotulo: "Fim", tipo: "data" },
  { campo: "entrega", rotulo: "Entrega %", tipo: "fracao" },
  { campo: "extras", rotulo: "Extras %", tipo: "fracao" },
  { campo: "pts_sdd", rotulo: "Pts COM SDD", tipo: "numero" },
  { campo: "esforco_sdd", rotulo: "Esforço COM SDD", tipo: "numero" },
  { campo: "pts_sem_sdd", rotulo: "Pts SEM SDD", tipo: "numero" },
  { campo: "esforco_sem_sdd", rotulo: "Esforço SEM SDD", tipo: "numero" },
  { campo: "ganho_sdd", rotulo: "Ganho SDD %", tipo: "fracao" },
  { campo: "itens_entregues", rotulo: "Itens", tipo: "numero" },
  { campo: "cycle_p50", rotulo: "Ciclo P50", tipo: "numero" },
  { campo: "cycle_p85", rotulo: "Ciclo P85", tipo: "numero" },
  { campo: "produtividade", rotulo: "Produtiv. %", tipo: "fracao" },
  { campo: "motivacao", rotulo: "Motivação %", tipo: "fracao" },
];
const TIPO_DE = Object.fromEntries(COLUNAS.map((c) => [c.campo, c.tipo]));
const ROTULO_DE: Record<string, string> = Object.fromEntries(COLUNAS.map((c) => [c.campo, c.rotulo]));

/** Valor do banco → texto do campo. */
function paraTela(campo: string, v: unknown): string {
  if (v == null) return "";
  if (TIPO_DE[campo] === "fracao") return String(Math.round(Number(v) * 10000) / 100).replace(".", ",");
  if (TIPO_DE[campo] === "numero") return String(v).replace(".", ",");
  return String(v);
}
/** Texto do campo → valor do banco. */
function paraBanco(campo: string, t: string): string | number | null {
  const s = t.trim();
  if (!s) return null;
  if (TIPO_DE[campo] === "fracao" || TIPO_DE[campo] === "numero") {
    const n = Number(s.replace("%", "").replace(",", "."));
    if (!Number.isFinite(n)) return NaN;
    return TIPO_DE[campo] === "fracao" ? n / 100 : n;
  }
  return s;
}
const exibir = (campo: string, v: unknown) => (v == null || v === "" ? "vazio" : TIPO_DE[campo] === "fracao" ? `${paraTela(campo, v)}%` : paraTela(campo, v));
const dataHora = (s: string) => new Date(s).toLocaleString("pt-BR", { timeZone: "America/Bahia", dateStyle: "short", timeStyle: "short" });
const ACOES: Record<string, string> = { importacao: "Importação", edicao: "Edição", exclusao: "Exclusão", reversao: "Desfeito" };

export function EditorDados({ times, inicial }: { times: { time: string; frentes: string[] }[]; inicial?: string }) {
  const [time, setTime] = useState(times.some((t) => t.time === inicial) ? inicial! : times[0].time);
  const [frente, setFrente] = useState<string>("*");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [rascunho, setRascunho] = useState<Record<string, Record<string, string>>>({});
  const [auditoria, setAuditoria] = useState<Registro[]>([]);
  const [usuario, setUsuario] = useState("");
  const [msg, setMsg] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => setUsuario(lerUsuario()), []);
  const chaveDe = (l: Linha) => `${l.frente}|${l.nome}`;
  const frentes = times.find((t) => t.time === time)?.frentes ?? [];

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [l, a] = await Promise.all([
        fetch(`/api/historico/linhas?time=${encodeURIComponent(time)}`).then((r) => r.json()),
        fetch(`/api/historico/auditoria?time=${encodeURIComponent(time)}`).then((r) => r.json()),
      ]);
      setLinhas(Array.isArray(l) ? l : []); setAuditoria(Array.isArray(a) ? a : []); setRascunho({});
    } catch (e) { setMsg(`Não foi possível carregar: ${(e as Error).message}`); }
    setCarregando(false);
  }, [time]);
  useEffect(() => { recarregar(); history.replaceState(null, "", `?time=${encodeURIComponent(time)}`); }, [recarregar, time]);

  const visiveis = useMemo(() => linhas.filter((l) => frente === "*" || l.frente === frente), [linhas, frente]);
  const semNome = !usuario.trim();

  async function chamar(url: string, metodo: string, corpo: object, ok: string) {
    if (semNome) { setMsg("Informe seu nome antes de alterar os dados (fica registrado na auditoria)."); return false; }
    const r = await fetch(url, { method: metodo, headers: { "content-type": "application/json" }, body: JSON.stringify({ ...corpo, usuario }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(`Erro: ${j.erro ?? r.status}`); return false; }
    setMsg(ok); await recarregar(); return true;
  }

  async function salvar(l: Linha) {
    const r = rascunho[chaveDe(l)] ?? {};
    const alteracoes: Record<string, unknown> = {};
    for (const [c, t] of Object.entries(r)) {
      const v = paraBanco(c, t);
      if (Number.isNaN(v)) { setMsg(`Valor inválido em "${ROTULO_DE[c]}": ${t}`); return; }
      alteracoes[c] = v;
    }
    await chamar("/api/historico/linhas", "PATCH", { chave: { time: l.time, frente: l.frente, nome: l.nome }, alteracoes }, `Linha "${l.nome}" salva.`);
  }

  return (
    <div className="editor">
      <section className="card filtros">
        <label>Time <select value={time} onChange={(e) => { setTime(e.target.value); setFrente("*"); }}>{times.map((t) => <option key={t.time}>{t.time}</option>)}</select></label>
        <label>Frente
          <select value={frente} onChange={(e) => setFrente(e.target.value)}>
            <option value="*">Todas</option><option value="">Time inteiro</option>
            {frentes.map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        <label>Seu nome (registrado nas alterações)
          <input value={usuario} placeholder="Ex.: Filipe" onChange={(e) => { setUsuario(e.target.value); salvarUsuario(e.target.value); }} className={semNome ? "obrigatorio" : ""} />
        </label>
        <span className="sub">{carregando ? "carregando…" : `${visiveis.length} período(s)`}</span>
        <button type="button" className="link perigo" disabled={!visiveis.length} onClick={() => {
          const alvo = frente === "*" ? `todos os períodos de ${time}` : `os períodos de ${time}${frente ? ` · ${frente}` : " (time inteiro)"}`;
          if (confirm(`Apagar ${alvo}? Fica registrado e pode ser desfeito linha a linha.`)) {
            chamar("/api/historico/linhas", "DELETE", { todas: true, chave: { time, frente: frente === "*" ? undefined : frente } }, "Períodos apagados.");
          }
        }}><Icone nome="lixeira" tamanho={16} /> Apagar todos os exibidos</button>
      </section>
      {msg && <p className="msg">{msg}</p>}

      <section className="card">
        <div className="tabela-rolagem">
          <table className="editavel">
            <thead><tr><th>Frente</th>{COLUNAS.map((c) => <th key={c.campo}>{c.rotulo}</th>)}<th /></tr></thead>
            <tbody>
              {visiveis.map((l) => {
                const k = chaveDe(l), r = rascunho[k] ?? {}, sujo = Object.keys(r).length > 0;
                return (
                  <tr key={k} className={sujo ? "sujo" : ""}>
                    <td className="frente">{l.frente || "—"}</td>
                    {COLUNAS.map((c) => {
                      const valor = r[c.campo] ?? paraTela(c.campo, l[c.campo]);
                      const mudar = (v: string) => setRascunho((x) => ({ ...x, [k]: { ...x[k], [c.campo]: v } }));
                      return (
                        <td key={c.campo} className={r[c.campo] !== undefined ? "alterada" : ""}>
                          {c.tipo === "tipo" ? (
                            <select value={valor} onChange={(e) => mudar(e.target.value)}><option value="sprint">sprint</option><option value="semana">semana</option></select>
                          ) : (
                            <input type={c.tipo === "data" ? "date" : "text"} value={valor} onChange={(e) => mudar(e.target.value)}
                              inputMode={c.tipo === "numero" || c.tipo === "fracao" ? "decimal" : undefined} className={`c-${c.tipo}`} />
                          )}
                        </td>
                      );
                    })}
                    <td className="acoes-linha">
                      <button type="button" className="botao pequeno" disabled={!sujo} onClick={() => salvar(l)}><Icone nome="salvar" tamanho={14} /> Salvar</button>
                      {sujo && <button type="button" className="link" onClick={() => setRascunho((x) => { const n = { ...x }; delete n[k]; return n; })}>descartar</button>}
                      <button type="button" className="link perigo" onClick={() => confirm(`Apagar "${l.nome}"?`) &&
                        chamar("/api/historico/linhas", "DELETE", { chave: { time: l.time, frente: l.frente, nome: l.nome } }, `"${l.nome}" apagada.`)} title="Apagar período" aria-label="Apagar período"><Icone nome="lixeira" tamanho={16} /></button>
                    </td>
                  </tr>
                );
              })}
              {!visiveis.length && !carregando && <tr><td colSpan={COLUNAS.length + 2} className="vazio">Nenhum período importado para esse filtro.</td></tr>}
            </tbody>
          </table>
        </div>
        <NovaLinha time={time} frentes={frentes} criar={(linha) => chamar("/api/historico/linhas", "POST", { linha }, `"${linha.nome}" criada.`)} />
      </section>

      <section className="card">
        <h2>Alterações de {time}</h2>
        <p className="sub">Mais recentes primeiro. "Desfazer" devolve a linha ao estado anterior àquela alteração (e também fica registrado).</p>
        <div className="tabela-rolagem">
          <table>
            <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Período</th><th>O que mudou</th><th /></tr></thead>
            <tbody>
              {auditoria.map((a) => {
                const campos = Object.entries(a.mudancas).filter(([c]) => c !== "nome" || a.acao === "edicao");
                return (
                  <tr key={a.id} className={a.revertida_em ? "encerrada" : ""}>
                    <td>{dataHora(a.quando)}</td><td>{a.usuario}</td><td>{ACOES[a.acao] ?? a.acao}</td>
                    <td>{a.nome}{a.frente ? ` · ${a.frente}` : ""}</td>
                    <td className="mudancas">
                      {a.acao === "exclusao" ? "linha apagada" : campos.length > 6 && a.acao !== "edicao" ? `${campos.length} campos (linha ${a.acao === "importacao" ? "importada" : "restaurada"})`
                        : campos.map(([c, [x, y]]) => <div key={c}><b>{ROTULO_DE[c] ?? c}:</b> {exibir(c, x)} → {exibir(c, y)}</div>)}
                    </td>
                    <td className="acoes-linha">
                      {a.revertida_em ? <span className="sub">desfeita por {a.revertida_por}</span>
                        : a.acao !== "reversao" && <button type="button" className="link" onClick={async () => {
                          const r = await fetch("/api/historico/auditoria", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: a.id, usuario }) });
                          const j = await r.json().catch(() => ({}));
                          if (r.status === 409 && j.conflito && confirm(`${j.erro}. Desfazer mesmo assim (descarta as alterações posteriores dessa linha)?`)) {
                            await chamar("/api/historico/auditoria", "POST", { id: a.id, forcar: true }, "Alteração desfeita.");
                          } else if (!r.ok) setMsg(`Erro: ${j.erro ?? r.status}`);
                          else { setMsg("Alteração desfeita."); recarregar(); }
                        }} disabled={semNome}><Icone nome="desfazer" tamanho={16} /> desfazer</button>}
                    </td>
                  </tr>
                );
              })}
              {!auditoria.length && <tr><td colSpan={6} className="vazio">Sem alterações registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function NovaLinha({ time, frentes, criar }: { time: string; frentes: string[]; criar: (l: Record<string, unknown> & { nome: string }) => Promise<boolean> }) {
  const [aberto, setAberto] = useState(false);
  if (!aberto) return <button type="button" className="link" onClick={() => setAberto(true)}><Icone nome="mais" tamanho={16} /> Adicionar período</button>;
  return (
    <form className="linha-form" onSubmit={async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      if (await criar({ time, frente: v.frente, nome: v.nome, tipo: v.tipo, inicio: v.inicio || null, fim: v.fim })) setAberto(false);
    }}>
      <label>Frente <select name="frente"><option value="">Time inteiro</option>{frentes.map((f) => <option key={f}>{f}</option>)}</select></label>
      <label>Sprint / ciclo <input name="nome" placeholder="Ex.: S112 1.Q1.26" required /></label>
      <label>Tipo <select name="tipo"><option value="sprint">sprint</option><option value="semana">semana</option></select></label>
      <label>Início <input name="inicio" type="date" /></label>
      <label>Fim <input name="fim" type="date" required /></label>
      <button className="botao"><Icone nome="mais" tamanho={16} /> Criar</button>
      <button type="button" className="link" onClick={() => setAberto(false)}>cancelar</button>
    </form>
  );
}
