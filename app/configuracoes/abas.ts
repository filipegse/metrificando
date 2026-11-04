// Abas de Configurações (fora do componente cliente para poder ser lida na página do servidor).
export const ABAS = ["calendario", "pessoas", "ausencias", "feriados", "expediente", "importar", "dados"] as const;
export type Aba = (typeof ABAS)[number];
