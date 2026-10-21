// Perfis dos times. Espelha docs-ai-agilidade/05-praticas/plataforma-metricas/perfis.json.
import * as S from "./status";

export const CAMPOS = {
  spSdd: "customfield_10008",
  spOriginal: "customfield_10788",
  spSemSdd: "customfield_12788",
  sprint: "customfield_10007",
  planejamento: "customfield_10893",
  categoriaRoadmap: "customfield_11730",
  team: "customfield_10500",
  frenteDeTrabalho: "customfield_12888",
  frente: "customfield_12590",
} as const;

// Épico e Subtarefa nunca entram nas consultas de itens entregues.
export const TIPOS_EXCLUIDOS = ["Épico", "Subtarefa", "Sub-tarefa", "Sub-Tarefa"];
export const TIPO_SUPORTE = "Suporte";

export const TIPO_CANONICO: Record<string, string> = {
  "História": "entrega",
  "Tecnologia": "tecnologia",
  "Correção": "bug",
  "Operacional": "operacional",
  "Ajuste": "ajuste",
  "Suporte": "suporte",
  "Dúvida": "suporte",
};

export type CampoFrente = { id: string; nome: string } | { id: "components"; nome: "Components" };

export type FonteSuporte = {
  projeto: string;
  mapa: S.MapaStatus;
  /** Status cuja entrada marca a resolução do chamado. */
  statusResolucao: string;
  /** Filtro adicional por campo (ex.: Team no SP). */
  filtroTeam?: string;
  /** chamado = conta no volume; trabalho_n3 = mede fluxo N3, não soma no volume. */
  papel: "chamado" | "trabalho_n3";
  /** Origem do suporte: projeto próprio ou tipo Suporte no projeto de delivery. */
  porTipo?: boolean;
  naSprint: boolean;
};

export type Perfil = {
  time: string;
  projeto: string;
  metodologia: "scrum" | "kanban";
  periodo: "sprint" | "semana_sab_sex";
  validoDe?: string;
  campoFrente: CampoFrente | null;
  mapaDelivery: S.MapaStatus;
  /** null = todos os tipos da TAP (menos excluídos e suporte). */
  tiposDelivery: string[] | null;
  suporte: FonteSuporte[];
  /** Time no TeamRetro (health check Squad Feeling v2). */
  teamRetroId?: string;
  /** Quando o time do TeamRetro é compartilhado: só os health checks cujo título casa com o padrão. */
  teamRetroTitulo?: RegExp;
};

export const PERFIS: Perfil[] = [
  {
    time: "SchoolOps", teamRetroId: "7m1bAHWetJTP0B5N7pbZIX", projeto: "SCOPS", metodologia: "scrum", periodo: "sprint",
    campoFrente: null, mapaDelivery: S.DELIVERY_PADRAO_TAP, tiposDelivery: null,
    suporte: [{ projeto: "SNS", mapa: S.SUPORTE_SNS, statusResolucao: "Resolvido", papel: "chamado", naSprint: false }],
  },
  {
    time: "Desenrola", teamRetroId: "6DZVmOh8wNlaC7R5Op0IDv", projeto: "DSR", metodologia: "scrum", periodo: "sprint",
    campoFrente: null, mapaDelivery: S.DELIVERY_PADRAO_TAP, tiposDelivery: null,
    suporte: [{ projeto: "SA", mapa: S.SUPORTE_SA, statusResolucao: "Resolvido", papel: "chamado", naSprint: false }],
  },
  {
    time: "Nexus", teamRetroId: "1XtWnmAm96BUaqWKtZrP6O", projeto: "NXS", metodologia: "scrum", periodo: "sprint",
    campoFrente: { id: CAMPOS.frenteDeTrabalho, nome: "Frente de Trabalho" },
    mapaDelivery: S.DELIVERY_PADRAO_TAP, tiposDelivery: null,
    suporte: [{ projeto: "SP", mapa: S.SUPORTE_SP, statusResolucao: "Concluído", filtroTeam: "[TAP] Time Nexus", papel: "chamado", naSprint: false }],
  },
  {
    time: "Rematrix", teamRetroId: "4dG5bApVdvVffVbcJlCNgA", projeto: "IC", metodologia: "kanban", periodo: "semana_sab_sex", validoDe: "2026-09-09",
    campoFrente: null, mapaDelivery: S.DELIVERY_PADRAO_TAP, tiposDelivery: null,
    suporte: [
      { projeto: "SC", mapa: S.SUPORTE_SC, statusResolucao: "Resolvido", papel: "chamado", naSprint: false },
      { projeto: "SIS", mapa: S.SUPORTE_SIS, statusResolucao: "Concluído", papel: "trabalho_n3", naSprint: false },
    ],
  },
  {
    time: "Eficientes", teamRetroId: "5AdSqS9J5M8Zk9pLNLZwoG", projeto: "EFC", metodologia: "kanban", periodo: "semana_sab_sex", validoDe: "2026-08-29",
    campoFrente: { id: CAMPOS.frente, nome: "Frente" },
    mapaDelivery: S.DELIVERY_PADRAO_TAP, tiposDelivery: null,
    suporte: [{ projeto: "SP", mapa: S.SUPORTE_SP, statusResolucao: "Concluído", filtroTeam: "[TAP] Time Eficientes", papel: "chamado", naSprint: false }],
  },
  {
    time: "Retaguarda", teamRetroId: "0xyBwhNazOm4TFtWoF0bRn", teamRetroTitulo: /^(Retaguarda|Sprint)\s+\d+/i, projeto: "TRG", metodologia: "scrum", periodo: "sprint",
    campoFrente: { id: "components", nome: "Components" },
    mapaDelivery: S.DELIVERY_TRG, tiposDelivery: ["História", "Tecnologia"],
    // Suporte entra na sprint, mas não soma pontos nem conta como item entregue.
    suporte: [{ projeto: "TRG", porTipo: true, mapa: S.DELIVERY_TRG, statusResolucao: "Concluído", papel: "chamado", naSprint: true }],
  },
  {
    time: "Contas a Pagar", teamRetroId: "0xyBwhNazOm4TFtWoF0bRn", teamRetroTitulo: /^Fluig\s+\d+/i, projeto: "CF", metodologia: "scrum", periodo: "sprint",
    campoFrente: null, mapaDelivery: S.DELIVERY_CF, tiposDelivery: ["História", "Correção", "Tecnologia"],
    // Suporte fica fora da sprint e tem workflow próprio.
    suporte: [{ projeto: "CF", porTipo: true, mapa: S.SUPORTE_CF, statusResolucao: "Resolvido", papel: "chamado", naSprint: false }],
  },
];

export function perfilPorProjeto(projeto: string): Perfil | undefined {
  return PERFIS.find((p) => p.projeto === projeto);
}
