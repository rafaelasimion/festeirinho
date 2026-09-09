import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Cabecalho from '@/componentes/cabecalho';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Festeirinho',
  description: 'Plataforma de contratação de serviços para festas infantis.',
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Cabecalho />
        {children}
        </body>
    </html>
  );
}
