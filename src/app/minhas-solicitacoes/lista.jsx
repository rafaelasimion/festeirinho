'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Etiqueta from '@/componentes/etiqueta';
import DialogoCancelamento from '@/componentes/dialogo-cancelamento';
import FormularioAvaliacao from '@/componentes/formulario-avaliacao';
import DadosReembolso from '@/componentes/dados-reembolso';
import Chat from '@/componentes/chat';
import DialogoDenuncia from '@/componentes/dialogo-denuncia';
import {
  formatarPreco,
  ROTULO_STATUS_SOLICITACAO,
  TOM_STATUS_SOLICITACAO,
  ROTULO_MOTIVO_RECUSA,
} from '@/lib/solicitacao';
import { ROTULO_RESULTADO_DENUNCIA } from '@/lib/denuncia';
import {
  ROTULO_STATUS_CANCELAMENTO,
  ROTULO_ORIGEM_CANCELAMENTO,
  impedimentoParaCancelar,
} from '@/lib/cancelamento';
import {
  MOTIVOS_CONTESTACAO,
  ROTULO_MOTIVO_CONTESTACAO,
  ROTULO_RESULTADO_CONTESTACAO,
  TOM_RESULTADO_CONTESTACAO,
} from '@/lib/contestacao';

function formatarDataHora(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function ListaMinhasSolicitacoes({ solicitacoes, prazoConfirmacaoHoras, titular }) {
  const router = useRouter();
  const [cancelando, setCancelando] = useState(null);
  const [conversando, setConversando] = useState(null);
  const [denunciando, setDenunciando] = useState(null);
  const [contestando, setContestando] = useState(null);
  const [motivoContestacao, setMotivoContestacao] = useState('');
  const [descricaoContestacao, setDescricaoContestacao] = useState('');
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
      setContestando(null);
      setMotivoContestacao('');
      setDescricaoContestacao('');
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
            const contestacaoPendente = solicitacao.status_contestacao === 'pendente';

            const aguardandoConfirmacao =
              solicitacao.status === 'confirmado'
              && Boolean(solicitacao.data_registro_conclusao_fornecedor)
              && !solicitacao.data_confirmacao_conclusao_cliente
              && !solicitacao.status_contestacao;

            const impedimento = impedimentoParaCancelar({
              status: solicitacao.status,
              dataEvento: solicitacao.data_hora_evento,
              temCancelamento: Boolean(solicitacao.id_cancelamento),
              conclusaoRegistrada: Boolean(solicitacao.data_registro_conclusao_fornecedor),
              contestacaoPendente: solicitacao.status_contestacao === 'pendente',
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
                    <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                      <Etiqueta tom={TOM_STATUS_SOLICITACAO[solicitacao.status]}>
                        {ROTULO_STATUS_SOLICITACAO[solicitacao.status]}
                      </Etiqueta>
                      {contestacaoPendente && (
                        <Etiqueta tom="atencao" contorno>em contestação</Etiqueta>
                      )}
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

                {/* UC 020 / UC 042 — confirmar ou contestar */}
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

                    {contestando === solicitacao.id ? (
                      <div className="mt-4 space-y-4 rounded-lg border border-atencao-200 bg-atencao-50 p-4">
                        <p className="text-sm text-slate-700">
                          A contestação suspende a confirmação automática e é analisada pela
                          administração da plataforma, que decide sobre o reembolso.
                        </p>

                        <fieldset className="space-y-2">
                          <legend className="mb-1 text-sm font-medium text-slate-700">
                            O que aconteceu?
                          </legend>
                          {MOTIVOS_CONTESTACAO.map(({ valor, rotulo, detalhe }) => (
                            <label key={valor}
                              className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                                motivoContestacao === valor
                                  ? 'border-atencao-600 bg-white'
                                  : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                              <input type="radio" name={`motivo-contestacao-${solicitacao.id}`}
                                value={valor} checked={motivoContestacao === valor}
                                onChange={(e) => setMotivoContestacao(e.target.value)}
                                className="mt-0.5" />
                              <span>
                                <span className="block text-sm font-medium text-slate-800">
                                  {rotulo}
                                </span>
                                <span className="block text-xs text-slate-500">{detalhe}</span>
                              </span>
                            </label>
                          ))}
                        </fieldset>

                        <div>
                          <label htmlFor={`descricao-${solicitacao.id}`}
                            className="mb-1.5 block text-sm font-medium text-slate-700">
                            Descreva o ocorrido
                          </label>
                          <textarea id={`descricao-${solicitacao.id}`} rows={4}
                            value={descricaoContestacao}
                            onChange={(e) => setDescricaoContestacao(e.target.value)}
                            placeholder="Conte o que foi combinado e o que de fato aconteceu. A administração usará este texto para decidir."
                            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
                          <p className="mt-1 text-xs text-slate-500">
                            {descricaoContestacao.trim().length}/20 caracteres mínimos.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button type="button"
                            disabled={processando || motivoContestacao === ''
                              || descricaoContestacao.trim().length < 20}
                            onClick={() => acionar(
                              solicitacao.id,
                              {
                                acao: 'contestar',
                                motivoContestacao,
                                descricao: descricaoContestacao,
                              },
                              'Contestação registrada. A administração vai analisar.'
                            )}
                            className="rounded-lg bg-atencao-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-atencao-700 disabled:opacity-50">
                            Enviar contestação
                          </button>
                          <button type="button" onClick={() => setContestando(null)}
                            disabled={processando}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                            Voltar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={processando}
                          onClick={() => acionar(
                            solicitacao.id,
                            { acao: 'confirmar_conclusao' },
                            'Conclusão confirmada. Obrigado!'
                          )}
                          className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
                          Confirmar conclusão
                        </button>
                        <button type="button" disabled={processando}
                          onClick={() => setContestando(solicitacao.id)}
                          className="rounded-lg border border-atencao-600 px-4 py-2 text-sm font-medium text-atencao-700 transition-colors hover:bg-atencao-50">
                          Contestar conclusão
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* UC 042/043 — contestação registrada */}
                {solicitacao.status_contestacao && (
                  <div className="mt-4 space-y-2 rounded-lg border border-atencao-200 bg-atencao-50 p-3 text-sm">
                    <p className="font-medium text-slate-800">
                      Contestação: {ROTULO_MOTIVO_CONTESTACAO[solicitacao.motivo_contestacao_cliente]}
                    </p>
                    <p className="whitespace-pre-line text-slate-700">
                      {solicitacao.descricao_contestacao_cliente}
                    </p>
                    <p className="text-xs text-slate-500">
                      Enviada em {formatarDataHora(solicitacao.data_contestacao_cliente)}.
                    </p>

                    {solicitacao.status_contestacao === 'pendente' ? (
                      <p className="text-slate-700">
                        Aguardando análise da administração. Enquanto isso, a solicitação não
                        é confirmada automaticamente.
                      </p>
                    ) : (
                      <div className="space-y-1 border-t border-atencao-200 pt-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">Resultado:</span>
                          <Etiqueta tom={TOM_RESULTADO_CONTESTACAO[solicitacao.resultado_contestacao]}>
                            {ROTULO_RESULTADO_CONTESTACAO[solicitacao.resultado_contestacao]}
                          </Etiqueta>
                        </div>
                        <p className="whitespace-pre-line text-slate-700">
                          {solicitacao.justificativa_contestacao}
                        </p>
                        <p className="text-xs text-slate-500">
                          Analisada em {formatarDataHora(solicitacao.data_analise_contestacao)}.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {solicitacao.status === 'confirmado' && !aguardandoConfirmacao
                  && !solicitacao.data_registro_conclusao_fornecedor && (
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

                {solicitacao.status === 'concluido' && (
                  <FormularioAvaliacao
                    avaliacao={solicitacao.id_avaliacao ? {
                      id: solicitacao.id_avaliacao,
                      nota: solicitacao.nota,
                      comentario: solicitacao.comentario,
                      status_avaliacao: solicitacao.status_avaliacao,
                    } : null}
                    processando={processando}
                    aoEnviar={async ({ nota, comentario, visibilidade }) => {
                      setErro('');
                      setMensagem('');
                      setProcessando(true);
                      try {
                        const resposta = await fetch('/api/avaliacoes', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            idSolicitacao: solicitacao.id, nota, comentario, visibilidade,
                          }),
                        });
                        const dados = await resposta.json();
                        if (!resposta.ok) {
                          setErro(dados.erro ?? 'Não foi possível registrar a avaliação.');
                          return;
                        }
                        setMensagem('Avaliação registrada. Obrigado!');
                        router.refresh();
                      } catch {
                        setErro('Falha de conexão. Tente novamente.');
                      } finally {
                        setProcessando(false);
                      }
                    }} />
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

                    {/* UC 036 — reembolso de pagamento por boleto precisa de
                        dados de recebimento; Pix e cartão voltam sozinhos. */}
                    {solicitacao.status_cancelamento === 'em_analise'
                      && Number(solicitacao.valor_reembolso) > 0
                      && solicitacao.forma_pagamento === 'boleto' && (
                      <DadosReembolso
                        idCancelamento={solicitacao.id_cancelamento}
                        titular={titular}
                        dados={solicitacao.id_dados_reembolso ? {
                          status_validacao: solicitacao.validacao_reembolso,
                          motivo_rejeicao: solicitacao.motivo_rejeicao_reembolso,
                          tipo_recebimento: solicitacao.tipo_recebimento,
                          chave_pix: solicitacao.chave_pix,
                          tipo_chave_pix: solicitacao.tipo_chave_pix,
                          banco: solicitacao.banco,
                          tipo_conta: solicitacao.tipo_conta,
                          agencia: solicitacao.agencia,
                          numero_conta: solicitacao.numero_conta,
                        } : null} />
                    )}
                  </div>
                )}

                {/* RF067 / RN052 — denúncia do fornecedor, a partir de uma
                    contratação que chegou a existir. */}
                {['confirmado', 'concluido', 'cancelado'].includes(solicitacao.status) && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    {solicitacao.id_denuncia ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                        <p className="font-medium text-slate-800">
                          Denúncia registrada
                          {solicitacao.status_denuncia === 'analisada'
                            && `: ${ROTULO_RESULTADO_DENUNCIA[solicitacao.resultado_analise]}`}
                        </p>
                        {solicitacao.status_denuncia === 'analisada' ? (
                          <p className="mt-1 whitespace-pre-line text-slate-700">
                            {solicitacao.justificativa_analise}
                          </p>
                        ) : (
                          <p className="mt-1 text-slate-600">
                            A administração vai analisar e você será avisado do resultado.
                          </p>
                        )}
                      </div>
                    ) : denunciando === solicitacao.id ? (
                      <DialogoDenuncia
                        tipo="fornecedor"
                        alvo={{ idSolicitacao: solicitacao.id }}
                        aoVoltar={() => setDenunciando(null)}
                        aoConcluir={() => {
                          setDenunciando(null);
                          setMensagem('Denúncia registrada. A administração vai analisar.');
                          router.refresh();
                        }} />
                    ) : (
                      <button type="button" onClick={() => setDenunciando(solicitacao.id)}
                        className="text-sm font-medium text-perigo-700 hover:underline">
                        Denunciar fornecedor
                      </button>
                    )}
                  </div>
                )}

                {/* UC 016 / RN022 — chat da solicitação. O histórico
                    continua acessível depois de encerrado o canal. */}
                {['aguardando_pagamento', 'confirmado', 'concluido', 'cancelado']
                  .includes(solicitacao.status) && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    {conversando === solicitacao.id ? (
                      <>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-slate-700">
                            Conversa com {solicitacao.fornecedor}
                          </p>
                          <button type="button" onClick={() => setConversando(null)}
                            className="text-sm font-medium text-slate-600 hover:underline">
                            Fechar
                          </button>
                        </div>
                        <Chat idSolicitacao={solicitacao.id} aoAlterar={() => router.refresh()} />
                      </>
                    ) : (
                      <button type="button" onClick={() => setConversando(solicitacao.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-festa-600 px-4 py-2 text-sm font-medium text-festa-700 transition-colors hover:bg-festa-50">
                        Conversar com o fornecedor
                        {solicitacao.nao_lidas > 0 && (
                          <span className="rounded-full bg-festa-600 px-2 py-0.5 text-xs text-white">
                            {solicitacao.nao_lidas}
                          </span>
                        )}
                      </button>
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
