import Link from 'next/link';
import { MessageCircle, ChevronRight } from 'lucide-react';
import Etiqueta from '@/componentes/etiqueta';
import CartaoSolicitacao, { AvisoCartao } from '@/componentes/cartao-solicitacao';
import { BarraAcoes, BotaoAcao } from '@/componentes/acoes-solicitacao';
import {
  formatarPreco,
  ROTULO_STATUS_SOLICITACAO,
  TOM_STATUS_SOLICITACAO,
  ROTULO_MOTIVO_RECUSA,
  situacaoFornecedor,
  chamadaFornecedor,
} from '@/lib/solicitacao';
import { formatarDataHora } from '@/lib/datas';

// UC 015, passos 1 e 2 — a lista das solicitações recebidas.
//
// Como a lista do cliente: só o resumo e um caminho para dentro. Recusa,
// cancelamento, denúncia, conversa, endereço completo, dados do
// aniversariante e a avaliação recebida foram para a página de cada
// solicitação.
//
// Também deixou de ser componente de cliente: sem painéis não sobrou
// estado nem chamada à API.
export default function ListaSolicitacoesRecebidas({ solicitacoes }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Solicitações recebidas</h1>

      {solicitacoes.length === 0 ? (
        <p className="text-sm text-slate-600">Você ainda não recebeu solicitações.</p>
      ) : (
        <ul className="space-y-4">
          {solicitacoes.map((solicitacao) => {
            const { aberta, contestacaoPendente, aguardandoCliente } =
              situacaoFornecedor(solicitacao);
            const chamada = chamadaFornecedor(solicitacao);

            return (
              <CartaoSolicitacao key={solicitacao.id}
                titulo={solicitacao.servico}
                subtitulo={solicitacao.cliente}
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
                /* RN009 — na lista, só a região. O endereço completo é
                   parte do detalhe e só aparece com a contratação de pé. */
                local={`${solicitacao.cidade}/${solicitacao.estado}`}>

                {aberta && (
                  <AvisoCartao tom="atencao">
                    Responda até{' '}
                    {formatarDataHora(solicitacao.data_limite_resposta_fornecedor)}.
                  </AvisoCartao>
                )}

                {aguardandoCliente && !contestacaoPendente && (
                  <AvisoCartao>
                    Conclusão registrada em{' '}
                    {formatarDataHora(solicitacao.data_registro_conclusao_fornecedor)}.
                    Aguardando a confirmação do cliente.
                  </AvisoCartao>
                )}

                {solicitacao.status === 'recusado' && solicitacao.motivo_recusa && (
                  <AvisoCartao>
                    <span className="font-medium">Motivo da recusa: </span>
                    {ROTULO_MOTIVO_RECUSA[solicitacao.motivo_recusa]}
                  </AvisoCartao>
                )}

                <BarraAcoes>
                  {solicitacao.nao_lidas > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-festa-700">
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      {solicitacao.nao_lidas === 1
                        ? '1 mensagem não lida'
                        : `${solicitacao.nao_lidas} mensagens não lidas`}
                    </span>
                  )}

                  <BotaoAcao tom={chamada.tom} IconeFim={ChevronRight}
                    href={`/fornecedor/solicitacoes/${solicitacao.id}`}>
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
