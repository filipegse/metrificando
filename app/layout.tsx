import type { ReactNode } from "react";
import "./globals.css";
import { Cabecalho } from "./componentes/Cabecalho";

export const metadata = { title: "Metrificando — TAP", description: "Plataforma de métricas da TAP" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Cabecalho />
        {children}
      </body>
    </html>
  );
}
