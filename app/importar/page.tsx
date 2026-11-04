import { redirect } from "next/navigation";

// A importação agora é uma aba de Configurações; o endereço antigo continua funcionando.
export default function Pagina() {
  redirect("/configuracoes?aba=importar");
}
