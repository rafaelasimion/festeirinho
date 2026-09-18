'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import SeletorNota from '@/componentes/seletor-nota';
import { VISIBILIDADES, ROTULO_NOTA } from '@/lib/avaliacao';

// UC 021 — formulário de avaliação, exibido na solicitação concluída.
// Depois de enviada, mostra o que foi registrado: uma avaliação por
// solicitação, sem edição (RN006).

export default function FormularioAvaliacao({
  avaliacao, processando, aoEnviar,
}) {
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [visibilidade, setVisibilidade] = useState('visivel');

  // Já avaliada: mostra o registro, sem botões.
  if (avaliacao?.id) {
    return (
      <div className="mt-4 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((posicao) => (
              <Star key={posicao} className={`h-4 w-4 ${
                posicao <= avaliacao.nota
                  ? 'fill-atencao-600 text-atencao-600'
                  : 'text-slate-300'
              }`} />
            ))}
          </span>
          <span className="text-sm text-slate-600">
            {ROTULO_NOTA[avaliacao.nota]}
            {avaliacao.status_avaliacao === 'oculta' && ' · comentário privado'}
          </span>
        </div>
        {avaliacao.comentario && (
          <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
            {avaliacao.comentario}
          </p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          Você avaliou este serviço. Cada solicitação admite uma avaliação.
        </p>
      </div>
    );
  }

  if (!aberto) {
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p className="text-sm text-slate-600">
          Como foi o serviço? Sua avaliação ajuda outros clientes a escolher.
        </p>
        <button type="button" onClick={() => setAberto(true)}
          className="shrink-0 rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700">
          Avaliar serviço
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          Sua nota
        </span>
        <SeletorNota nota={nota} aoEscolher={setNota} desabilitado={processando} />
      </div>

      <div>
        <label htmlFor="comentario-avaliacao"
          className="mb-1.5 block text-sm font-medium text-slate-700">
          Comentário <span className="font-normal text-slate-500">(opcional)</span>
        </label>
        <textarea id="comentario-avaliacao" rows={3} value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Conte como foi: pontualidade, qualidade, atendimento."
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">
          Visibilidade do comentário
        </legend>
        {VISIBILIDADES.map(({ valor, rotulo, detalhe }) => (
          <label key={valor}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
              visibilidade === valor
                ? 'border-festa-600 bg-festa-50'
                : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <input type="radio" name="visibilidade-avaliacao" value={valor}
              checked={visibilidade === valor}
              onChange={(e) => setVisibilidade(e.target.value)}
              className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium text-slate-800">{rotulo}</span>
              <span className="block text-xs text-slate-500">{detalhe}</span>
            </span>
          </label>
        ))}
        <p className="text-xs text-slate-500">
          A nota é sempre contabilizada na média do serviço, qualquer que seja
          a visibilidade escolhida.
        </p>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={processando || nota === 0}
          onClick={() => aoEnviar({ nota, comentario, visibilidade })}
          className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
          {processando ? 'Enviando...' : 'Enviar avaliação'}
        </button>
        <button type="button" onClick={() => setAberto(false)} disabled={processando}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
          Voltar
        </button>
      </div>
    </div>
  );
}
