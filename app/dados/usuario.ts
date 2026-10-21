// Nome de quem está editando, guardado neste navegador para identificar as alterações na auditoria.
const CHAVE = "metrificando:usuario";
export function lerUsuario(): string {
  try { return localStorage.getItem(CHAVE) ?? ""; } catch { return ""; }
}
export function salvarUsuario(nome: string) {
  try { localStorage.setItem(CHAVE, nome); } catch { /* navegador sem armazenamento */ }
}
