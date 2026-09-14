import { Poppins } from 'next/font/google';
import './globals.css';
import Cabecalho from '@/componentes/cabecalho';

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
        <Cabecalho />
        {children}
      </body>
    </html>
  );
}