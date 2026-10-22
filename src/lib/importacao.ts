// Importação do histórico das planilhas (CSV exportado do Google Sheets).
// Regra do vault: nunca usar posição de coluna; o mapa é montado pelos títulos do cabeçalho.

import { apelidosDe, CATEGORIAS, colunaDe, ROTULO_GRUPO, type Grupo } from "./composicao";

/** Campos de composição: tipo_historia_pts, plan_extra_itens, rm_grandes_pts… */
export type CampoComposicao = `${"tipo" | "plan" | "rm"}_${string}_${"pts" | "itens"}`;

export type Campo = CampoComposicao
  | "time" | "nome" | "inicio" | "fim" | "entrega" | "extras" | "pts_sdd" | "esforco_sdd" | "pts_sem_sdd"
  | "esforco_sem_sdd" | "ganho_sdd" | "itens_entregues" | "cycle_p50" | "cycle_p85" | "produtividade" | "motivacao" | "pct_itens_tl" | "pct_pts_tl" | "hora_extra_h" | "itens_hora_extra"
  | "prod_coletiva" | "prod_individual" | "mot_coletiva" | "mot_individual" | "itens_total";

/** Campos auxiliares: não são gravados, só usados para calcular outros campos. */
export const AUXILIARES: Campo[] = ["prod_coletiva", "prod_individual", "mot_coletiva", "mot_individual", "itens_total"];

// `exatos`: apelidos que só valem por igualdade (evita casar "extras" com "Total de itens extras").
// `escala`: notas 1–5 do health check, convertidas em fração ÷ 5 (como no TeamRetro).
export type DefCampo = { campo: Campo; rotulo: string; tipo: "texto" | "data" | "numero" | "fracao" | "escala"; apelidos: string[]; exatos?: string[]; grupo?: Grupo };
export const CAMPOS: DefCampo[] = [
  { campo: "time", rotulo: "Time / frente", tipo: "texto", apelidos: ["time", "squad", "time ou frente", "frente"] },
  { campo: "nome", rotulo: "Sprint / ciclo", tipo: "texto", apelidos: ["sprint", "nome da sprint", "ciclo", "nome do ciclo"], exatos: ["semana", "quinzena"] },
  { campo: "inicio", rotulo: "Início", tipo: "data", apelidos: ["data inicio", "inicio", "data de inicio", "inicio da sprint", "inicio do ciclo"], exatos: ["semana inicio", "quinzena inicio"] },
  { campo: "fim", rotulo: "Fim", tipo: "data", apelidos: ["data fim", "fim", "data de fim", "fim da sprint", "fim do ciclo", "data final"] },
  { campo: "entrega", rotulo: "Entrega %", tipo: "fracao", apelidos: ["% entrega", "entrega %", "proporcao de entrega"], exatos: ["entrega", "eficiencia media %", "eficiencia media"] },
  { campo: "extras", rotulo: "Extras %", tipo: "fracao", apelidos: ["% extras", "% extra", "extras %"], exatos: ["extras", "acrescimo %", "acrescimo"] },
  { campo: "pts_sdd", rotulo: "Pontos concluídos COM SDD (CC)", tipo: "numero", apelidos: ["qtd pontos concluidos com sdd", "pontos concluidos com sdd"], exatos: ["qtd pontos concluidos", "story points"] },
  { campo: "esforco_sdd", rotulo: "Pontos de esforço COM SDD (CD)", tipo: "numero", apelidos: ["qtd pontos de esforco com sdd", "pontos de esforco com sdd"] },
  { campo: "pts_sem_sdd", rotulo: "Pontos concluídos SEM SDD (CJ)", tipo: "numero", apelidos: ["qtd pontos concluidos sem sdd", "pontos concluidos sem sdd"], exatos: ["story points sem sdd"] },
  { campo: "esforco_sem_sdd", rotulo: "Pontos de esforço SEM SDD (CK)", tipo: "numero", apelidos: ["qtd pontos de esforco sem sdd", "pontos de esforco sem sdd"] },
  { campo: "ganho_sdd", rotulo: "Ganho SDD % (CL)", tipo: "fracao", apelidos: ["ganho sdd", "ganho de eficiencia sdd", "% ganho sdd", "ganho sdd %"] },
  // Primeiro apelido que existir vence: "sem suporte" tem prioridade (suporte não conta como item entregue).
  { campo: "itens_entregues", rotulo: "Itens entregues", tipo: "numero", apelidos: ["itens concluidos sem suporte", "qtd itens concluidos", "itens concluidos", "qtd de itens concluidos", "vazao", "itens entregues"], exatos: ["itens"] },
  // Reserva quando "sem suporte" vem negativo (CF: suporte fora da sprint, a fórmula da planilha desconta mesmo assim).
  { campo: "itens_total", rotulo: "Itens concluídos (total, reserva)", tipo: "numero", apelidos: [], exatos: ["qtd itens concluidos"] },
  { campo: "cycle_p50", rotulo: "Tempo de ciclo P50", tipo: "numero", apelidos: ["tempo do ciclo p50", "p50 tempo do ciclo", "cycle time p50", "tempo de ciclo p50", "p50 util dias", "p50 util h"], exatos: ["tempo do ciclo", "tempo de ciclo", "media util h", "media util dias", "mediana util h", "mediana util dias"] },
  { campo: "cycle_p85", rotulo: "Tempo de ciclo P85", tipo: "numero", apelidos: ["tempo do ciclo p85", "p85 tempo do ciclo", "cycle time p85", "tempo de ciclo p85"], exatos: ["p85 util dias", "p85 util h"] },
  { campo: "pct_itens_tl", rotulo: "% itens do tech lead", tipo: "fracao", apelidos: ["% itens tech lead", "% itens do tech lead", "% itens tl"] },
  { campo: "pct_pts_tl", rotulo: "% pontos do tech lead", tipo: "fracao", apelidos: ["% pontos tech lead", "% pontos do tech lead", "% pontos tl"] },
  { campo: "hora_extra_h", rotulo: "Hora extra (h)", tipo: "numero", apelidos: [], exatos: ["hora extra h", "hora extra"] },
  { campo: "itens_hora_extra", rotulo: "Itens com hora extra", tipo: "numero", apelidos: [], exatos: ["itens com hora extra"] },
  { campo: "produtividade", rotulo: "Produtividade (geral)", tipo: "escala", apelidos: ["produtividade geral", "% produtividade"], exatos: ["produtividade"] },
  { campo: "motivacao", rotulo: "Motivação (geral)", tipo: "escala", apelidos: ["motivacao geral", "% motivacao"], exatos: ["motivacao"] },
  { campo: "prod_coletiva", rotulo: "Produtividade coletiva (1–5)", tipo: "escala", apelidos: ["produtividade coletiva"] },
  { campo: "prod_individual", rotulo: "Produtividade individual (1–5)", tipo: "escala", apelidos: ["produtividade individual"] },
  { campo: "mot_coletiva", rotulo: "Motivação coletiva (1–5)", tipo: "escala", apelidos: ["motivacao coletiva"] },
  { campo: "mot_individual", rotulo: "Motivação individual (1–5)", tipo: "escala", apelidos: ["motivacao individual"] },
];

// Composição (pontos e itens concluídos por categoria), reconhecida pelos títulos; ajustável no mapeamento.
for (const c of CATEGORIAS) for (const m of ["pts", "itens"] as const) {
  CAMPOS.push({
    campo: colunaDe(c.grupo, c.chave, m) as CampoComposicao, grupo: c.grupo, tipo: "numero",
    rotulo: `${c.rotulo} · ${m === "pts" ? "pontos" : "itens"}`, apelidos: apelidosDe(c, m),
  });
}
export { ROTULO_GRUPO };

/** Sobe quando as regras de reconhecimento de colunas mudam (invalida mapeamentos salvos antes). */
export const VERSAO_MAPA = 5;

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
    for (const { campo, apelidos, exatos = [] } of CAMPOS) {
      if (mapa[campo] !== undefined) continue;
      // Percorre os apelidos em ordem de prioridade; para cada um, procura a primeira coluna livre que casa.
      let i = -1;
      for (const a of passo === "igual" ? [...apelidos, ...exatos] : apelidos) {
        i = titulos.findIndex((t, k) => !usados.has(k) && !!t && (passo === "igual" ? t === a : t.includes(a)));
        if (i >= 0) break;
      }
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

/** Nota de health check: "4,8" (escala 1–5) → 0.96; "96%" → 0.96; "0,96" → 0.96. */
export function escala(v: string | undefined): number | null {
  const n = numero(v);
  if (n == null) return null;
  if (v!.includes("%")) return n / 100;
  if (n <= 1) return n;
  if (n <= 5) return n / 5;
  return n / 100;
}

/** Linha do cabeçalho: entre as primeiras, a que tem mais títulos reconhecidos (planilhas com 2–3 linhas de agrupamento). */
export function detectarCabecalho(dados: string[][], max = 8): number {
  let melhor = 1, pontos = -1;
  dados.slice(0, max).forEach((l, i) => {
    const n = Object.keys(sugerirMapa(l)).length;
    if (n > pontos) { melhor = i + 1; pontos = n; }
  });
  return melhor;
}

/** "13/10/2026" ou "2026-10-13" → "2026-10-13". */
/** Janela escrita no nome ("27/06–03/07/2026", "27/12–02/01/2027"): início e fim reais (sábado a sexta). */
export function janelaDoNome(nome: string): { inicio: string; fim: string } | null {
  const m = nome.match(/^(\d{1,2})\/(\d{1,2})\s*[–—-]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d1, m1, d2, m2, a] = m, p = (x: string) => x.padStart(2, "0");
  const ano1 = Number(m1) > Number(m2) ? Number(a) - 1 : Number(a);
  return { inicio: `${ano1}-${p(m1)}-${p(d1)}`, fim: `${a}-${p(m2)}-${p(d2)}` };
}

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
  // Planilha Kanban (TAP Delivery Métricas Kanban PBI): "IC (Rematrix)", "EFC total", "EFC – Pedagógico".
  ic: { time: "Rematrix" }, "ic rematrix": { time: "Rematrix" }, "efc total": { time: "Eficientes" },
  "efc pedagogico": { time: "Eficientes", frente: "Pedagógico" }, "efc folha de professores": { time: "Eficientes", frente: "Folha de Professores" },
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
} & Partial<Record<Exclude<Campo, "time" | "nome" | "inicio" | "fim" | "prod_coletiva" | "prod_individual" | "mot_coletiva" | "mot_individual">, number | null>>;

/** Jornada usada para converter horas úteis em dias úteis (expediente 9h–18h48). */
export const HORAS_POR_DIA_UTIL = 9.8;

/**
 * Unidade do tempo de ciclo na planilha. Sem indicação, deduz pela mediana: acima de 30 é hora
 * (ciclo de 30+ dias úteis numa sprint de 2 semanas não faz sentido).
 */
export function unidadeCiclo(valores: (number | null | undefined)[]): "horas" | "dias" {
  const v = valores.filter((x): x is number => x != null).sort((a, b) => a - b);
  return v.length && v[Math.floor(v.length / 2)] > 30 ? "horas" : "dias";
}

export type Resultado = { linhas: LinhaHistorico[]; avisos: { linha: number; motivo: string }[]; unidadeCiclo?: "horas" | "dias" };

export function montarLinhas(
  dados: string[][], linhaTitulo: number, mapa: Partial<Record<Campo, number>>,
  opcoes: { tipo: "sprint" | "semana"; duracaoDias: number; timePadrao?: { time: string; frente?: string }; unidadeCiclo?: "horas" | "dias" | "auto" },
): Resultado {
  const linhas: LinhaHistorico[] = [], avisos: Resultado["avisos"] = [];
  const valor = (l: string[], c: Campo) => (mapa[c] === undefined ? undefined : l[mapa[c]!]?.trim());
  dados.slice(linhaTitulo).forEach((l, k) => {
    const n = linhaTitulo + k + 1;
    if (!l.some((x) => x.trim())) return;
    const nome = valor(l, "nome");
    // Linha sem sprint e sem time é linha vazia de fórmula/separador: ignora em silêncio.
    if (!nome && !valor(l, "time")) return;
    if (!nome) return avisos.push({ linha: n, motivo: "sem nome de sprint/ciclo" }) && undefined;
    const t = timeDe(valor(l, "time"), nome, opcoes.timePadrao);
    if (!t) return avisos.push({ linha: n, motivo: `time não reconhecido ("${valor(l, "time") ?? nome}")` }) && undefined;
    // Na planilha Kanban "Semana início" é a segunda-feira; a janela real (sáb–sex) está no nome.
    const janela = janelaDoNome(nome);
    const inicio = janela?.inicio ?? data(valor(l, "inicio"));
    let fim = janela?.fim ?? data(valor(l, "fim"));
    // Planilha Kanban só traz o início do ciclo: o fim é início + duração.
    if (!fim && inicio) fim = new Date(Date.parse(inicio) + (opcoes.duracaoDias - 1) * 86400000).toISOString().slice(0, 10);
    if (!fim) return avisos.push({ linha: n, motivo: "sem data de fim/início" }) && undefined;
    const linha: LinhaHistorico = { time: t.time, frente: t.frente ?? "", nome, tipo: opcoes.tipo, inicio, fim };
    const aux: Partial<Record<Campo, number | null>> = {};
    for (const { campo, tipo } of CAMPOS) {
      const v = tipo === "numero" ? numero(valor(l, campo)) : tipo === "fracao" ? fracao(valor(l, campo)) : tipo === "escala" ? escala(valor(l, campo)) : undefined;
      if (v === undefined) continue;
      if (AUXILIARES.includes(campo)) aux[campo] = v;
      else linha[campo as "pts_sdd"] = v;
    }
    // Como no TeamRetro: produtividade = média(coletiva, individual); motivação idem. Tem prioridade sobre a coluna "geral".
    const media = (a?: number | null, b?: number | null) => (a != null && b != null ? (a + b) / 2 : a ?? b ?? null);
    if (aux.prod_coletiva != null || aux.prod_individual != null) linha.produtividade = media(aux.prod_coletiva, aux.prod_individual);
    if (aux.mot_coletiva != null || aux.mot_individual != null) linha.motivacao = media(aux.mot_coletiva, aux.mot_individual);
    if (linha.itens_entregues != null && linha.itens_entregues < 0) linha.itens_entregues = aux.itens_total ?? null;
    linhas.push(linha);
  });
  // Tempo de ciclo sempre gravado em dias úteis (como a coleta do Jira). Título com "(h)" ou "(dias)" decide
  // a unidade daquela coluna; sem indicação, vale a opção (ou a dedução pela mediana).
  const cab = dados[linhaTitulo - 1] ?? [];
  const unidadeDoTitulo = (c: "cycle_p50" | "cycle_p85") => {
    const t = mapa[c] === undefined ? "" : normalizar(cab[mapa[c]!] ?? "");
    return / h$/.test(t) ? "horas" : / dias$/.test(t) ? "dias" : null;
  };
  const semTitulo = (["cycle_p50", "cycle_p85"] as const).filter((c) => !unidadeDoTitulo(c));
  const unidade = !opcoes.unidadeCiclo || opcoes.unidadeCiclo === "auto"
    ? unidadeCiclo(linhas.flatMap((l) => semTitulo.map((c) => l[c]))) : opcoes.unidadeCiclo;
  for (const c of ["cycle_p50", "cycle_p85"] as const) {
    if ((unidadeDoTitulo(c) ?? unidade) !== "horas") continue;
    for (const l of linhas) {
      if (l[c] != null) l[c] = Math.round((l[c]! / HORAS_POR_DIA_UTIL) * 100) / 100;
    }
  }
  return { linhas, avisos, unidadeCiclo: unidade };
}
