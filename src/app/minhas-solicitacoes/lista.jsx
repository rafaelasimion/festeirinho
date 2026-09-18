'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Etiqueta from '@/componentes/etiqueta';
import DialogoCancelamento from '@/componentes/dialogo-cancelamento';
import {
  formatarPreco,
  ROTULO_STATUS_SOLICITACAO,
  TOM_STATUS_SOLICITACAO,
  ROTULO_MOTIVO_RECUSA,
} from '@/lib/solicitacao';
import {
  ROTULO_STATUS_CANCELAMENTO,
  ROTULO_ORIGEM_CANCELAMENTO,
  impedimentoParaCancelar,
} from '@/lib/cancelamento';

function formatarDataHora(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function ListaMinhasSolicitacoes({ solicitacoes, prazoConfirmacaoHoras }) {
  const router = useRouter();
  const [cancelando, setCancelando] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  async function acionar(idSolicitacao, corpo, textoSucesso) {
    setErro('');
    setMensagem('');
    setProcessando(true);

    try {
      const resposta = await fetch(`/api/solicitacoes/${idSolicitacao}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não foi possível concluir a operação.');
        return;
      }

      setCancelando(null);
      setMensagem(
        dados.aguardandoDadosRecebimento
          ? 'Cancelamento registrado. Como o pagamento foi por boleto, você precisará informar os dados para receber o reembolso.'
          : textoSucesso
      );
      router.refresh();
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Minhas solicitações</h1>
        <Link href="/servicos" className="text-sm font-medium text-festa-700 hover:underline">
          Buscar serviços
        </Link>
      </div>

      {mensagem && <p className="mb-4 text-sm text-sucesso-700">{mensagem}</p>}
      {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}

      {solicitacoes.length === 0 ? (
        <p className="text-sm text-slate-600">
          Você ainda não enviou nenhuma solicitação.{' '}
          <Link href="/servicos" className="underline">Ver serviços disponíveis</Link>.
        </p>
      ) : (
        <ul className="space-y-4">
          {solicitacoes.map((solicitacao) => {
            const aguardandoConfirmacao =
              solicitacao.status === 'confirmado'
              && Boolean(solicitacao.data_registro_conclusao_fornecedor)
              && !solicitacao.data_confirmacao_conclusao_cliente;

            // RN041 — cancelar só antes do evento, em status que admita.
            const impedimento = impedimentoParaCancelar({
              status: solicitacao.status,
              dataEvento: solicitacao.data_hora_evento,
              temCancelamento: Boolean(solicitacao.id_cancelamento),
            });
            const podeCancelar = impedimento === null;

            const pagamento = solicitacao.id_pagamento ? {
              status: solicitacao.status_pagamento,
              valor_bruto: solicitacao.valor_bruto,
              perc_multa_faixa_mais_7d: solicitacao.perc_multa_faixa_mais_7d,
              perc_multa_faixa_7d_48h: solicitacao.perc_multa_faixa_7d_48h,
              perc_multa_faixa_48h_24h: solicitacao.perc_multa_faixa_48h_24h,
              perc_multa_faixa_24h: solicitacao.perc_multa_faixa_24h,
            } : null;

            return (
              <li key={solicitacao.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-medium text-slate-900">{solicitacao.servico}</h2>
                    <p className="text-sm text-slate-600">{solicitacao.fornecedor}</p>
                    <p className="mt-2 text-sm text-slate-700">
                      {formatarDataHora(solicitacao.data_hora_evento)} ·{' '}
                      {solicitacao.duracao}h · {solicitacao.numero_convidados} convidados
                    </p>
                    <p className="text-sm text-slate-600">
                      {solicitacao.cidade}/{solicitacao.estado}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-slate-900">
                      {formatarPreco(solicitacao.valor_final)}
                    </p>
                    <div className="mt-1.5">
                      <Etiqueta tom={TOM_STATUS_SOLICITACAO[solicitacao.status]}>
                        {ROTULO_STATUS_SOLICITACAO[solicitacao.status]}
                      </Etiqueta>
                    </div>
                  </div>
                </div>

                {solicitacao.status === 'aguardando_analise' && (
                  <p className="mt-3 text-xs text-slate-500">
                    O fornecedor tem até{' '}
                    {formatarDataHora(solicitacao.data_limite_resposta_fornecedor)} para responder.
                  </p>
                )}

                {solicitacao.status === 'aguardando_pagamento' && solicitacao.id_pagamento && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                    <p className="text-sm text-slate-600">
                      Pague até {formatarDataHora(solicitacao.data_limite)} para confirmar.
                    </p>
                    <Link href={`/pagamento/${solicitacao.id_pagamento}`}
                      className="shrink-0 rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700">
                      Pagar
                    </Link>
                  </div>
                )}

                {/* UC 020 — confirmação da conclusão */}
                {aguardandoConfirmacao && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="text-sm text-slate-700">
                      O fornecedor registrou a conclusão do serviço em{' '}
                      {formatarDataHora(solicitacao.data_registro_conclusao_fornecedor)}.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Se você não responder em {prazoConfirmacaoHoras} horas, o sistema
                      confirma automaticamente.
                    </p>
                    <button type="button" disabled={processando}
                      onClick={() => acionar(
                        solicitacao.id,
                        { acao: 'confirmar_conclusao' },
                        'Conclusão confirmada. Obrigado!'
                      )}
                      className="mt-3 rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
                      Confirmar conclusão
                    </button>
                  </div>
                )}

                {solicitacao.status === 'confirmado' && !aguardandoConfirmacao && (
                  <p className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600">
                    Contratação confirmada. Após o evento, o fornecedor registra a conclusão
                    e você confirma por aqui.
                  </p>
                )}

                {solicitacao.status === 'concluido' && (
                  <p className="mt-4 border-t border-slate-200 pt-4 text-sm text-sucesso-700">
                    Serviço concluído em{' '}
                    {formatarDataHora(solicitacao.data_confirmacao_conclusao_cliente)}.
                  </p>
                )}

                {solicitacao.status === 'recusado' && solicitacao.motivo_recusa && (
                  <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
                    <span className="font-medium">Motivo da recusa: </span>
                    {ROTULO_MOTIVO_RECUSA[solicitacao.motivo_recusa]}
                  </p>
                )}

                {/* UC 022 — cancelamento registrado */}
                {solicitacao.id_cancelamento && (
                  <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="font-medium text-slate-800">
                      {ROTULO_ORIGEM_CANCELAMENTO[solicitacao.solicitado_por]} ·{' '}
                      {ROTULO_STATUS_CANCELAMENTO[solicitacao.status_cancelamento]}
                    </p>
                    <p className="whitespace-pre-line text-slate-700">
                      <span className="font-medium">Motivo: </span>
                      {solicitacao.motivo_cancelamento}
                    </p>
                    {Number(solicitacao.valor_reembolso) > 0 && (
                      <p className="text-slate-700">
                        <span className="font-medium">Reembolso: </span>
                        {formatarPreco(solicitacao.valor_reembolso)}
                      </p>
                    )}
                    {Number(solicitacao.valor_multa) > 0 && (
                      <p className="text-slate-700">
                        <span className="font-medium">Valor retido: </span>
                        {formatarPreco(solicitacao.valor_multa)}
                      </p>
                    )}
                  </div>
                )}

                {/* UC 022 — pedir cancelamento */}
                {podeCancelar && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    {cancelando === solicitacao.id ? (
                      <DialogoCancelamento
                        solicitadoPor="cliente"
                        dataEvento={solicitacao.data_hora_evento}
                        pagamento={pagamento}
                        processando={processando}
                        aoVoltar={() => setCancelando(null)}
                        aoCancelar={(motivo) => acionar(
                          solicitacao.id,
                          { acao: 'cancelar', motivo },
                          'Cancelamento registrado.'
                        )} />
                    ) : (
                      <button type="button" onClick={() => setCancelando(solicitacao.id)}
                        className="rounded-lg border border-perigo-600 px-4 py-2 text-sm font-medium text-perigo-700 transition-colors hover:bg-perigo-50">
                        Cancelar solicitação
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
