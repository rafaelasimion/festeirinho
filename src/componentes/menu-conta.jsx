import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

// Lista de opções em cartões, agrupadas por seção. É o formato da tela de
// perfil no protótipo, e serve para qualquer tela que ofereça um conjunto
// de caminhos em vez de um formulário.
//
// Cada item é um alvo de toque inteiro — o cartão todo é clicável, não só
// o texto. No celular isso é a diferença entre acertar e errar.

export function SecaoMenu({ titulo, children }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {titulo}
      </h2>
      {/* div, e não ul/li: o "Sair" precisa vir dentro de um <form>, e um
          <form> entre <ul> e <li> é HTML inválido. */}
      <div className="space-y-2">{children}</div>
    </section>
  );
}

const TONS = {
  normal: {
    caixa: 'bg-festa-100',
    icone: 'text-festa-600',
    titulo: 'text-slate-900',
  },
  perigo: {
    caixa: 'bg-perigo-50',
    icone: 'text-perigo-600',
    titulo: 'text-perigo-700',
  },
};

export function ItemMenu({
  href, Icone, titulo, descricao, tom = 'normal', ...resto
}) {
  const cores = TONS[tom] ?? TONS.normal;

  const classe =
    'flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left '
    + 'transition-colors hover:border-festa-200 hover:bg-festa-50/40 '
    + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-festa-600/40';

  const conteudo = (
    <>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${cores.caixa}`}>
        <Icone className={`h-5 w-5 ${cores.icone}`} aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className={`block font-medium ${cores.titulo}`}>{titulo}</span>
        {descricao && (
          <span className="mt-0.5 block text-sm text-slate-500">{descricao}</span>
        )}
      </span>

      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
    </>
  );

  if (href) {
    return <Link href={href} className={classe}>{conteudo}</Link>;
  }

  return <button className={classe} {...resto}>{conteudo}</button>;
}
