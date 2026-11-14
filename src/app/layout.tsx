import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${siteConfig.name} | Bienestar institucional`, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-CO">
    <body className="flex min-h-dvh flex-col antialiased">
      <a href="#contenido" className="skip-link">Saltar al contenido principal</a>
      {children}
    </body>
  </html>;
}
