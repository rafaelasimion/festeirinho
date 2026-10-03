import { notFound, redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import { obterConfiguracoes } from '@/lib/configuracao';
import {
  buscarSolicitacoes,
  idDoFornecedor,
  fecharPendenciasVencidas,
} from '../consulta';
import DetalheSolicitacaoRecebida from '../detalhe';

// UC 015, passos 3 e 4 — a página de uma solicitação recebida.
export default async function PaginaSolicitacaoRecebida({ params }) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');
  if (sessao.tipoUsuario !== 'fornecedor') redirect('/minha-conta');

  const idFornecedor = await idDoFornecedor(sessao.id);
  if (idFornecedor === null) redirect('/minha-conta');

  const { id } = await params;
  const idSolicitacao = Number(id);
  if (!Number.isInteger(idSolicitacao)) notFound();

  await fecharPendenciasVencidas();

  const [solicitacoes, configuracoes] = await Promise.all([
    buscarSolicitacoes(sessao.id, idFornecedor, { id: idSolicitacao }),
    obterConfiguracoes(),
  ]);

  // A consulta já exige que o serviço seja deste fornecedor, então zero
  // linhas cobre "não existe" e "é de outro fornecedor" com a mesma
  // resposta.
  const solicitacao = solicitacoes[0];
  if (!solicitacao) notFound();

  return (
    <DetalheSolicitacaoRecebida
      solicitacao={solicitacao}
      prazoRegistroDias={configuracoes.prazo_registro_conclusao_dias}
      prazoConfirmacaoHoras={configuracoes.prazo_confirmacao_conclusao_horas}
    />
  );
}
