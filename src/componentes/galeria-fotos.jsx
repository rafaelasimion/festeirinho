'use client';

import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

// Galeria das fotos do serviço (RF012).
//
// Componente de cliente porque trocar a foto em destaque acontece no
// navegador. As imagens vêm prontas do servidor.

export default function GaleriaFotos({ fotos, nomeServico }) {
  const [emDestaque, setEmDestaque] = useState(0);

  if (fotos.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-2xl bg-festa-100">
        <ImageIcon className="h-12 w-12 text-festa-600" aria-hidden="true" />
        <span className="sr-only">Este serviço ainda não tem fotos.</span>
      </div>
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
