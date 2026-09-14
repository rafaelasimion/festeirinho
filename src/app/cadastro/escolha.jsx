'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Os dois papéis usam radio de verdade, apenas escondidos visualmente.
// Assim a navegação por teclado e os leitores de tela funcionam sozinhos,
// sem precisar de nenhum atributo extra — o que atende o RNF013.

const OPCOES = [
  { valor: 'cliente', rotulo: 'Sou cliente', destino: '/cadastro/cliente' },
  { valor: 'fornecedor', rotulo: 'Sou fornecedor', destino: '/cadastro/fornecedor' },
];

export default function EscolhaCadastro() {
  const router = useRouter();
  const [escolha, setEscolha] = useState('cliente');

  function continuar() {
    const opcao = OPCOES.find((o) => o.valor === escolha);
    router.push(opcao.destino);
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <div className="rounded-lg-2xl border border-slate-200 bg-white p-8 sm:p-10">
        <h1 className="text-center text-2xl font-semibold text-slate-900">
          Cadastro
        </h1>
        <p className="mt-2 text-center text-slate-600">
          Antes, para qual finalidade deseja usar nosso sistema?
        </p>

        <fieldset className="mt-8">
          <legend className="sr-only">Tipo de conta</legend>

          <div className="grid grid-cols-2 gap-4">
            {OPCOES.map((opcao) => {
              const selecionada = escolha === opcao.valor;
              return (
                <label key={opcao.valor}
                  className={`relative flex cursor-pointer flex-col items-center gap-4
                    rounded-lg-xl border p-6 transition-colors
                    focus-within:ring-2 focus-within:ring-festa-600/40
                    ${selecionada
                      ? 'border-festa-600 bg-festa-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <input type="radio" name="tipoConta" value={opcao.valor}
                    checked={selecionada}
                    onChange={(e) => setEscolha(e.target.value)}
                    className="sr-only" />

                  {selecionada && (
                    <span aria-hidden="true"
                      className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg-full bg-festa-600">
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none"
                        stroke="white" strokeWidth="2.5" strokeLinecap="round"
                        strokeLinejoin="round">
                        <path d="M4 10.5l4 4 8-8" />
                      </svg>
                    </span>
                  )}

                  {opcao.valor === 'cliente' ? (
                    <IconeCliente selecionada={selecionada} />
                  ) : (
                    <IconeFornecedor selecionada={selecionada} />
                  )}

                  <span className="text-center text-slate-700">{opcao.rotulo}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-8 space-y-3">
          <button type="button" onClick={continuar}
            className="w-full rounded-lg bg-festa-600 px-4 py-3 font-medium text-white transition-colors hover:bg-festa-700">
            Continuar
          </button>

          <button type="button" onClick={() => router.back()}
            className="w-full rounded-lg border border-festa-600 px-4 py-3 font-medium text-festa-700 transition-colors hover:bg-festa-50">
            Voltar
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          Já tem conta?{' '}
          <a href="/login" className="font-medium text-festa-700 hover:underline">
            Entrar
          </a>
        </p>
      </div>
    </main>
  );
}

function IconeCliente({ selecionada }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true"
      className={`h-16 w-16 ${selecionada ? 'text-festa-600' : 'text-slate-400'}`}
      fill="currentColor">
      <circle cx="24" cy="16" r="9" />
      <path d="M8 44c0-8.8 7.2-16 16-16s16 7.2 16 16z" />
    </svg>
  );
}

function IconeFornecedor({ selecionada }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true"
      className={`h-16 w-16 ${selecionada ? 'text-festa-600' : 'text-slate-400'}`}
      fill="currentColor">
      <rect x="6" y="8" width="36" height="6" rx="1.5" />
      <path d="M8 18h32v22H8z" />
      <rect x="16" y="27" width="16" height="13" fill="white" />
    </svg>
  );
}