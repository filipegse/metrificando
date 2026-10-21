import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "Metrificando — TAP", description: "Plataforma de métricas da TAP" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
