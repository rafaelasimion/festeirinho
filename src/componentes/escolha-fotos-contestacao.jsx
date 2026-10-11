'use client';

import { useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import {
  LIMITE_FOTOS_CONTESTACAO,
  TIPOS_FOTO_CONTESTACAO,
  TAMANHO_MAXIMO_FOTO_CONTESTACAO,
  AVISO_FOTOS_CONTESTACAO,
} from '@/lib/contestacao';

// RF069-B — a escolha das fotos dentro do formulário de quem relata: o
// cliente na contestação (UC 042), o fornecedor na sua versão (UC 046).
//
// As fotos ficam só no navegador até o envio do formulário, e vão junto com
// o texto, num envio só (RN069). Por isso a lista é de quem chama: é ele que
// as manda. Aqui fica a conferência e a miniatura.
//
// O botão de anexar é a última casa da própria fileira de miniaturas: a
// foto escolhida aparece no lugar onde se clicou, e não há um botão solto
// com um contador ao lado dizendo a mesma coisa que a fileira já mostra.
// Formato e tamanho não são explicados de antemão — quem escolhe um arquivo
// fora deles fica sabendo na hora, pelo nome do arquivo.
//
// Cada foto escolhida guarda o arquivo e um endereço temporário para a
// miniatura (URL.createObjectURL), que segura o arquivo na memória do
// navegador até ser liberado. Tirar uma foto da lista libera a dela; ao
// enviar ou desistir, quem chama libera o resto com descartarFotos.
export function descartarFotos(fotos) {
  fotos.forEach((foto) => URL.revokeObjectURL(foto.miniatura));
}

export default function EscolhaFotosContestacao({
  id, fotos, aoAlterar, processando, aviso: avisoPrevio = AVISO_FOTOS_CONTESTACAO,
}) {
  const [aviso, setAviso] = useState('');
  const cheio = fotos.length >= LIMITE_FOTOS_CONTESTACAO;

  // As fotos são conferidas ao serem escolhidas: formato e tamanho errados
  // nem entram na lista, e o limite corta o excedente. Assim o que está na
  // lista não é recusado depois pelo mesmo motivo. Quem manda continua sendo
  // o servidor, que confere os primeiros bytes de cada arquivo.
  function escolher(evento) {
    const arquivos = Array.from(evento.target.files ?? []);
    evento.target.value = ''; // permite escolher o mesmo arquivo de novo
    const recusadas = [];
    const aceitas = arquivos.filter((arquivo) => {
      if (!TIPOS_FOTO_CONTESTACAO.includes(arquivo.type)) {
        recusadas.push(`${arquivo.name} não é JPG, PNG ou WEBP`);
        return false;
      }
      if (arquivo.size > TAMANHO_MAXIMO_FOTO_CONTESTACAO) {
        recusadas.push(`${arquivo.name} passa de 5 MB`);
        return false;
      }
      return true;
    });

    const vagas = LIMITE_FOTOS_CONTESTACAO - fotos.length;
    const entram = aceitas.slice(0, Math.max(vagas, 0));
    if (aceitas.length > entram.length) {
      recusadas.push(`o limite é de ${LIMITE_FOTOS_CONTESTACAO} fotos`);
    }

    const agora = Date.now();
    aoAlterar([
      ...fotos,
      ...entram.map((arquivo, posicao) => ({
        chave: `${agora}-${posicao}`,
        arquivo,
        miniatura: URL.createObjectURL(arquivo),
      })),
    ]);
    setAviso(recusadas.length > 0 ? `Ficaram de fora: ${recusadas.join('; ')}.` : '');
  }

  function tirar(chave) {
    const removida = fotos.find((foto) => foto.chave === chave);
    if (removida) descartarFotos([removida]);
    aoAlterar(fotos.filter((foto) => foto.chave !== chave));
    setAviso('');
  }

  return (
    <div>
      <p className="text-sm font-medium text-slate-700">
        Fotos{' '}
        <span className="font-normal text-slate-500">
          (opcional, até {LIMITE_FOTOS_CONTESTACAO})
        </span>
      </p>
      {/* RN069 / LGPD — o aviso vem antes da escolha, como o do chat: quem
          anexa precisa saber quem vai ver e por quanto tempo. E a foto de
          festa infantil quase sempre pega criança; o pedido de enquadrar o
          serviço é o jeito mais simples de guardar menos do que não é
          necessário à análise. */}
      <p className="mt-0.5 text-xs text-slate-500">{avisoPrevio}</p>

      <ul className="mt-2 flex flex-wrap gap-2">
        {fotos.map((foto) => (
          <li key={foto.chave}
            className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto.miniatura} alt={foto.arquivo.name}
              className="h-full w-full object-cover" />
            <button type="button" onClick={() => tirar(foto.chave)}
              disabled={processando} aria-label={`Tirar ${foto.arquivo.name}`}
              className="absolute right-1 top-1 rounded-md bg-white/90 p-0.5 text-slate-600 shadow-sm transition-colors hover:bg-perigo-50 hover:text-perigo-700 disabled:opacity-50">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}

        {/* Cheio, a casa de anexar some: a fileira completa já diz que não
            cabe mais nenhuma. */}
        {!cheio && (
          <li>
            <input type="file" id={id} multiple
              accept={TIPOS_FOTO_CONTESTACAO.join(',')}
              onChange={escolher}
              disabled={processando}
              className="peer sr-only" />
            <label htmlFor={id}
              aria-disabled={processando}
              className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white text-xs text-slate-500 transition-colors hover:border-atencao-600 hover:text-atencao-700 peer-focus-visible:ring-2 peer-focus-visible:ring-festa-600/40 ${
                processando ? 'pointer-events-none opacity-50' : ''}`}>
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
              Adicionar
            </label>
          </li>
        )}
      </ul>
      {aviso && <p className="mt-1.5 text-xs text-perigo-600">{aviso}</p>}
    </div>
  );
}
