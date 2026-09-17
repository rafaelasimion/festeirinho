'use client';

import { useState } from 'react';

// Descrição com três linhas visíveis e o resto recolhido.
//
// Precisa ser componente de cliente porque expandir e recolher acontece no
// navegador. O texto continua vindo do servidor, como propriedade.

export default function DescricaoExpansivel({ texto, linhas = 3 }) {
  const [expandida, setExpandida] = useState(false);

  // Aproximação: um card de vitrine cabe cerca de 90 caracteres por linha.
  // Abaixo disso não há o que recolher, e o botão só atrapalharia.
  const podeRecolher = texto.length > linhas * 90 || texto.includes('\n');

  return (
    <div className="mt-2">
      <p className={`whitespace-pre-line text-sm text-slate-700 ${
        expandida ? '' : 'line-clamp-3'
      }`}>
        {texto}
      </p>

      {podeRecolher && (
        <button type="button" onClick={() => setExpandida(!expandida)}
          aria-expanded={expandida}
          className="mt-1 text-sm font-medium text-festa-700 transition-colors hover:underline">
          {expandida ? 'Ver menos' : 'Ver mais'}
        </button>
      )}
    </div>
  );
}