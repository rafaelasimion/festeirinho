import Link from 'next/link';
import { Search, MessageCircle, ChevronRight } from 'lucide-react';
import Etiqueta from '@/componentes/etiqueta';
import CartaoSolicitacao, { AvisoCartao } from '@/componentes/cartao-solicitacao';
import { BarraAcoes, BotaoAcao } from '@/componentes/acoes-solicitacao';
import {
  formatarPreco,
  ROTULO_STATUS_SOLICITACAO,
  TOM_STATUS_SOLICITACAO,
  ROTULO_MOTIVO_RECUSA,
  situacaoCliente,
  chamadaCliente,
} from '@/lib/solicitacao';
import { formatarDataHora } from '@/lib/datas';

// UC 014, passos 1 e 2 — a lista das solicitações do cliente.
//
// Só o resumo e um caminho para dentro. Todo o resto — pagamento,
// cancelamento, contestação, dados de reembolso, avaliação, denúncia e o
// chat — mudou para a página de cada solicitação, que é o que os passos 3
// e 4 do caso de uso descrevem. Antes tudo isso vivia dentro do cartão, e
// uma única solicitação em contestação ocupava três telas de rolagem,
// escondendo as outras atrás dela.
//
// Deixou de ser componente de cliente no caminho: sem painéis, não há
// estado nem chamada à API aqui — é uma lista de links. O JavaScript que
// essa tela carregava foi junto com os painéis.
export default function ListaMinhasSolicitacoes({ solicitacoes }) {
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

      {solicitacoes.length === 0 ? (
        <p className="text-sm text-slate-600">
          Você ainda não enviou nenhuma solicitação.{' '}
          <Link href="/servicos" className="underline">Ver serviços disponíveis</Link>.
        </p>
      ) : (
        <ul className="space-y-4">
          {solicitacoes.map((solicitacao) => {
            const { contestacaoPendente, aguardandoConfirmacao } =
              situacaoCliente(solicitacao);
            const chamada = chamadaCliente(solicitacao);

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
                hrefTitulo={`/servicos/${solicitacao.id_servico}`}
                hrefSubtitulo={`/fornecedores/${solicitacao.id_fornecedor}`}>

                {/* Os avisos ficam: são uma linha cada e dizem por que o
                    botão diz o que diz. Sem eles o cartão anuncia "Pagar"
                    sem contar que o prazo termina amanhã. */}
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

                {aguardandoConfirmacao && (
                  <AvisoCartao tom="atencao">
                    O fornecedor registrou a conclusão em{' '}
                    {formatarDataHora(solicitacao.data_registro_conclusao_fornecedor)}.
                  </AvisoCartao>
                )}

                {solicitacao.status === 'recusado' && solicitacao.motivo_recusa && (
                  <AvisoCartao>
                    <span className="font-medium">Motivo da recusa: </span>
                    {ROTULO_MOTIVO_RECUSA[solicitacao.motivo_recusa]}
                  </AvisoCartao>
                )}

                <BarraAcoes>
                  {/* O contador de não lidas é motivo de entrar, então ele
                      aparece aqui mesmo com a conversa morando lá dentro. */}
                  {solicitacao.nao_lidas > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-festa-700">
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      {solicitacao.nao_lidas === 1
                        ? '1 mensagem não lida'
                        : `${solicitacao.nao_lidas} mensagens não lidas`}
                    </span>
                  )}

                  <BotaoAcao tom={chamada.tom} IconeFim={ChevronRight}
                    href={`/minhas-solicitacoes/${solicitacao.id}`}>
                    {chamada.rotulo}
                  </BotaoAcao>
                </BarraAcoes>
              </CartaoSolicitacao>
            );
          })}
        </ul>
      )}
    </main>
  );
}
