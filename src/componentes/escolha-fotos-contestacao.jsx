'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ImagePlus, X, Headset } from 'lucide-react';
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
// Cada foto escolhida guarda o arquivo e um endereço temporário para a
// miniatura (URL.createObjectURL), que segura o arquivo na memória do
// navegador até ser liberado. Tirar uma foto da lista libera a dela; ao
// enviar ou desistir, quem chama libera o resto com descartarFotos.
export function descartarFotos(fotos) {
  fotos.forEach((foto) => URL.revokeObjectURL(foto.miniatura));
}

export default function EscolhaFotosContestacao({
  id, idSolicitacao, fotos, aoAlterar, processando, orientacao,
}) {
  const [aviso, setAviso] = useState('');
  const cheio = fotos.length >= LIMITE_FOTOS_CONTESTACAO;
  const travado = processando || cheio;

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
      <p className="mb-1.5 text-sm font-medium text-slate-700">
        Fotos <span className="font-normal text-slate-500">(opcional)</span>
      </p>
      <p className="text-xs text-slate-600">
        {orientacao} Até {LIMITE_FOTOS_CONTESTACAO} imagens JPG, PNG ou WEBP, de até 5 MB cada.
      </p>
      {/* RN069 / LGPD — o aviso vem antes da escolha, como o do chat: quem
          anexa precisa saber quem vai ver e por quanto tempo. E a foto de
          festa infantil quase sempre pega criança; o pedido de enquadrar o
          serviço é o jeito mais simples de guardar menos do que não é
          necessário à análise. */}
      <p className="mt-2 rounded-md bg-white px-2.5 py-2 text-xs text-slate-600">
        {AVISO_FOTOS_CONTESTACAO}
      </p>

      {fotos.length > 0 && (
        <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {fotos.map((foto) => (
            <li key={foto.chave}
              className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto.miniatura} alt={foto.arquivo.name}
                className="aspect-square w-full object-cover" />
              <button type="button" onClick={() => tirar(foto.chave)}
                disabled={processando} aria-label={`Tirar ${foto.arquivo.name}`}
                className="absolute right-1 top-1 rounded-md bg-white/90 p-1 text-slate-600 shadow-sm transition-colors hover:bg-perigo-50 hover:text-perigo-700 disabled:opacity-50">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input type="file" id={id} multiple
        accept={TIPOS_FOTO_CONTESTACAO.join(',')}
        onChange={escolher}
        disabled={travado}
        className="sr-only" />
      <label htmlFor={id}
        aria-disabled={travado}
        className={`mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-atencao-600 bg-white px-3 py-1.5 text-sm font-medium text-atencao-700 transition-colors hover:bg-atencao-50 ${
          travado ? 'pointer-events-none opacity-50' : ''}`}>
        <ImagePlus className="h-4 w-4" aria-hidden="true" />
        Anexar fotos
        <span className="font-normal text-atencao-600">
          ({fotos.length} de {LIMITE_FOTOS_CONTESTACAO})
        </span>
      </label>
      {aviso && <p className="mt-1.5 text-xs text-perigo-600">{aviso}</p>}

      {/* RN063 — o que não é imagem vai pelo suporte, que é externo e aceita
          vídeo e documento por conta própria. O número da solicitação segue
          junto na mensagem, para o atendente abrir o caso certo. */}
      <Link href={`/suporte?assunto=contratacao&origem=solicitacao&solicitacao=${idSolicitacao}`}
        className="mt-2 flex w-fit items-center gap-1.5 text-xs font-medium text-festa-700 hover:underline">
        <Headset className="h-3.5 w-3.5" aria-hidden="true" />
        Vídeo ou documento? Envie pelo suporte
      </Link>
    </div>
  );
}
