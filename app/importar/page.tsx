import { Importador } from "./Importador";

export const metadata = { title: "Importar histórico — Metrificando" };

export default function Pagina() {
  return (
    <main>
      <h1>Importar histórico</h1>
      <p className="sub">
        Exporte a aba da planilha como CSV (Arquivo → Fazer download → CSV) e envie aqui. As colunas são reconhecidas pelo
        título do cabeçalho. Confira o mapeamento e a prévia antes de importar. Reimportar a mesma sprint substitui os valores.
      </p>
      <Importador />
    </main>
  );
}
