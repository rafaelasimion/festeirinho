'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Star, Check, X, MessageCircle, CheckCircle2, XCircle, Download, Flag,
} from 'lucide-react';
import { CampoSelecao } from '@/componentes/campo';
import Etiqueta from '@/componentes/etiqueta';
import DialogoCancelamento from '@/componentes/dialogo-cancelamento';
import CartaoSolicitacao, { AvisoCartao } from '@/componentes/cartao-solicitacao';
import { BarraAcoes, BotaoAcao, LinkAcao } from '@/componentes/acoes-solicitacao';
import {
  formatarPreco,
  ROTULO_STATUS_SOLICITACAO,
  TOM_STATUS_SOLICITACAO,
  ROTULO_MOTIVO_RECUSA,
  chatAberto,
} from '@/lib/solicitacao';
import {
  ROTULO_STATUS_CANCELAMENTO,
  ROTULO_ORIGEM_CANCELAMENTO,
  impedimentoParaCancelar,
} from '@/lib/cancelamento';
import { ROTULO_MOTIVO_CONTESTACAO } from '@/lib/contestacao';
import Chat from '@/componentes/chat';
import DialogoDenuncia from '@/componentes/dialogo-denuncia';
import { ROTULO_RESULTADO_DENUNCIA } from '@/lib/denuncia';
import { formatarDataHora } from '@/lib/datas';

function somarDias(iso, dias) {
  const data = new Date(iso);
  data.setDate(data.getDate() + dias);
  return data;
}

export default function ListaSolicitacoesRecebidas({
  solicitacoes, prazoRegistroDias, prazoConfirmacaoHoras,
}) {
  const router = useRouter();
  const [recusando, setRecusando] = useState(null);
  const [cancelando, setCancelando] = useState(null);
  const [conversando, setConversando] = useState(null);
  const [denunciando, setDenunciando] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erroGeral, setErroGeral] = useState('');
  const [mensagem, setMensagem] = useState('');

  async function acionar(idSolicitacao, corpo, textoSucesso) {
    setErroGeral('');
    setMensagem('');
    setProcessando(true);

    try {
      const resposta = await fetch(`/api/fornecedor/solicitacoes/${idSolicitacao}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErroGeral(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (!resposta.ok) {
        setErroGeral(dados.erro ?? 'Não foi possível concluir a operação.');
        return;
      }

      setRecusando(null);
      setCancelando(null);
      setMotivo('');
      setMensagem(textoSucesso);
      router.refresh();
    } catch {
      setErroGeral('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Solicitações recebidas</h1>

      {mensagem && <p className="mb-4 text-sm text-sucesso-700">{mensagem}</p>}
      {erroGeral && <p className="mb-4 text-sm text-perigo-600">{erroGeral}</p>}

      {solicitacoes.length === 0 ? (
        <p className="text-sm text-slate-600">Você ainda não recebeu solicitações.</p>
      ) : (
        <ul className="space-y-4">
          {solicitacoes.map((solicitacao) => {
            const aberta = solicitacao.status === 'aguardando_analise';
            const eventoTerminou = new Date(solicitacao.termino_previsto) <= new Date();

            const podeRegistrarConclusao =
              solicitacao.status === 'confirmado'
              && eventoTerminou
              && !solicitacao.data_registro_conclusao_fornecedor;

            const aguardandoCliente =
              solicitacao.status === 'confirmado'
              && Boolean(solicitacao.data_registro_conclusao_fornecedor);

            const impedimento = impedimentoParaCancelar({
              status: solicitacao.status,
              dataEvento: solicitacao.data_hora_evento,
              temCancelamento: Boolean(solicitacao.id_cancelamento),
              conclusaoRegistrada: Boolean(solicitacao.data_registro_conclusao_fornecedor),
              contestacaoPendente: solicitacao.status_contestacao === 'pendente',
            });
            const podeCancelar = impedimento === null;

            // O histórico continua acessível com o canal encerrado: é nele
            // que ficou combinada a execução, e é o que sustenta uma
            // contestação depois. Escrever, só dentro da janela da RN022.
            const temChat = ['aguardando_pagamento', 'confirmado', 'concluido', 'cancelado']
              .includes(solicitacao.status);
            const podeEscrever = chatAberto({
              status: solicitacao.status,
              conclusaoRegistrada: Boolean(solicitacao.data_registro_conclusao_fornecedor),
            });

            const pagamento = solicitacao.status_pagamento ? {
              status: solicitacao.status_pagamento,
              valor_bruto: solicitacao.valor_bruto,
            } : null;

            // RN009 — antes de aprovar, o fornecedor vê só a região; o
            // endereço completo aparece quando a contratação existe.
            const mostrarEnderecoCompleto =
              !aberta && !['recusado', 'expirado'].includes(solicitacao.status);

            // Um painel de cada vez, como na tela do cliente.
            const painel =
              conversando === solicitacao.id ? 'conversar'
                : recusando === solicitacao.id ? 'recusar'
                  : cancelando === solicitacao.id ? 'cancelar'
                    : denunciando === solicitacao.id ? 'denunciar'
                      : null;

            // O painel aberto vai por fora da linha da foto (prop "painel"):
            // dentro dela, um chat de 500px esticava a faixa lateral junto.
            const conteudoPainel = painel === null ? null : (
              <>

                {painel === 'conversar' && (
                  <>
                    <Chat
                      idSolicitacao={solicitacao.id}
                      titulo={`Conversa com ${solicitacao.cliente}`}
                      aoFechar={() => setConversando(null)}
                      aoAlterar={() => router.refresh()} />
                  </>
                )}

                {/* UC 015 — recusar exige motivo. */}
                {painel === 'recusar' && (
                  <div className="space-y-3">
                    {/* As opções saem do mesmo mapa que desenha o motivo
                        depois de recusada, logo abaixo nesta tela. Escritas
                        à mão, as duas listas já tinham divergido: aqui dizia
                        "Inviabilidade técnica ou logística" e o registro da
                        recusa, "Inviabilidade técnica, operacional ou
                        logística". O nome é único por cartão porque vários
                        podem estar abertos ao mesmo tempo. */}
                    <CampoSelecao label="Motivo da recusa"
                      name={`motivo-${solicitacao.id}`} value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}>
                      <option value="">Selecione</option>
                      {Object.entries(ROTULO_MOTIVO_RECUSA).map(([valor, rotulo]) => (
                        <option key={valor} value={valor}>{rotulo}</option>
                      ))}
                    </CampoSelecao>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={processando || motivo === ''}
                        onClick={() => acionar(
                          solicitacao.id,
                          { acao: 'recusar', motivoRecusa: motivo },
                          'Solicitação recusada.'
                        )}
                        className="rounded-lg bg-perigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-perigo-700 disabled:opacity-50">
                        Confirmar recusa
                      </button>
                      <button type="button"
                        onClick={() => { setRecusando(null); setMotivo(''); }}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                        Voltar
                      </button>
                    </div>
                  </div>
                )}

                {painel === 'cancelar' && (
                  <>
                    <DialogoCancelamento
                      solicitadoPor="fornecedor"
                      dataEvento={solicitacao.data_hora_evento}
                      pagamento={pagamento}
                      processando={processando}
                      aoVoltar={() => setCancelando(null)}
                      aoCancelar={(motivoTexto) => acionar(
                        solicitacao.id,
                        { acao: 'cancelar', motivo: motivoTexto },
                        'Cancelamento registrado. O cliente será reembolsado integralmente.'
                      )} />
                  </>
                )}

                {painel === 'denunciar' && (
                  <>
                    <DialogoDenuncia
                      tipo="avaliacao"
                      alvo={{ idAvaliacao: solicitacao.id_avaliacao }}
                      aoVoltar={() => setDenunciando(null)}
                      aoConcluir={() => {
                        setDenunciando(null);
                        setMensagem('Denúncia registrada. A administração vai analisar.');
                        router.refresh();
                      }} />
                  </>
                )}
              </>
            );

            return (
              <CartaoSolicitacao key={solicitacao.id}
                titulo={solicitacao.servico}
                subtitulo={`Cliente: ${solicitacao.cliente}`}
                preco={formatarPreco(solicitacao.valor_final)}
                foto={solicitacao.foto_principal}
                etiquetas={
                  <>
                    <Etiqueta tom={TOM_STATUS_SOLICITACAO[solicitacao.status]} formato="ponto">
                      {ROTULO_STATUS_SOLICITACAO[solicitacao.status]}
                    </Etiqueta>
                    {solicitacao.status_contestacao === 'pendente' && (
                      <Etiqueta tom="atencao" formato="ponto">em contestação</Etiqueta>
                    )}
                  </>
                }
                quando={`${formatarDataHora(solicitacao.data_hora_evento)} · ${solicitacao.duracao}h`}
                convidados={`${solicitacao.numero_convidados} convidados · ${solicitacao.tipo_local}`}
                local={mostrarEnderecoCompleto
                  ? `${solicitacao.rua}, ${solicitacao.numero}${
                    solicitacao.complemento ? ` — ${solicitacao.complemento}` : ''
                  } · ${solicitacao.bairro} · ${solicitacao.cidade}/${solicitacao.estado} · CEP ${solicitacao.cep}`
                  : `${solicitacao.bairro}, ${solicitacao.cidade}/${solicitacao.estado}`}
                painel={conteudoPainel}>

                {(solicitacao.tema || solicitacao.nome_aniversariante || solicitacao.observacoes) && (
                  <div className="mt-4 space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    {solicitacao.tema && (
                      <p><span className="font-medium">Tema: </span>{solicitacao.tema}</p>
                    )}
                    {solicitacao.nome_aniversariante && (
                      <p>
                        <span className="font-medium">Aniversariante: </span>
                        {solicitacao.nome_aniversariante}
                        {solicitacao.idade_aniversariante !== null &&
                          `, ${solicitacao.idade_aniversariante} anos`}
                      </p>
                    )}
                    {solicitacao.observacoes && (
                      <p className="whitespace-pre-line">
                        <span className="font-medium">Observações: </span>
                        {solicitacao.observacoes}
                      </p>
                    )}
                  </div>
                )}

                {aberta && (
                  <AvisoCartao tom="atencao">
                    Responda até {formatarDataHora(solicitacao.data_limite_resposta_fornecedor)}.
                    Sem resposta, a solicitação expira automaticamente.
                  </AvisoCartao>
                )}

                {solicitacao.status === 'recusado' && solicitacao.motivo_recusa && (
                  <AvisoCartao>
                    <span className="font-medium">Motivo informado: </span>
                    {ROTULO_MOTIVO_RECUSA[solicitacao.motivo_recusa]}
                  </AvisoCartao>
                )}

                {/* UC 019 — janela para registrar a conclusão. */}
                {solicitacao.status === 'confirmado' && !aguardandoCliente && (
                  podeRegistrarConclusao ? (
                    <AvisoCartao tom="festa">
                      Registre a conclusão até{' '}
                      {formatarDataHora(somarDias(solicitacao.termino_previsto, prazoRegistroDias))}.
                      Sem registro, a solicitação é cancelada com reembolso ao cliente.
                    </AvisoCartao>
                  ) : (
                    <AvisoCartao>
                      A conclusão poderá ser registrada após o término previsto do evento, em{' '}
                      {formatarDataHora(solicitacao.termino_previsto)}.
                    </AvisoCartao>
                  )
                )}

                {/* UC 020 — aguardando o cliente */}
                {aguardandoCliente && (
                  <AvisoCartao tom="festa">
                    Conclusão registrada em{' '}
                    {formatarDataHora(solicitacao.data_registro_conclusao_fornecedor)}.
                    Aguardando confirmação do cliente; sem resposta em {prazoConfirmacaoHoras}h,
                    o sistema confirma automaticamente.
                  </AvisoCartao>
                )}

                {solicitacao.status === 'concluido' && (
                  <AvisoCartao tom="sucesso">
                    Serviço concluído e confirmado em{' '}
                    {formatarDataHora(solicitacao.data_confirmacao_conclusao_cliente)}.
                  </AvisoCartao>
                )}

                {/* UC 042 — o fornecedor é informado da contestação. */}
                {solicitacao.status_contestacao === 'pendente' && (
                  <div className="mt-4 space-y-1 rounded-lg border border-atencao-200 bg-atencao-50 p-3 text-sm">
                    <p className="font-medium text-slate-800">
                      O cliente contestou a conclusão:{' '}
                      {ROTULO_MOTIVO_CONTESTACAO[solicitacao.motivo_contestacao_cliente]}
                    </p>
                    <p className="whitespace-pre-line text-slate-700">
                      {solicitacao.descricao_contestacao_cliente}
                    </p>
                    <p className="text-xs text-slate-500">
                      Enviada em {formatarDataHora(solicitacao.data_contestacao_cliente)}.
                      A administração vai analisar e decidir.
                    </p>
                  </div>
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
                    {Number(solicitacao.valor_multa) > 0 && (
                      <p className="text-slate-700">
                        <span className="font-medium">Valor retido a seu favor: </span>
                        {formatarPreco(solicitacao.valor_multa)}
                        {solicitacao.status_repasse === 'liberado'
                          ? ' · já liberado para saque'
                          : ' · liberado quando o cancelamento concluir'}
                      </p>
                    )}
                  </div>
                )}

                {/* RF037 — a avaliação recebida. RN062: a nota conta na
                    média mesmo quando o comentário é privado ou foi ocultado
                    pela moderação; só o texto deixa de aparecer. */}
                {solicitacao.id_avaliacao && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex" aria-label={`Nota ${solicitacao.nota} de 5`}>
                        {[1, 2, 3, 4, 5].map((posicao) => (
                          <Star key={posicao} aria-hidden="true"
                            className={`h-4 w-4 ${posicao <= solicitacao.nota
                              ? 'fill-atencao-600 text-atencao-600'
                              : 'text-slate-300'}`} />
                        ))}
                      </span>
                      <span className="text-sm text-slate-600">
                        Avaliação de {solicitacao.cliente}
                        {solicitacao.status_avaliacao === 'oculta'
                          && solicitacao.origem_ocultacao === 'usuario'
                          && ' · comentário privado'}
                        {solicitacao.status_avaliacao === 'oculta'
                          && solicitacao.origem_ocultacao === 'moderacao'
                          && ' · comentário removido pela moderação'}
                      </span>
                    </div>

                    {solicitacao.comentario && (
                      <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                        {solicitacao.comentario}
                      </p>
                    )}

                    {solicitacao.comentario && solicitacao.id_denuncia && (
                      <p className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-600">
                        Comentário denunciado
                        {solicitacao.status_denuncia === 'analisada'
                          ? `: ${ROTULO_RESULTADO_DENUNCIA[solicitacao.resultado_analise]}. ${solicitacao.justificativa_analise}`
                          : '. A administração vai analisar.'}
                      </p>
                    )}
                  </div>
                )}

                {painel === null && (
                  <BarraAcoes>
                    {aberta && (
                      <BotaoAcao tom="principal" Icone={Check} disabled={processando}
                        onClick={() => acionar(
                          solicitacao.id,
                          { acao: 'aprovar' },
                          'Solicitação aprovada. O cliente foi encaminhado para o pagamento.'
                        )}>
                        Aprovar
                      </BotaoAcao>
                    )}

                    {podeRegistrarConclusao && (
                      <BotaoAcao tom="principal" Icone={CheckCircle2} disabled={processando}
                        onClick={() => acionar(
                          solicitacao.id,
                          { acao: 'registrar_conclusao' },
                          'Conclusão registrada. O cliente foi avisado para confirmar.'
                        )}>
                        Registrar conclusão
                      </BotaoAcao>
                    )}

                    {temChat && (
                      <BotaoAcao tom="secundario" Icone={MessageCircle}
                        contador={solicitacao.nao_lidas}
                        onClick={() => setConversando(solicitacao.id)}>
                        {podeEscrever ? 'Conversar' : 'Ver conversa'}
                      </BotaoAcao>
                    )}

                    {aberta && (
                      <BotaoAcao tom="perigo" Icone={X} disabled={processando}
                        onClick={() => setRecusando(solicitacao.id)}>
                        Recusar
                      </BotaoAcao>
                    )}

                    {podeCancelar && (
                      <BotaoAcao tom="perigo" Icone={XCircle}
                        onClick={() => setCancelando(solicitacao.id)}>
                        Cancelar
                      </BotaoAcao>
                    )}

                    {/* RF058 / UC 034 — comprovante não fiscal. */}
                    {solicitacao.status_pagamento === 'pago' && (
                      <LinkAcao href={`/api/comprovantes/${solicitacao.id}`} Icone={Download}>
                        Comprovante
                      </LinkAcao>
                    )}

                    {/* RN052 — denúncia do comentário, não da nota. */}
                    {solicitacao.id_avaliacao && solicitacao.comentario
                      && !solicitacao.id_denuncia && (
                        <BotaoAcao tom="discreto" Icone={Flag}
                          onClick={() => setDenunciando(solicitacao.id)}>
                          Denunciar comentário
                        </BotaoAcao>
                      )}
                  </BarraAcoes>
                )}
              </CartaoSolicitacao>
            );
          })}
        </ul>
      )}
    </main>
  );
}
