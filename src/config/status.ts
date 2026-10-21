// Mapas status do Jira → etapa canônica.
// Fonte: docs-ai-agilidade/03-jira/fluxos-de-status.md (prints dos workflows, 21/10/2026).

export type MapaStatus = Record<string, string>;

export const ETAPAS_ENTREGUE = new Set(["entregue"]);

export const DELIVERY_PADRAO_TAP: MapaStatus = {
  "Backlog": "backlog",
  "Aberto": "a_fazer",
  "Em desenvolvimento": "desenvolvimento",
  "Despriorizado": "despriorizado",
  "Bloqueio interno": "bloqueio_interno",
  "Bloqueio externo": "bloqueio_externo",
  "Em testes": "testes_dev",
  "PR aberto": "code_review",
  "Aguardando QA": "espera_teste",
  "Testando em QA": "teste",
  "Bloqueado em QA": "bloqueio_teste",
  "Aguardando ajuste": "espera_ajuste",
  "Ajustando": "ajuste",
  "Bloqueado em ajuste": "bloqueio_ajuste",
  "Aprovado em QA": "aprovado_qa",
  "Pronto para deploy": "deploy",
  "Bloqueado em deploy": "bloqueio_deploy",
  "Concluído": "entregue",
};

export const DELIVERY_TRG: MapaStatus = {
  "Backlog": "a_fazer",
  "Em progresso": "desenvolvimento",
  "Bloqueado em progresso": "bloqueio_desenvolvimento",
  "Liberado para validação": "teste",
  "Aguardando ajuste": "espera_ajuste",
  "Ajustando": "ajuste",
  "Bloqueado em ajuste": "bloqueio_ajuste",
  "Pronto para deploy": "deploy",
  "Concluído": "entregue",
  "Cancelado": "cancelado",
};

export const DELIVERY_CF: MapaStatus = {
  "A fazer": "a_fazer",
  "Em progresso": "desenvolvimento",
  "Bloqueado em progresso": "bloqueio_desenvolvimento",
  "Pronto para validação": "espera_teste",
  "Em validação": "teste",
  "Bloqueado em validação": "bloqueio_teste",
  "Aguardando ajuste": "espera_ajuste",
  "Ajustando": "ajuste",
  "Bloqueado em ajuste": "bloqueio_ajuste",
  "Pronto para deploy": "deploy",
  "Concluído": "entregue",
  "Cancelado": "cancelado",
};

// Suporte. Resolução = entrada em "Resolvido"; onde não existe, entrada em "Concluído".
export const SUPORTE_SA: MapaStatus = {
  "Aberto": "aberto",
  "Em atendimento": "em_atendimento",
  "Pendente usuário": "pendente_usuario",
  "Enviado para N3": "escalado_n3",
  "Resolvido": "resolvido",
  "Fechado com êxito": "encerrado",
  "Reclassificado": "reclassificado",
};

export const SUPORTE_SNS = SUPORTE_SA;

export const SUPORTE_SC: MapaStatus = {
  ...SUPORTE_SA,
  "Fechado sem êxito": "encerrado_sem_exito",
  "Fechado | Reclassificado": "reclassificado",
  "Cancelado pelo usuário": "cancelado",
};

export const SUPORTE_CF: MapaStatus = {
  "Aberto": "aberto",
  "Em atendimento": "em_atendimento",
  "Pendente usuário": "pendente_usuario",
  "Resolvido": "resolvido",
  "Fechado com êxito": "encerrado",
  "Reclassificado": "reclassificado",
};

export const SUPORTE_SP: MapaStatus = {
  "A fazer": "aberto",
  "Suporte em progresso": "em_atendimento",
  "Pendente fornecedor": "pendente_fornecedor",
  "Pendente usuário": "pendente_usuario",
  "Bloqueio interno": "bloqueio_interno",
  "Bloqueio externo": "bloqueio_externo",
  "Enviado para N3": "escalado_n3",
  "Liberado para validação": "validacao",
  "Concluído": "resolvido",
  "Reclassificado": "reclassificado",
};

export const SUPORTE_SIS: MapaStatus = {
  "A fazer": "aberto",
  "Suporte em progresso": "em_atendimento",
  "Suporte paralisado": "pausado",
  "Bloqueio interno": "bloqueio_interno",
  "Bloqueio externo": "bloqueio_externo",
  "PR aberto": "code_review",
  "Aguardando teste": "espera_teste",
  "Testando": "teste",
  "Bloqueado em teste": "bloqueio_teste",
  "Aprovado em QA": "aprovado_qa",
  "Liberado para validação": "validacao",
  "Bloqueado em validação": "bloqueio_validacao",
  "Concluído": "resolvido",
  "Cancelado": "cancelado",
};

export const STATUS_N3 = "Enviado para N3";

export function etapa(mapa: MapaStatus, status: string): string {
  return mapa[status] ?? "desconhecido";
}
