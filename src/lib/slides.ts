// Catálogo dos slides do deck por time: usado no assistente (escolha e explicação) e na apresentação (filtro).
export type DefSlide = { chave: string; titulo: string; descricao: string; metodologia?: "scrum" | "kanban"; observacao?: string };

export const SLIDES: DefSlide[] = [
  { chave: "capa", titulo: "Capa do time", descricao: "Nome do time e da frente, metodologia e intervalo de períodos apresentado." },
  { chave: "matriz", titulo: "Tabela de indicadores", descricao: "Pontos com e sem SDD, itens, capacidade, tempo de ciclo, chamados, tech lead, hora extra e moral, lado a lado por período, com caixas de leitura." },
  { chave: "entrega", titulo: "Proporção de entrega", descricao: "Pontos planejados concluídos ÷ pontos planejados, com a referência de 100%.", metodologia: "scrum" },
  { chave: "vazao", titulo: "Vazão", descricao: "Itens entregues por período, com destaque para as semanas em que o tech lead entregou 30% ou mais.", metodologia: "kanban" },
  { chave: "desempenho", titulo: "Desempenho por pontos", descricao: "Pontos concluídos COM SDD e SEM SDD por período." },
  { chave: "cycle", titulo: "Tempo de ciclo", descricao: "P50 e P85 em dias úteis, do início do trabalho até Concluído.", observacao: "Sai do deck quando não há tempo de ciclo no período." },
  { chave: "saude", titulo: "Moral do time", descricao: "Produtividade e motivação do health check do TeamRetro (Squad Feeling v2)." },
  { chave: "comp-plan", titulo: "Composição por planejamento", descricao: "Proporção dos pontos planejados, extras e bônus.", metodologia: "scrum", observacao: "Sai do deck quando não há composição." },
  { chave: "comp-urgencia", titulo: "Padrão × urgente", descricao: "Proporção de itens padrão e urgentes por período.", metodologia: "kanban", observacao: "Sai do deck quando não há composição." },
  { chave: "comp-tipo", titulo: "Composição por tipo", descricao: "Proporção de História, Tecnologia, Correção e Operacional.", observacao: "Sai do deck quando não há composição." },
  { chave: "roadmap", titulo: "Categoria de roadmap", descricao: "Proporção de Grandes entregas, Pequenas entregas, Evolução técnica e Suporte/rotina.", observacao: "Sai do deck quando não há composição." },
  { chave: "suporte", titulo: "Suporte", descricao: "Chamados resolvidos por nível (N2, N3, trabalho N3) e tempo de resolução P50.", observacao: "Sai do deck quando não há chamados coletados." },
  { chave: "transicao", titulo: "Transição Scrum → Kanban", descricao: "Quando o período cruza a migração: itens e chamados por semana, tempo de ciclo e moral numa linha do tempo única." },
  { chave: "destaques", titulo: "Destaques do roadmap", descricao: "Caixas para atividades previstas e destaques do negócio, preenchidas na própria apresentação." },
];

export const TODOS_SLIDES = SLIDES.map((s) => s.chave);

/** `slides=matriz,vazao` → conjunto; ausente = todos. */
export const slidesDaUrl = (v?: string) => new Set(v ? v.split(",").filter(Boolean) : TODOS_SLIDES);
