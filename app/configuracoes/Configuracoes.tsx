"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Expediente = { valido_de: string; inicio: string; fim: string };
type Feriado = { data: string; nome: string; abrangencia: string };
type Alocacao = { id: number; time: string; frente: string; cargo: string; percentual: number; inicio: string; fim: string | null };
type Pessoa = { id: number; nome: string; alocacoes: Alocacao[] };
type Ausencia = { id: number; pessoa_id: number; nome: string; inicio: string; fim: string; tipo: string };

const CARGOS = ["Dev", "TL", "PM", "QA", "PD", "Suporte técnico", "Agilista"];
const ABRANGENCIAS: Record<string, string> = {
  nacional: "Nacional", estadual_rj: "Estadual (RJ)", municipal_rj: "Municipal (Rio)", evento_interno: "Evento interno", folga: "Folga / ponto facultativo",
};
const dataBR = (d?: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const hoje = () => new Date().toISOString().slice(0, 10);

async function api(tabela: string, metodo = "GET", corpo?: unknown, chave?: string) {
  const r = await fetch(`/api/config/${tabela}${chave ? `?chave=${encodeURIComponent(chave)}` : ""}`, {
    method: metodo, headers: { "content-type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? `erro ${r.status}`);
  return r.json();
}

function formulario(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
}

export function Configuracoes({ times }: { times: { time: string; frentes: string[] }[] }) {
  const [aba, setAba] = useState<"expediente" | "feriados" | "pessoas" | "ausencias">("pessoas");
  const [exp, setExp] = useState<Expediente[]>([]);
  const [fer, setFer] = useState<Feriado[]>([]);
  const [pes, setPes] = useState<Pessoa[]>([]);
  const [aus, setAus] = useState<Ausencia[]>([]);
  const [msg, setMsg] = useState("");
  const [timeForm, setTimeForm] = useState(times[0]?.time ?? "");

  const recarregar = useCallback(async () => {
    try {
      const [a, b, c, d] = await Promise.all([api("expedientes"), api("feriados"), api("pessoas"), api("ausencias")]);
      setExp(a); setFer(b); setPes(c); setAus(d);
    } catch (e) { setMsg(`Não foi possível carregar os cadastros (${(e as Error).message}).`); }
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);

  const executar = (f: () => Promise<unknown>, ok: string) => async () => {
    try { await f(); setMsg(ok); await recarregar(); } catch (e) { setMsg(`Erro: ${(e as Error).message}`); }
  };
  const enviar = (tabela: string, ok: string, extra?: (v: Record<string, string>) => Record<string, unknown>) => async (e: FormEvent<HTMLFormElement>) => {
    const v = formulario(e);
    const form = e.currentTarget;
    await executar(() => api(tabela, "POST", extra ? extra(v) : v), ok)();
    form.reset();
  };

  const frentesDo = (t: string) => times.find((x) => x.time === t)?.frentes ?? [];

  return (
    <div className="config">
      <nav className="abas">
        {([["pessoas", "Pessoas e alocações"], ["ausencias", "Ausências"], ["feriados", "Feriados"], ["expediente", "Expediente"]] as const).map(([k, r]) => (
          <button key={k} type="button" className={aba === k ? "ativa" : ""} onClick={() => setAba(k)}>{r}</button>
        ))}
      </nav>
      {msg && <p className="msg">{msg}</p>}

      {aba === "pessoas" && (
        <section className="card">
          <h2>Pessoas e alocações</h2>
          <p className="sub">Só cargo <b>Dev</b> entra na capacidade. Agilista, TL, PM, QA, PD e Suporte técnico ficam registrados para a composição do time. Mudou de time ou de cargo? Encerre a alocação atual e crie outra.</p>
          <form className="linha-form" onSubmit={enviar("pessoas", "Alocação salva.", (v) => ({ ...v, percentual: Number(v.percentual) / 100 }))}>
            <input name="nome" placeholder="Nome" required list="nomes" />
            <datalist id="nomes">{pes.map((p) => <option key={p.id} value={p.nome} />)}</datalist>
            <select name="cargo" required>{CARGOS.map((c) => <option key={c}>{c}</option>)}</select>
            <select name="time" value={timeForm} onChange={(e) => setTimeForm(e.target.value)}>{times.map((t) => <option key={t.time}>{t.time}</option>)}</select>
            <select name="frente"><option value="">Time inteiro</option>{frentesDo(timeForm).map((f) => <option key={f}>{f}</option>)}</select>
            <label>Alocação % <input name="percentual" type="number" min={10} max={100} step={10} defaultValue={100} /></label>
            <label>Entrada <input name="inicio" type="date" required defaultValue={hoje()} /></label>
            <label>Saída <input name="fim" type="date" /></label>
            <button className="botao">Adicionar</button>
          </form>
          <table>
            <thead><tr><th>Pessoa</th><th>Cargo</th><th>Time / frente</th><th className="n">Alocação</th><th>Entrada</th><th>Saída</th><th /></tr></thead>
            <tbody>
              {pes.flatMap((p) => (p.alocacoes.length ? p.alocacoes : [null]).map((a, i) => (
                <tr key={`${p.id}-${a?.id ?? "x"}`} className={a?.fim && a.fim < hoje() ? "encerrada" : ""}>
                  <td>{i === 0 ? p.nome : ""}</td>
                  <td>{a?.cargo ?? "—"}</td>
                  <td>{a ? `${a.time}${a.frente ? ` · ${a.frente}` : ""}` : "sem alocação"}</td>
                  <td className="n">{a ? `${Math.round(a.percentual * 100)}%` : ""}</td>
                  <td>{dataBR(a?.inicio)}</td>
                  <td>{a?.fim ? dataBR(a.fim) : a ? "vigente" : ""}</td>
                  <td className="acoes-linha">
                    {a && !a.fim && <button type="button" className="link" onClick={() => {
                      const fim = prompt("Data de saída (AAAA-MM-DD)", hoje());
                      if (fim) executar(() => api("alocacoes", "POST", { id: a.id, fim }), "Alocação encerrada.")();
                    }}>encerrar</button>}
                    {a && <button type="button" className="link perigo" onClick={() => confirm("Apagar esta alocação? (para histórico, prefira encerrar)") && executar(() => api("alocacoes", "DELETE", undefined, String(a.id)), "Alocação apagada.")()}>apagar</button>}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </section>
      )}

      {aba === "ausencias" && (
        <section className="card">
          <h2>Ausências</h2>
          <p className="sub">Férias, licenças e folgas. Os dias úteis ausentes saem da capacidade do time da pessoa naquele período.</p>
          <form className="linha-form" onSubmit={enviar("ausencias", "Ausência salva.", (v) => ({ ...v, pessoa_id: Number(v.pessoa_id) }))}>
            <select name="pessoa_id" required>{pes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
            <select name="tipo">{["Férias", "Licença", "Folga", "Outro"].map((t) => <option key={t}>{t}</option>)}</select>
            <label>De <input name="inicio" type="date" required /></label>
            <label>Até <input name="fim" type="date" required /></label>
            <button className="botao" disabled={!pes.length}>Adicionar</button>
          </form>
          <table>
            <thead><tr><th>Pessoa</th><th>Tipo</th><th>De</th><th>Até</th><th /></tr></thead>
            <tbody>{aus.map((a) => (
              <tr key={a.id}><td>{a.nome}</td><td>{a.tipo}</td><td>{dataBR(a.inicio)}</td><td>{dataBR(a.fim)}</td>
                <td className="acoes-linha"><button type="button" className="link perigo" onClick={executar(() => api("ausencias", "DELETE", undefined, String(a.id)), "Ausência apagada.")}>apagar</button></td></tr>
            ))}</tbody>
          </table>
        </section>
      )}

      {aba === "feriados" && (
        <section className="card">
          <h2>Feriados e folgas</h2>
          <p className="sub">Dias que não contam como úteis: nacionais, do Rio (estado e município), eventos internos e folgas.</p>
          <form className="linha-form" onSubmit={enviar("feriados", "Feriado salvo.")}>
            <input name="data" type="date" required />
            <input name="nome" placeholder="Nome" required />
            <select name="abrangencia">{Object.entries(ABRANGENCIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <button className="botao">Adicionar</button>
            <button type="button" className="link" onClick={executar(() => api("feriados", "POST", { carregar: "2026" }), "Calendário 2026 carregado.")}>Carregar calendário 2026 da TAP</button>
          </form>
          <table>
            <thead><tr><th>Data</th><th>Nome</th><th>Abrangência</th><th /></tr></thead>
            <tbody>{fer.map((f) => (
              <tr key={f.data}><td>{dataBR(f.data)}</td><td>{f.nome}</td><td>{ABRANGENCIAS[f.abrangencia] ?? f.abrangencia}</td>
                <td className="acoes-linha"><button type="button" className="link perigo" onClick={executar(() => api("feriados", "DELETE", undefined, f.data), "Feriado apagado.")}>apagar</button></td></tr>
            ))}</tbody>
          </table>
        </section>
      )}

      {aba === "expediente" && (
        <section className="card">
          <h2>Expediente</h2>
          <p className="sub">Horário usado no tempo útil. Cada linha vale a partir da data de vigência até a próxima. Para mudar o horário, adicione uma nova vigência (as anteriores seguem valendo para o histórico).</p>
          <form className="linha-form" onSubmit={enviar("expedientes", "Expediente salvo.")}>
            <label>Vigência a partir de <input name="valido_de" type="date" required /></label>
            <label>Início <input name="inicio" type="time" required defaultValue="09:00" /></label>
            <label>Fim <input name="fim" type="time" required defaultValue="18:48" /></label>
            <button className="botao">Adicionar</button>
          </form>
          <table>
            <thead><tr><th>A partir de</th><th>Início</th><th>Fim</th><th className="n">Jornada</th><th /></tr></thead>
            <tbody>{exp.map((e) => {
              const [hi, mi] = e.inicio.split(":").map(Number), [hf, mf] = e.fim.split(":").map(Number);
              const j = hf * 60 + mf - (hi * 60 + mi);
              return (
                <tr key={e.valido_de}><td>{e.valido_de === "2000-01-01" ? "sempre (padrão)" : dataBR(e.valido_de)}</td><td>{e.inicio}</td><td>{e.fim}</td>
                  <td className="n">{Math.floor(j / 60)}h{String(j % 60).padStart(2, "0")}</td>
                  <td className="acoes-linha">{e.valido_de !== "2000-01-01" && <button type="button" className="link perigo" onClick={executar(() => api("expedientes", "DELETE", undefined, e.valido_de), "Vigência apagada.")}>apagar</button>}</td></tr>
              );
            })}</tbody>
          </table>
        </section>
      )}
    </div>
  );
}
