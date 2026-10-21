"use client";
import { Icone } from "../componentes/Icone";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Gantt } from "./Gantt";

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
  const [aba, setAba] = useState<"calendario" | "expediente" | "feriados" | "pessoas" | "ausencias">("calendario");
  const [exp, setExp] = useState<Expediente[]>([]);
  const [fer, setFer] = useState<Feriado[]>([]);
  const [pes, setPes] = useState<Pessoa[]>([]);
  const [aus, setAus] = useState<Ausencia[]>([]);
  const [msg, setMsg] = useState("");
  const [timeForm, setTimeForm] = useState(times[0]?.time ?? "");
  const [anoFeriados, setAnoFeriados] = useState(new Date().getFullYear() + (new Date().getMonth() >= 10 ? 1 : 0));
  const [anoFiltro, setAnoFiltro] = useState<string>(String(new Date().getFullYear()));

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
        {([["calendario", "Calendário", "calendario"], ["pessoas", "Pessoas e alocações", "pessoas"], ["ausencias", "Ausências", "ausencia"], ["feriados", "Feriados", "bandeira"], ["expediente", "Expediente", "relogio"]] as const).map(([k, r, ic]) => (
          <button key={k} type="button" className={aba === k ? "ativa" : ""} onClick={() => setAba(k)}><Icone nome={ic} tamanho={16} /> {r}</button>
        ))}
      </nav>
      {msg && <p className="msg">{msg}</p>}

      {aba === "calendario" && <Gantt pessoas={pes} ausencias={aus} feriados={fer} times={times.map((t) => t.time)} />}

      {aba === "pessoas" && (
        <section className="card">
          <h2>Pessoas e alocações</h2>
          <p className="sub">Só cargo <b>Dev</b> entra na capacidade. Agilista, TL, PM, QA, PD e Suporte técnico ficam registrados para a composição do time. Mudou de time ou de cargo? Encerre a alocação atual e crie outra.</p>
          <form className="linha-form" onSubmit={enviar("pessoas", "Alocação salva.", (v) => ({ ...v, percentual: Number(v.percentual) / 100 }))}>
            <label>Pessoa <input name="nome" placeholder="Nome" required list="nomes" /></label>
            <datalist id="nomes">{pes.map((p) => <option key={p.id} value={p.nome} />)}</datalist>
            <label>Cargo <select name="cargo" required>{CARGOS.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Time <select name="time" value={timeForm} onChange={(e) => setTimeForm(e.target.value)}>{times.map((t) => <option key={t.time}>{t.time}</option>)}</select></label>
            <label>Frente <select name="frente"><option value="">Time inteiro</option>{frentesDo(timeForm).map((f) => <option key={f}>{f}</option>)}</select></label>
            <label>Alocação % <input name="percentual" type="number" min={10} max={100} step={10} defaultValue={100} /></label>
            <label>Entrada <input name="inicio" type="date" required defaultValue={hoje()} /></label>
            <label>Saída <input name="fim" type="date" /></label>
            <button className="botao"><Icone nome="mais" tamanho={16} /> Adicionar</button>
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
                    }}><Icone nome="check" tamanho={14} /> encerrar</button>}
                    {a && <button type="button" className="link perigo" title="Apagar" aria-label="Apagar" onClick={() => confirm("Apagar esta alocação? (para histórico, prefira encerrar)") && executar(() => api("alocacoes", "DELETE", undefined, String(a.id)), "Alocação apagada.")()}><Icone nome="lixeira" tamanho={16} /></button>}
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
            <label>Pessoa <select name="pessoa_id" required>{pes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
            <label>Tipo <select name="tipo">{["Férias", "Licença", "Folga", "Outro"].map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>De <input name="inicio" type="date" required /></label>
            <label>Até <input name="fim" type="date" required /></label>
            <button className="botao" disabled={!pes.length}><Icone nome="mais" tamanho={16} /> Adicionar</button>
          </form>
          <table>
            <thead><tr><th>Pessoa</th><th>Tipo</th><th>De</th><th>Até</th><th /></tr></thead>
            <tbody>{aus.map((a) => (
              <tr key={a.id}><td>{a.nome}</td><td>{a.tipo}</td><td>{dataBR(a.inicio)}</td><td>{dataBR(a.fim)}</td>
                <td className="acoes-linha"><button type="button" className="link perigo" title="Apagar" aria-label="Apagar" onClick={executar(() => api("ausencias", "DELETE", undefined, String(a.id)), "Ausência apagada.")}><Icone nome="lixeira" tamanho={16} /></button></td></tr>
            ))}</tbody>
          </table>
        </section>
      )}

      {aba === "feriados" && (
        <section className="card">
          <h2>Feriados e folgas</h2>
          <p className="sub">Dias que não contam como úteis: nacionais, do Rio (estado e município), eventos internos e folgas.</p>
          <form className="linha-form" onSubmit={enviar("feriados", "Feriado salvo.")}>
            <label>Data <input name="data" type="date" required /></label>
            <label>Nome <input name="nome" placeholder="Ex.: Festa da Empresa" required /></label>
            <label>Abrangência <select name="abrangencia">{Object.entries(ABRANGENCIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <button className="botao"><Icone nome="mais" tamanho={16} /> Adicionar</button>
          </form>
          <div className="linha-form">
            <label>Ano <input type="number" min={2000} max={2100} value={anoFeriados} onChange={(e) => setAnoFeriados(Number(e.target.value))} /></label>
            <button type="button" className="botao secundario" onClick={executar(() => api("feriados", "POST", { carregar: anoFeriados }), `Calendário ${anoFeriados} carregado.`)}><Icone nome="calendario" tamanho={16} />
              Carregar calendário padrão de {anoFeriados}
            </button>
            <span className="sub">Nacionais, Rio e folgas da TAP, com Carnaval, Paixão e Corpus Christi calculados pela Páscoa. Datas já cadastradas não são alteradas. Festa da Empresa e Encontro do setor variam: cadastre à mão.</span>
          </div>
          <div className="linha-form">
            <label>Mostrar <select value={anoFiltro} onChange={(e) => setAnoFiltro(e.target.value)}>
              <option value="">Todos os anos</option>
              {[...new Set(fer.map((f) => f.data.slice(0, 4)))].sort().map((a) => <option key={a}>{a}</option>)}
            </select></label>
          </div>
          <table>
            <thead><tr><th>Data</th><th>Nome</th><th>Abrangência</th><th /></tr></thead>
            <tbody>{fer.filter((f) => !anoFiltro || f.data.startsWith(anoFiltro)).map((f) => (
              <tr key={f.data}><td>{dataBR(f.data)}</td><td>{f.nome}</td><td>{ABRANGENCIAS[f.abrangencia] ?? f.abrangencia}</td>
                <td className="acoes-linha"><button type="button" className="link perigo" title="Apagar" aria-label="Apagar" onClick={executar(() => api("feriados", "DELETE", undefined, f.data), "Feriado apagado.")}><Icone nome="lixeira" tamanho={16} /></button></td></tr>
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
            <button className="botao"><Icone nome="mais" tamanho={16} /> Adicionar</button>
          </form>
          <table>
            <thead><tr><th>A partir de</th><th>Início</th><th>Fim</th><th className="n">Jornada</th><th /></tr></thead>
            <tbody>{exp.map((e) => {
              const [hi, mi] = e.inicio.split(":").map(Number), [hf, mf] = e.fim.split(":").map(Number);
              const j = hf * 60 + mf - (hi * 60 + mi);
              return (
                <tr key={e.valido_de}><td>{e.valido_de === "2000-01-01" ? "sempre (padrão)" : dataBR(e.valido_de)}</td><td>{e.inicio}</td><td>{e.fim}</td>
                  <td className="n">{Math.floor(j / 60)}h{String(j % 60).padStart(2, "0")}</td>
                  <td className="acoes-linha">{e.valido_de !== "2000-01-01" && <button type="button" className="link perigo" title="Apagar" aria-label="Apagar" onClick={executar(() => api("expedientes", "DELETE", undefined, e.valido_de), "Vigência apagada.")}><Icone nome="lixeira" tamanho={16} /></button>}</td></tr>
              );
            })}</tbody>
          </table>
        </section>
      )}
    </div>
  );
}
