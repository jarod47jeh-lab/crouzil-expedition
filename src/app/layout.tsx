import type { Metadata } from "next";
import { Toaster } from "sonner";
import "@fontsource-variable/bricolage-grotesque/index.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Espace Expédition", template: "%s · Espace Expédition" },
  description: "Crouzil Boissons : congés, réparations, erreurs de livraison et journal de bord du service expédition.",
  robots: { index: false, follow: false },
};

const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <Toaster position="bottom-right" richColors closeButton toastOptions={{ style: { fontFamily: "var(--font-sans)" } }} />
      </body>
    </html>
  );
}
