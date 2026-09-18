'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { NOTAS, ROTULO_NOTA } from '@/lib/avaliacao';

// Seletor de nota em estrelas.
//
// São botões de verdade, um por estrela, cada um com rótulo acessível
// ("3 de 5 estrelas"). Quem navega por teclado percorre as cinco com Tab e
// escolhe com Enter; quem usa leitor de tela ouve o que está escolhendo.

export default function SeletorNota({ nota, aoEscolher, desabilitado = false }) {
  const [emFoco, setEmFoco] = useState(0);
  const destaque = emFoco || nota;

  return (
    <div>
      <div className="flex items-center gap-1" onMouseLeave={() => setEmFoco(0)}>
        {NOTAS.map((valor) => (
          <button key={valor} type="button" disabled={desabilitado}
            onClick={() => aoEscolher(valor)}
            onMouseEnter={() => setEmFoco(valor)}
            onFocus={() => setEmFoco(valor)}
            onBlur={() => setEmFoco(0)}
            aria-label={`${valor} de 5 estrelas — ${ROTULO_NOTA[valor]}`}
            aria-pressed={nota === valor}
            className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-festa-600/40 disabled:cursor-not-allowed">
            <Star className={`h-8 w-8 ${
              valor <= destaque
                ? 'fill-atencao-600 text-atencao-600'
                : 'text-slate-300'
            }`} />
          </button>
        ))}
      </div>
      <p className="mt-1 h-5 text-sm text-slate-600">
        {destaque ? ROTULO_NOTA[destaque] : 'Escolha uma nota'}
      </p>
    </div>
  );
}
