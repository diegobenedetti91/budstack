import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Tracker } from "@/components/Tracker";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  title: { default: "BudStack — Tecnologia para vender online", template: "%s · BudStack" },
  description: "A BudStack cria e mantém lojas virtuais completas para marcas de moda: pagamento, nota fiscal, frete, atendimento com IA e gestão em uma só plataforma.",
};

export const viewport: Viewport = { themeColor: "#2F5BFF" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={font.variable}>
      <body>
        {children}
        <Tracker />
      </body>
    </html>
  );
}
