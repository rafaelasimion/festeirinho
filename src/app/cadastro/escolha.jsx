'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Store, Check } from 'lucide-react';
import MolduraAuth from '@/componentes/moldura-auth';

// Os dois papéis usam radio de verdade, apenas escondidos visualmente.
// Assim a navegação por teclado e os leitores de tela funcionam sozinhos,
// sem precisar de nenhum atributo extra — o que atende o RNF013.

const OPCOES = [
  {
    valor: 'cliente',
    rotulo: 'Sou cliente',
    destino: '/cadastro/cliente',
    Icone: User,
    cor: 'text-festa-600',
  },
  {
    valor: 'fornecedor',
    rotulo: 'Sou fornecedor',
    destino: '/cadastro/fornecedor',
    Icone: Store,
    cor: 'text-atencao-600',
  },
];

export default function EscolhaCadastro() {
  const router = useRouter();
  const [escolha, setEscolha] = useState('cliente');

  function continuar() {
    const opcao = OPCOES.find((o) => o.valor === escolha);
    router.push(opcao.destino);
  }

  return (
    <MolduraAuth largura="max-w-lg">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Cadastro</h1>
        <p className="mt-1.5 text-slate-600">
          Antes, para qual finalidade deseja usar nosso sistema?
        </p>
      </div>

      <fieldset className="mt-8">
        <legend className="sr-only">Tipo de conta</legend>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {OPCOES.map(({ valor, rotulo, Icone, cor }) => {
            const selecionada = escolha === valor;
            return (
              <label key={valor}
                className={`relative flex cursor-pointer flex-col items-center gap-3
                  rounded-2xl border p-5 transition-colors sm:p-6
                  focus-within:ring-2 focus-within:ring-festa-600/40
                  ${selecionada
                    ? 'border-festa-600 bg-festa-50'
                    : 'border-slate-200 bg-white hover:border-festa-200'}`}>
                <input type="radio" name="tipoConta" value={valor}
                  checked={selecionada}
                  onChange={(e) => setEscolha(e.target.value)}
                  className="sr-only" />

                {selecionada && (
                  <span aria-hidden="true"
                    className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-festa-600">
                    <Check className="h-4 w-4 text-white" strokeWidth={3} />
                  </span>
                )}

                <Icone aria-hidden="true" strokeWidth={1.5}
                  className={`h-12 w-12 sm:h-14 sm:w-14 ${selecionada ? cor : 'text-slate-400'}`} />

                <span className="text-center text-sm text-slate-700 sm:text-base">
                  {rotulo}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-8 space-y-3">
        <button type="button" onClick={continuar}
          className="w-full rounded-xl bg-festa-600 px-4 py-3.5 font-semibold text-white transition-colors hover:bg-festa-700">
          Continuar
        </button>

        <button type="button" onClick={() => router.back()}
          className="w-full rounded-xl border border-festa-600 px-4 py-3.5 font-semibold text-festa-700 transition-colors hover:bg-festa-50">
          Voltar
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-festa-700 hover:underline">
          Entrar
        </Link>
      </p>
    </MolduraAuth>
  );
}
