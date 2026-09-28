'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

// Navegação do cabeçalho.
//
// Os links do fornecedor somam muito texto — "Solicitações recebidas"
// sozinho já ocupa metade da barra no celular. Até 1024px eles ficam
// atrás de um botão; daí para cima aparecem em linha, que é quando há
// espaço de sobra.
//
// O componente é de cliente porque precisa de estado (aberto/fechado) e
// do endereço atual para destacar a página em que a pessoa está. Os
// links, porém, vêm prontos do servidor: quem decide o que cada papel vê
// continua sendo o cabeçalho.

export default function MenuNavegacao({ links }) {
  const [aberto, setAberto] = useState(false);
  const caminho = usePathname();

  function classeLink(href) {
    const atual = caminho === href;
    return `transition-colors ${atual ? 'font-medium text-festa-700' : 'text-slate-700 hover:text-festa-700'}`;
  }

  return (
    <>
      {/* Desktop: tudo em linha. */}
      <div className="hidden items-center gap-5 text-sm lg:flex">
        {links.map(({ href, rotulo }) => (
          <Link key={href} href={href} className={classeLink(href)}>
            {rotulo}
          </Link>
        ))}
      </div>

      {/* Celular e tablet: botão que abre a lista embaixo da barra. */}
      {links.length > 0 && (
        <button type="button" onClick={() => setAberto((atual) => !atual)}
          aria-expanded={aberto}
          aria-controls="menu-navegacao"
          aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 lg:hidden">
          {aberto
            ? <X className="h-6 w-6" aria-hidden="true" />
            : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
      )}

      {aberto && (
        <div id="menu-navegacao"
          className="absolute inset-x-0 top-full z-20 border-b border-slate-200 bg-white shadow-sm lg:hidden">
          <div className="mx-auto flex max-w-4xl flex-col gap-1 px-6 py-3">
            {links.map(({ href, rotulo }) => (
              <Link key={href} href={href} onClick={() => setAberto(false)}
                className={`rounded-lg px-2 py-3 ${classeLink(href)}`}>
                {rotulo}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
