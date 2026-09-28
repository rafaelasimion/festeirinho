'use client';

import { useState } from 'react';
import { MapPin, Check, Loader2 } from 'lucide-react';

// RN068 — captura opcional das coordenadas, mediante autorização do usuário.
//
// Estava duplicado nos dois cadastros. Como componente, a mensagem de erro
// fica contida aqui em vez de subir para o erro geral do formulário — que é
// o certo: falha de GPS não é falha do cadastro.

export default function CapturaLocalizacao({ coordenadas, aoAlterar, descricao }) {
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');

  function capturar() {
    setErro('');

    if (!navigator.geolocation) {
      setErro('Seu navegador não permite capturar a localização.');
      return;
    }

    setBuscando(true);
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        aoAlterar({
          latitude: posicao.coords.latitude,
          longitude: posicao.coords.longitude,
        });
        setBuscando(false);
      },
      () => {
        setErro('Não foi possível obter a localização. Você pode cadastrar sem ela.');
        setBuscando(false);
      },
      { timeout: 10000 }
    );
  }

  const capturada = Boolean(coordenadas);

  // O ícone fica num cabeçalho próprio, junto do título, e o resto ocupa a
  // largura inteira do cartão. Antes o ícone abria uma coluna à esquerda e
  // empurrava texto e botão para uma faixa estreita — no celular sobrava
  // pouco mais da metade do cartão, e tudo quebrava em muitas linhas.
  return (
    <div className={`rounded-xl border p-4 transition-colors ${capturada ? 'border-sucesso-200 bg-sucesso-50' : 'border-slate-200 bg-slate-50'
      }`}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${capturada ? 'bg-sucesso-600' : 'bg-festa-100'
          }`}>
          {capturada
            ? <Check className="h-5 w-5 text-white" aria-hidden="true" />
            : <MapPin className="h-5 w-5 text-festa-600" aria-hidden="true" />}
        </span>
        <p className={`text-sm font-medium ${capturada ? 'text-sucesso-800' : 'text-slate-800'}`}>
          {capturada ? 'Localização registrada' : 'Localização'}
        </p>
      </div>

      {capturada ? (
        <>
          <p className="mt-3 text-sm text-slate-600">
            Usada apenas para calcular distâncias na busca. Não é exibida a
            outros usuários.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={capturar}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
              Atualizar
            </button>
            <button type="button" onClick={() => { aoAlterar(null); setErro(''); }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">
              Remover
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-600">{descricao}</p>
          <button type="button" onClick={capturar} disabled={buscando}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-festa-600 px-3 py-2.5 text-sm font-medium text-festa-700 transition-colors hover:bg-festa-50 disabled:opacity-50">
            {buscando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {buscando ? 'Localizando...' : 'Usar minha localização'}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Opcional. Você pode concluir o cadastro sem informar.
          </p>
        </>
      )}

      {erro && <p className="mt-2 text-sm text-perigo-600">{erro}</p>}
    </div>
  );
}