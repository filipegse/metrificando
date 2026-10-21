import { TIPO_SUPORTE, TIPOS_EXCLUIDOS, type FonteSuporte, type Perfil } from "../config/perfis";

const lista = (v: string[]) => v.map((x) => `"${x}"`).join(", ");
const data = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");

export function jqlDeliverySprint(perfil: Perfil, sprintId: string): string {
  return `project = ${perfil.projeto} AND sprint = ${sprintId} AND issuetype NOT IN (${lista([...TIPOS_EXCLUIDOS, TIPO_SUPORTE])})`;
}

/** Kanban: itens que chegaram a Concluído dentro da janela. */
export function jqlDeliveryJanela(perfil: Perfil, inicio: Date, fim: Date): string {
  return `project = ${perfil.projeto} AND issuetype NOT IN (${lista([...TIPOS_EXCLUIDOS, TIPO_SUPORTE])}) ` +
    `AND status CHANGED TO "Concluído" DURING ("${data(inicio)}", "${data(fim)}")`;
}

/** Suporte sempre pela janela de resolução, independentemente de estar na sprint. */
export function jqlSuporte(fonte: FonteSuporte, inicio: Date, fim: Date): string {
  const partes = [`project = ${fonte.projeto}`];
  if (fonte.porTipo) partes.push(`issuetype = "${TIPO_SUPORTE}"`);
  if (fonte.filtroTeam) partes.push(`cf[10500] = "${fonte.filtroTeam}"`); // campo Team
  partes.push(`status CHANGED TO "${fonte.statusResolucao}" DURING ("${data(inicio)}", "${data(fim)}")`);
  return partes.join(" AND ");
}
