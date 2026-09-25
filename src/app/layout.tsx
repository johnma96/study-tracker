import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { loadSessionSnapshot } from "@/app/current-session";
import { SessionBar } from "@/ui/session-bar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "study-tracker",
  description: "Registro de sesiones de estudio por programa.",
};

/**
 * El layout lee de la base en cada solicitud.
 *
 * `force-dynamic` es obligatorio aquí: sin él, Next prerenderiza el layout en
 * tiempo de construcción y la barra de sesión quedaría congelada con el estado
 * que hubiera al compilar. Una sesión en curso es, por definición, lo que más
 * cambia entre una solicitud y la siguiente.
 */
export const dynamic = "force-dynamic";

/**
 * RF-2I — el estado de la sesión se muestra en **todas** las vistas, y desde
 * todas se puede cerrar o descartar (RF-2F). Por eso la barra vive en el
 * layout: con una sola página el resultado se vería igual poniéndola en la
 * página, pero la segunda vista que se añada heredaría el requerimiento sin que
 * nadie tenga que acordarse.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const snapshot = await loadSessionSnapshot();

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionBar snapshot={snapshot} />
        {children}
      </body>
    </html>
  );
}
