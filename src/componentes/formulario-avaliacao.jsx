'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import SeletorNota from '@/componentes/seletor-nota';
import TituloPainel from '@/componentes/titulo-painel';
import OpcoesRadio from '@/componentes/opcoes-radio';
import { VISIBILIDADES, ROTULO_NOTA } from '@/lib/avaliacao';

// UC 021 — formulário de avaliação, exibido na solicitação concluída.
// Depois de enviada, mostra o que foi registrado: uma avaliação por
// solicitação, sem edição (RN006).
//
// Fica num cartão próprio, abaixo do resumo, e cada estado abre com o seu
// título. Antes ela vivia no fim do cartão do painel e começava com uma
// divisória, para se separar do que estivesse aberto acima dela — sozinha
// no cartão, sobrava uma linha sem nada em cima.

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
      <div className="space-y-2">
        <TituloPainel icone={Star} titulo="Sua avaliação" />
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
          <p className="whitespace-pre-line text-sm text-slate-700">
            {avaliacao.comentario}
          </p>
        )}
        <p className="text-xs text-slate-500">
          Você avaliou este serviço. Cada solicitação admite uma avaliação.
        </p>
      </div>
    );
  }

  if (!aberto) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TituloPainel icone={Star} titulo="Como foi o serviço?">
          Sua avaliação ajuda outros clientes a escolher.
        </TituloPainel>
        <button type="button" onClick={() => setAberto(true)}
          className="shrink-0 rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700">
          Avaliar serviço
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TituloPainel icone={Star} titulo="Avaliar serviço" />

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

      <OpcoesRadio nome="visibilidade-avaliacao" legenda="Visibilidade do comentário"
        opcoes={VISIBILIDADES} valor={visibilidade} aoEscolher={setVisibilidade}
        desabilitado={processando}>
        <p className="mt-2 text-xs text-slate-500">
          A nota sempre conta na média do serviço, qualquer que seja a visibilidade.
        </p>
      </OpcoesRadio>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={processando || nota === 0}
          onClick={() => aoEnviar({ nota, comentario, visibilidade })}
          className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
          {processando ? 'Enviando...' : 'Enviar avaliação'}
        </button>
        <button type="button" onClick={() => setAberto(false)} disabled={processando}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
          Voltar
        </button>
      </div>
    </div>
  );
}
