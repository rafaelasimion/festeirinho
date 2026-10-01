'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CreditCard, MessageCircle, CheckCircle2, AlertTriangle,
  XCircle, Download, Flag, Search,
} from 'lucide-react';
import Etiqueta from '@/componentes/etiqueta';
import DialogoCancelamento from '@/componentes/dialogo-cancelamento';
import FormularioAvaliacao from '@/componentes/formulario-avaliacao';
import DadosReembolso from '@/componentes/dados-reembolso';
import Chat from '@/componentes/chat';
import DialogoDenuncia from '@/componentes/dialogo-denuncia';
import CartaoSolicitacao, {
  AvisoCartao, DetalheRecolhivel,
} from '@/componentes/cartao-solicitacao';
import { BarraAcoes, BotaoAcao, LinkAcao } from '@/componentes/acoes-solicitacao';
import {
  formatarPreco,
  ROTULO_STATUS_SOLICITACAO,
  TOM_STATUS_SOLICITACAO,
  ROTULO_MOTIVO_RECUSA,
  chatAberto,
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
import { formatarDataHora } from '@/lib/datas';

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
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Minhas solicitações</h1>
        <Link href="/servicos"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-festa-700 hover:underline">
          <Search className="h-4 w-4" aria-hidden="true" />
          Buscar serviços
        </Link>
      </div>

      {mensagem && <p className="mb-4 text-sm text-sucesso-700">{mensagem}</p>}
      {erro && <p className="mb-4 text-sm text-perigo-600">{erro}</p>}

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

            // O histórico fica acessível mesmo depois de encerrado o canal:
            // é nele que ficou combinado horário de chegada e acesso ao
            // local, e é o que sustenta uma contestação ou denúncia depois.
            const temChat = ['aguardando_pagamento', 'confirmado', 'concluido', 'cancelado']
              .includes(solicitacao.status);
            // RN022 — mas escrever, só dentro da janela. O rótulo segue a
            // mesma regra do servidor para não prometer o que ele recusa.
            const podeEscrever = chatAberto({
              status: solicitacao.status,
              conclusaoRegistrada: Boolean(solicitacao.data_registro_conclusao_fornecedor),
            });
            const podeDenunciar = ['confirmado', 'concluido', 'cancelado']
              .includes(solicitacao.status);

            const pagamento = solicitacao.id_pagamento ? {
              status: solicitacao.status_pagamento,
              valor_bruto: solicitacao.valor_bruto,
              perc_multa_faixa_mais_7d: solicitacao.perc_multa_faixa_mais_7d,
              perc_multa_faixa_7d_48h: solicitacao.perc_multa_faixa_7d_48h,
              perc_multa_faixa_48h_24h: solicitacao.perc_multa_faixa_48h_24h,
              perc_multa_faixa_24h: solicitacao.perc_multa_faixa_24h,
            } : null;

            // Só um painel por cartão de cada vez. Enquanto um está aberto,
            // a barra de ações dá lugar a ele: duas coisas pedindo decisão
            // no mesmo rodapé é uma a mais.
            const painel =
              conversando === solicitacao.id ? 'conversar'
                : cancelando === solicitacao.id ? 'cancelar'
                  : denunciando === solicitacao.id ? 'denunciar'
                    : contestando === solicitacao.id ? 'contestar'
                      : null;

            // Tudo que é alto vai por fora da linha da foto (prop "painel"):
            // dentro dela, um chat de 500px — ou o formulário de avaliação,
            // com as estrelas, o comentário e a escolha de visibilidade —
            // esticava a faixa lateral junto, e a foto virava uma tira.
            const avaliar = solicitacao.status === 'concluido';
            const conteudoPainel = (painel === null && !avaliar) ? null : (
              <div className="space-y-4">

                {painel === 'conversar' && (
                  <>
                    <Chat
                      idSolicitacao={solicitacao.id}
                      titulo={`Conversa com ${solicitacao.fornecedor}`}
                      aoFechar={() => setConversando(null)}
                      aoAlterar={() => router.refresh()} />
                  </>
                )}

                {painel === 'cancelar' && (
                  <>
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
                  </>
                )}

                {painel === 'denunciar' && (
                  <>
                    <DialogoDenuncia
                      tipo="fornecedor"
                      alvo={{ idSolicitacao: solicitacao.id }}
                      aoVoltar={() => setDenunciando(null)}
                      aoConcluir={() => {
                        setDenunciando(null);
                        setMensagem('Denúncia registrada. A administração vai analisar.');
                        router.refresh();
                      }} />
                  </>
                )}

                {/* UC 042 — formulário de contestação */}
                {painel === 'contestar' && (
                  <div className="space-y-4 rounded-lg border border-atencao-200 bg-atencao-50 p-4">
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
                          className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${motivoContestacao === valor
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
              </div>
            );

            return (
              <CartaoSolicitacao key={solicitacao.id}
                titulo={solicitacao.servico}
                subtitulo={solicitacao.fornecedor}
                preco={formatarPreco(solicitacao.valor_final)}
                foto={solicitacao.foto_principal}
                etiquetas={
                  <>
                    <Etiqueta tom={TOM_STATUS_SOLICITACAO[solicitacao.status]} formato="ponto">
                      {ROTULO_STATUS_SOLICITACAO[solicitacao.status]}
                    </Etiqueta>
                    {contestacaoPendente && (
                      <Etiqueta tom="atencao" formato="ponto">em contestação</Etiqueta>
                    )}
                  </>
                }
                quando={`${formatarDataHora(solicitacao.data_hora_evento)} · ${solicitacao.duracao}h`}
                convidados={`${solicitacao.numero_convidados} convidados`}
                local={`${solicitacao.cidade}/${solicitacao.estado}`}
                painel={conteudoPainel}>

                {solicitacao.status === 'aguardando_analise' && (
                  <AvisoCartao>
                    O fornecedor tem até{' '}
                    {formatarDataHora(solicitacao.data_limite_resposta_fornecedor)} para responder.
                  </AvisoCartao>
                )}

                {solicitacao.status === 'aguardando_pagamento' && solicitacao.id_pagamento && (
                  <AvisoCartao tom="atencao">
                    Pague até {formatarDataHora(solicitacao.data_limite)} para confirmar.
                  </AvisoCartao>
                )}

                {solicitacao.status === 'confirmado' && !aguardandoConfirmacao
                  && !solicitacao.data_registro_conclusao_fornecedor && (
                    <AvisoCartao tom="festa">
                      Contratação confirmada. Após o evento, o fornecedor registra a conclusão
                      e você confirma por aqui.
                    </AvisoCartao>
                  )}

                {/* UC 020 / UC 042 — o fornecedor registrou; falta você. */}
                {aguardandoConfirmacao && (
                  <AvisoCartao tom="atencao">
                    O fornecedor registrou a conclusão do serviço em{' '}
                    {formatarDataHora(solicitacao.data_registro_conclusao_fornecedor)}. Se você
                    não responder em {prazoConfirmacaoHoras} horas, o sistema confirma
                    automaticamente.
                  </AvisoCartao>
                )}

                {solicitacao.status === 'concluido' && (
                  <AvisoCartao tom="sucesso">
                    Serviço concluído em{' '}
                    {formatarDataHora(solicitacao.data_confirmacao_conclusao_cliente)}.
                  </AvisoCartao>
                )}

                {solicitacao.status === 'recusado' && solicitacao.motivo_recusa && (
                  <AvisoCartao>
                    <span className="font-medium">Motivo da recusa: </span>
                    {ROTULO_MOTIVO_RECUSA[solicitacao.motivo_recusa]}
                  </AvisoCartao>
                )}

                {/* UC 042/043 — contestação registrada. Fechada quando já
                    foi julgada: o resumo já diz o desfecho, e aberta ela
                    sozinha dobrava a altura do cartão. */}
                {solicitacao.status_contestacao && (
                  <DetalheRecolhivel tom="atencao"
                    abertoPorPadrao={solicitacao.status_contestacao === 'pendente'}
                    resumo={
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>
                          Contestação:{' '}
                          {ROTULO_MOTIVO_CONTESTACAO[solicitacao.motivo_contestacao_cliente]}
                        </span>
                        {solicitacao.status_contestacao === 'pendente' ? (
                          <Etiqueta tom="atencao" formato="caixa" contorno>em análise</Etiqueta>
                        ) : (
                          <Etiqueta formato="caixa" contorno
                            tom={TOM_RESULTADO_CONTESTACAO[solicitacao.resultado_contestacao]}>
                            {ROTULO_RESULTADO_CONTESTACAO[solicitacao.resultado_contestacao]}
                          </Etiqueta>
                        )}
                      </span>
                    }>
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
                        <p className="font-medium text-slate-800">Justificativa da decisão</p>
                        <p className="whitespace-pre-line text-slate-700">
                          {solicitacao.justificativa_contestacao}
                        </p>
                        <p className="text-xs text-slate-500">
                          Analisada em {formatarDataHora(solicitacao.data_analise_contestacao)}.
                        </p>
                      </div>
                    )}
                  </DetalheRecolhivel>
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

                {/* RF067 / RN052 — denúncia já registrada. */}
                {podeDenunciar && solicitacao.id_denuncia && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
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
                )}

                {painel === null && (
                  <BarraAcoes>
                    {solicitacao.status === 'aguardando_pagamento' && solicitacao.id_pagamento && (
                      <BotaoAcao tom="principal" Icone={CreditCard}
                        href={`/pagamento/${solicitacao.id_pagamento}`}>
                        Pagar
                      </BotaoAcao>
                    )}

                    {aguardandoConfirmacao && (
                      <BotaoAcao tom="principal" Icone={CheckCircle2} disabled={processando}
                        onClick={() => acionar(
                          solicitacao.id,
                          { acao: 'confirmar_conclusao' },
                          'Conclusão confirmada. Obrigado!'
                        )}>
                        Confirmar conclusão
                      </BotaoAcao>
                    )}

                    {temChat && (
                      <BotaoAcao tom="secundario" Icone={MessageCircle}
                        contador={solicitacao.nao_lidas}
                        onClick={() => setConversando(solicitacao.id)}>
                        {podeEscrever ? 'Conversar' : 'Ver conversa'}
                      </BotaoAcao>
                    )}

                    {aguardandoConfirmacao && (
                      <BotaoAcao tom="atencao" Icone={AlertTriangle} disabled={processando}
                        onClick={() => setContestando(solicitacao.id)}>
                        Contestar conclusão
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

                    {podeDenunciar && !solicitacao.id_denuncia && (
                      <BotaoAcao tom="discreto" Icone={Flag}
                        onClick={() => setDenunciando(solicitacao.id)}>
                        Denunciar
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
