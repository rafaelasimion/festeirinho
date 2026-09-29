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
      <MolduraFoto className="aspect-[16/9] rounded-2xl">
        <span className="sr-only">Este serviço ainda não tem fotos.</span>
      </MolduraFoto>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl bg-festa-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fotos[emDestaque].imagem_url} alt={nomeServico}
          className="aspect-[16/9] w-full object-cover" />
      </div>

      {fotos.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {fotos.map((foto, posicao) => (
            <li key={foto.id}>
              <button type="button" onClick={() => setEmDestaque(posicao)}
                aria-label={`Ver foto ${posicao + 1} de ${fotos.length}`}
                aria-current={posicao === emDestaque}
                className={`block overflow-hidden rounded-lg transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-festa-600/40 ${
                  posicao === emDestaque
                    ? 'ring-2 ring-festa-600'
                    : 'opacity-70 hover:opacity-100'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={foto.imagem_url} alt="" className="h-16 w-20 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
