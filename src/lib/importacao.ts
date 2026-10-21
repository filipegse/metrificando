// Importação do histórico das planilhas (CSV exportado do Google Sheets).
// Regra do vault: nunca usar posição de coluna; o mapa é montado pelos títulos do cabeçalho.

export type Campo =
  | "time" | "nome" | "inicio" | "fim" | "entrega" | "extras" | "pts_sdd" | "esforco_sdd" | "pts_sem_sdd"
  | "esforco_sem_sdd" | "ganho_sdd" | "itens_entregues" | "cycle_p50" | "cycle_p85" | "produtividade" | "motivacao";

export const CAMPOS: { campo: Campo; rotulo: string; tipo: "texto" | "data" | "numero" | "fracao"; apelidos: string[] }[] = [
  { campo: "time", rotulo: "Time / frente", tipo: "texto", apelidos: ["time", "squad", "time ou frente", "frente"] },
  { campo: "nome", rotulo: "Sprint / ciclo", tipo: "texto", apelidos: ["sprint", "nome da sprint", "ciclo", "nome do ciclo"] },
  { campo: "inicio", rotulo: "Início", tipo: "data", apelidos: ["data inicio", "inicio", "data de inicio", "inicio da sprint", "inicio do ciclo"] },
  { campo: "fim", rotulo: "Fim", tipo: "data", apelidos: ["data fim", "fim", "data de fim", "fim da sprint", "fim do ciclo", "data final"] },
  { campo: "entrega", rotulo: "Entrega %", tipo: "fracao", apelidos: ["entrega", "% entrega", "entrega %", "proporcao de entrega"] },
  { campo: "extras", rotulo: "Extras %", tipo: "fracao", apelidos: ["extras", "% extras", "% extra", "extras %"] },
  { campo: "pts_sdd", rotulo: "Pontos concluídos COM SDD (CC)", tipo: "numero", apelidos: ["qtd pontos concluidos com sdd", "pontos concluidos com sdd"] },
  { campo: "esforco_sdd", rotulo: "Pontos de esforço COM SDD (CD)", tipo: "numero", apelidos: ["qtd pontos de esforco com sdd", "pontos de esforco com sdd"] },
  { campo: "pts_sem_sdd", rotulo: "Pontos concluídos SEM SDD (CJ)", tipo: "numero", apelidos: ["qtd pontos concluidos sem sdd", "pontos concluidos sem sdd"] },
  { campo: "esforco_sem_sdd", rotulo: "Pontos de esforço SEM SDD (CK)", tipo: "numero", apelidos: ["qtd pontos de esforco sem sdd", "pontos de esforco sem sdd"] },
  { campo: "ganho_sdd", rotulo: "Ganho SDD % (CL)", tipo: "fracao", apelidos: ["ganho sdd", "ganho de eficiencia sdd", "% ganho sdd", "ganho sdd %"] },
  { campo: "itens_entregues", rotulo: "Itens entregues", tipo: "numero", apelidos: ["qtd itens concluidos", "itens concluidos", "qtd de itens concluidos", "vazao", "itens entregues"] },
  { campo: "cycle_p50", rotulo: "Tempo de ciclo P50", tipo: "numero", apelidos: ["tempo do ciclo p50", "p50 tempo do ciclo", "cycle time p50", "tempo de ciclo p50"] },
  { campo: "cycle_p85", rotulo: "Tempo de ciclo P85", tipo: "numero", apelidos: ["tempo do ciclo p85", "p85 tempo do ciclo", "cycle time p85", "tempo de ciclo p85"] },
  { campo: "produtividade", rotulo: "Produtividade %", tipo: "fracao", apelidos: ["produtividade", "produtividade geral", "% produtividade"] },
  { campo: "motivacao", rotulo: "Motivação %", tipo: "fracao", apelidos: ["motivacao", "motivacao geral", "% motivacao"] },
];

export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();

/** CSV com aspas, vírgula ou ponto e vírgula (detectado pela primeira linha). */
export function lerCsv(texto: string): string[][] {
  const sep = (texto.split("\n")[0].match(/;/g)?.length ?? 0) > (texto.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let linha: string[] = [], campo = "", aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

/** Sugere o mapa campo → índice pelo título (igualdade primeiro, depois "contém"). */
export function sugerirMapa(cabecalho: string[]): Partial<Record<Campo, number>> {
  const titulos = cabecalho.map(normalizar);
  const mapa: Partial<Record<Campo, number>> = {};
  const usados = new Set<number>();
  for (const passo of ["igual", "contem"] as const) {
    for (const { campo, apelidos } of CAMPOS) {
      if (mapa[campo] !== undefined) continue;
      const i = titulos.findIndex((t, k) => !usados.has(k) && t && apelidos.some((a) => (passo === "igual" ? t === a : t.includes(a))));
      if (i >= 0) { mapa[campo] = i; usados.add(i); }
    }
  }
  return mapa;
}

/** "25,5" → 25.5; "1.234,5" → 1234.5; vazio/erro → null. */
export function numero(v: string | undefined): number | null {
  if (v == null) return null;
  const s = v.replace(/[%\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!s || s === "-" || /^#/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "81%" → 0.81; "0,81" → 0.81; "81" → 0.81 (valores acima de 1,5 são tratados como percentuais). */
export function fracao(v: string | undefined): number | null {
  const n = numero(v);
  if (n == null) return null;
  return v!.includes("%") || Math.abs(n) > 1.5 ? n / 100 : n;
}

/** "13/10/2026" ou "2026-10-13" → "2026-10-13". */
export function data(v: string | undefined): string | null {
  if (!v) return null;
  const br = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) {
    const ano = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${ano}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  const iso = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

/** Siglas das planilhas → time e frente da plataforma. */
export const SIGLAS: Record<string, { time: string; frente?: string }> = {
  scops: { time: "SchoolOps" }, schoolops: { time: "SchoolOps" },
  dsr: { time: "Desenrola" }, desenrola: { time: "Desenrola" },
  rex: { time: "Rematrix" }, rematrix: { time: "Rematrix" },
  efc: { time: "Eficientes" }, eficientes: { time: "Eficientes" },
  nxs: { time: "Nexus" }, nexus: { time: "Nexus" },
  ped: { time: "Eficientes", frente: "Pedagógico" }, pedagogico: { time: "Eficientes", frente: "Pedagógico" },
  fol: { time: "Eficientes", frente: "Folha de Professores" }, "folha de professores": { time: "Eficientes", frente: "Folha de Professores" },
  int: { time: "Nexus", frente: "Integrações" }, integracoes: { time: "Nexus", frente: "Integrações" },
  ava: { time: "Nexus", frente: "Avaliações" }, avaliacoes: { time: "Nexus", frente: "Avaliações" },
  retaguarda: { time: "Retaguarda", frente: "Retaguarda" },
  "x retaguarda": { time: "Retaguarda", frente: "X-Retaguarda" }, "x reta": { time: "Retaguarda", frente: "X-Retaguarda" },
  "contas a pagar": { time: "Contas a Pagar" }, fluig: { time: "Contas a Pagar" }, cf: { time: "Contas a Pagar" },
};

/** Time pelo valor da coluna ou, sem ela, pela primeira palavra do nome da sprint ("REX 39 1ª.Q3.26"). */
export function timeDe(valorTime: string | undefined, nome: string | undefined, padrao?: { time: string; frente?: string }) {
  for (const v of [valorTime, nome?.split(/\s+/)[0], nome?.split("|")[0]]) {
    const k = normalizar(v ?? "");
    if (k && SIGLAS[k]) return SIGLAS[k];
  }
  return padrao ?? null;
}

export type LinhaHistorico = {
  time: string; frente: string; nome: string; tipo: "sprint" | "semana"; inicio: string | null; fim: string;
} & Partial<Record<Exclude<Campo, "time" | "nome" | "inicio" | "fim">, number | null>>;

export type Resultado = { linhas: LinhaHistorico[]; avisos: { linha: number; motivo: string }[] };

export function montarLinhas(
  dados: string[][], linhaTitulo: number, mapa: Partial<Record<Campo, number>>,
  opcoes: { tipo: "sprint" | "semana"; duracaoDias: number; timePadrao?: { time: string; frente?: string } },
): Resultado {
  const linhas: LinhaHistorico[] = [], avisos: Resultado["avisos"] = [];
  const valor = (l: string[], c: Campo) => (mapa[c] === undefined ? undefined : l[mapa[c]!]?.trim());
  dados.slice(linhaTitulo).forEach((l, k) => {
    const n = linhaTitulo + k + 1;
    if (!l.some((x) => x.trim())) return;
    const nome = valor(l, "nome");
    if (!nome) return avisos.push({ linha: n, motivo: "sem nome de sprint/ciclo" }) && undefined;
    const t = timeDe(valor(l, "time"), nome, opcoes.timePadrao);
    if (!t) return avisos.push({ linha: n, motivo: `time não reconhecido ("${valor(l, "time") ?? nome}")` }) && undefined;
    const inicio = data(valor(l, "inicio"));
    let fim = data(valor(l, "fim"));
    // Planilha Kanban só traz o início do ciclo: o fim é início + duração.
    if (!fim && inicio) fim = new Date(Date.parse(inicio) + (opcoes.duracaoDias - 1) * 86400000).toISOString().slice(0, 10);
    if (!fim) return avisos.push({ linha: n, motivo: "sem data de fim/início" }) && undefined;
    const linha: LinhaHistorico = { time: t.time, frente: t.frente ?? "", nome, tipo: opcoes.tipo, inicio, fim };
    for (const { campo, tipo } of CAMPOS) {
      if (tipo === "numero") linha[campo as "pts_sdd"] = numero(valor(l, campo));
      if (tipo === "fracao") linha[campo as "entrega"] = fracao(valor(l, campo));
    }
    linhas.push(linha);
  });
  return { linhas, avisos };
}
