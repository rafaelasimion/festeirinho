'use client';

import { useState } from 'react';
import MolduraFoto from '@/componentes/moldura-foto';

// Galeria das fotos do serviço (RF012).
//
// Componente de cliente porque trocar a foto em destaque acontece no
// navegador. As imagens vêm prontas do servidor.

export default function GaleriaFotos({ fotos, nomeServico }) {
  const [emDestaque, setEmDestaque] = useState(0);

  if (fotos.length === 0) {
    return (
      <MolduraFoto className="aspect-[4/3] rounded-2xl">
        <span className="sr-only">Este serviço ainda não tem fotos.</span>
      </MolduraFoto>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl bg-festa-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* 4:3 como nos cards: as fotos de festa são quase todas retrato
            ou quadradas, e o 16/9 cortava a decoração em cima e embaixo
            justamente onde ela está. */}
        <img src={fotos[emDestaque].imagem_url} alt={nomeServico}
          className="aspect-[4/3] w-full object-cover" />
      </div>

      {/* O -m-1/p-1 da lista existe por causa do anel da miniatura
          selecionada: overflow-x-auto recorta tudo que passa da caixa, e o
          anel, que é desenhado para FORA da borda, sumia em cima e à
          esquerda. O padding dá o espaço do anel dentro da área de rolagem
          e a margem negativa devolve o alinhamento. */}
      {fotos.length > 1 && (
        <ul className="-m-1 flex gap-2 overflow-x-auto p-1">
          {fotos.map((foto, posicao) => (
            // shrink-0 porque a lista é para ROLAR, não para apertar: sem
            // ele o flex encolhia as cinco miniaturas até caberem na
            // largura do celular, e a 390px elas viravam 65x60 — nem 4:3,
            // nem roláveis.
            <li key={foto.id} className="shrink-0">
              <button type="button" onClick={() => setEmDestaque(posicao)}
                aria-label={`Ver foto ${posicao + 1} de ${fotos.length}`}
                aria-current={posicao === emDestaque}
                className={`block overflow-hidden rounded-lg transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-festa-600/40 ${
                  posicao === emDestaque
                    ? 'ring-2 ring-festa-600'
                    : 'opacity-70 hover:opacity-100'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={foto.imagem_url} alt="" className="h-15 w-20 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
