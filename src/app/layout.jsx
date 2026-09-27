import { Poppins } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import Cabecalho from '@/componentes/cabecalho';
import CabecalhoVisibilidade from '@/componentes/cabecalho-visibilidade';

// A variável precisa ficar no <html>, e não no <body>: o Tailwind aplica a
// família de fonte no elemento html, que está acima do body e não enxergaria
// uma variável declarada lá dentro.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata = {
  title: 'Festeirinho',
  description: 'Plataforma de contratação de serviços para festas infantis.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={poppins.variable}>
      <body className="antialiased">
        <CabecalhoVisibilidade>
          <Cabecalho />
        </CabecalhoVisibilidade>
        {children}

        {/* UC 039, fluxo 2a — o "menu geral de ajuda": daqui o suporte
            abre sem contexto de solicitação, de qualquer tela e mesmo
            sem login. O cabeçalho já está cheio; o rodapé cobre tudo
            sem disputar espaço. */}
        <footer className="mt-16 border-t border-slate-200">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-slate-500">
            <span>Festeirinho</span>
            <Link href="/suporte" className="font-medium text-festa-700 hover:underline">
              Falar com o suporte
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}