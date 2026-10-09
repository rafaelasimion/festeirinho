import { notFound, redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import { obterConfiguracoes } from '@/lib/configuracao';
import {
  buscarSolicitacoes,
  buscarTitular,
  fecharPendenciasVencidas,
} from '../consulta';
import DetalheSolicitacao from '../detalhe';

// UC 014, passos 3 e 4 — a página de uma solicitação específica.
export default async function PaginaSolicitacao({ params }) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');
  if (sessao.tipoUsuario !== 'cliente') redirect('/minha-conta');

  const { id } = await params;
  const idSolicitacao = Number(id);
  // Um id que não é número inteiro não chega a consultar o banco: já é
  // "não existe".
  if (!Number.isInteger(idSolicitacao)) notFound();

  await fecharPendenciasVencidas();

  const [solicitacoes, titular, configuracoes] = await Promise.all([
    buscarSolicitacoes(sessao.id, { id: idSolicitacao }),
    buscarTitular(sessao.id),
    obterConfiguracoes(),
  ]);

  // A consulta já exige que a solicitação seja deste cliente, então zero
  // linhas cobre os dois casos — não existe, ou é de outra pessoa — e
  // ambos respondem a mesma coisa. Dizer "existe, mas não é sua" contaria
  // a quem tentou que o número acertou em alguém.
  const solicitacao = solicitacoes[0];
  if (!solicitacao) notFound();

  // RN052 / UC 040, fluxo 2b — o prazo da denúncia conta da confirmação da
  // conclusão ou do registro do cancelamento. Em solicitação só confirmada
  // ele ainda não começou. É a mesma conta que a rota de denúncias faz; aqui
  // ela decide se a tela oferece a denúncia ou o suporte, em vez de oferecer
  // um botão que o servidor vai recusar.
  const marcoDenuncia =
    solicitacao.data_confirmacao_conclusao_cliente ?? solicitacao.data_cancelamento;
  let denunciaNoPrazo = true;
  if (marcoDenuncia) {
    const limite = new Date(marcoDenuncia);
    limite.setDate(limite.getDate() + configuracoes.prazo_denuncia_fornecedor_dias);
    denunciaNoPrazo = limite >= new Date();
  }

  return (
    <DetalheSolicitacao
      solicitacao={solicitacao}
      titular={titular}
      prazoConfirmacaoHoras={configuracoes.prazo_confirmacao_conclusao_horas}
      denunciaNoPrazo={denunciaNoPrazo}
    />
  );
}
