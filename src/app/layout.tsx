import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: "Assessoria 3.0 Intelligence",
  description: "Centro de control de contratos, comercializadoras, comisiones y cartera energética de Assessoria 3.0.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0c0f",
  width: "device-width",
  initialScale: 1,
};

// Aplica el tema guardado antes de pintar para evitar parpadeo
const themeScript = `try{var s=JSON.parse(localStorage.getItem('a30.settings.v1')||'{}');document.documentElement.dataset.theme=s.theme||'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
