// Composição de um período por tipo de item, planejamento e categoria de roadmap (pontos e quantidade de itens).
// Fonte única: banco (colunas), importação (campos e apelidos), editor de dados e deck usam esta lista.

export type Grupo = "tipo" | "planejamento" | "roadmap";

export const CATEGORIAS: { grupo: Grupo; chave: string; rotulo: string; /** chave usada nos gráficos do deck */ deck: string; termos: string[] }[] = [
  { grupo: "tipo", chave: "historia", rotulo: "História", deck: "entrega", termos: ["historia", "historias"] },
  { grupo: "tipo", chave: "tecnologia", rotulo: "Tecnologia", deck: "tecnologia", termos: ["tecnologia"] },
  { grupo: "tipo", chave: "correcao", rotulo: "Correção", deck: "bug", termos: ["correcao", "bug", "bugs"] },
  { grupo: "tipo", chave: "operacional", rotulo: "Operacional", deck: "operacional", termos: ["operacional"] },
  { grupo: "planejamento", chave: "planejado", rotulo: "Planejado", deck: "Planejado", termos: ["planejados", "planejado"] },
  { grupo: "planejamento", chave: "extra", rotulo: "Extra", deck: "Extra", termos: ["extras", "extra"] },
  { grupo: "planejamento", chave: "bonus", rotulo: "Bônus", deck: "Bônus", termos: ["bonus"] },
  // Kanban não tem planejamento: classifica itens em padrão e urgente.
  { grupo: "planejamento", chave: "padrao", rotulo: "Padrão", deck: "Padrão", termos: ["padrao", "padroes"] },
  { grupo: "planejamento", chave: "urgente", rotulo: "Urgente", deck: "Urgente", termos: ["urgente", "urgentes"] },
  { grupo: "roadmap", chave: "grandes", rotulo: "Grandes entregas", deck: "Grandes entregas", termos: ["grandes entregas"] },
  { grupo: "roadmap", chave: "pequenas", rotulo: "Pequenas entregas", deck: "Pequenas entregas", termos: ["pequenas entregas"] },
  { grupo: "roadmap", chave: "evolucao", rotulo: "Evolução técnica", deck: "Evolução técnica", termos: ["evolucao tecnica"] },
  { grupo: "roadmap", chave: "suporte_rotina", rotulo: "Suporte/rotina", deck: "Suporte/rotina", termos: ["suporte rotina", "suporte e rotina", "suporte/rotina"] },
];

export const ROTULO_GRUPO: Record<Grupo, string> = { tipo: "Tipo de item", planejamento: "Planejamento", roadmap: "Categoria de roadmap" };

/** Nome da coluna no banco: tipo_historia_pts, plan_extra_itens, rm_grandes_pts… */
export const PREFIXO: Record<Grupo, string> = { tipo: "tipo", planejamento: "plan", roadmap: "rm" };
export const colunaDe = (grupo: Grupo, chave: string, medida: "pts" | "itens") => `${PREFIXO[grupo]}_${chave}_${medida}`;

export const COLUNAS_COMPOSICAO = CATEGORIAS.flatMap((c) => (["pts", "itens"] as const).map((m) => colunaDe(c.grupo, c.chave, m)));

/**
 * Apelidos para reconhecer as colunas da planilha. Prioridade para as colunas de itens *concluídos*
 * (é o que o deck mostra); totais do período ficam como segunda opção, ajustável no mapeamento.
 */
export function apelidosDe(c: (typeof CATEGORIAS)[number], medida: "pts" | "itens"): string[] {
  const m = medida === "pts" ? ["pontos"] : ["itens"];
  const r: string[] = [];
  for (const t of c.termos) for (const x of m) {
    r.push(`qtd ${x} concluidos ${t}`, `${x} concluidos ${t}`, `qtd ${x} ${t} concluidos`, `${x} ${t} concluidos`, `qtd ${x} concluidos de ${t}`);
  }
  // Planilha Kanban (resumo semanal): "Pontos padrão", "Itens urgentes", "Pontos História"…
  for (const t of c.termos) for (const x of m) r.push(`${x} ${t}`);
  // Roadmap: na planilha de métricas a categoria aparece só pelo nome ("Grandes entregas") e é contagem de itens.
  if (c.grupo === "roadmap") for (const t of c.termos) {
    r.push(medida === "pts" ? `pontos ${t}` : `qtd itens ${t}`);
    if (medida === "itens") r.push(`${t} concluidos`, `concluidos ${t}`);
  }
  return r;
}
