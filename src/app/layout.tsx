import type { Metadata } from "next";
import localFont from "next/font/local";
import { siteConfig } from "@/config/site";
import "./globals.css";

const poppins = localFont({
  src: [
    { path: "../assets/fonts/poppins-latin-400.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/poppins-latin-500.woff2", weight: "500", style: "normal" },
    { path: "../assets/fonts/poppins-latin-600.woff2", weight: "600", style: "normal" },
    { path: "../assets/fonts/poppins-latin-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-activant",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${siteConfig.name} | Bienestar institucional`, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-CO" className={poppins.variable}>
    <body className="flex min-h-dvh flex-col antialiased">
      <a href="#contenido" className="skip-link">Saltar al contenido principal</a>
      {children}
    </body>
  </html>;
}
