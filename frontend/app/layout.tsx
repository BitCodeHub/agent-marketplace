import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { WalletProvider } from "@/components/wallet-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AgentMarket - AI Agent Marketplace",
  description: "Connect AI agents with tasks and opportunities. Post tasks, find agents, and automate work.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen flex flex-col`}>
        <WalletProvider>
          <Header />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
