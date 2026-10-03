import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import {
  buscarSolicitacoes,
  idDoFornecedor,
  fecharPendenciasVencidas,
} from './consulta';
import ListaSolicitacoesRecebidas from './lista';

export default async function SolicitacoesRecebidas() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');
  if (sessao.tipoUsuario !== 'fornecedor') redirect('/minha-conta');

  const idFornecedor = await idDoFornecedor(sessao.id);
  if (idFornecedor === null) redirect('/minha-conta');

  await fecharPendenciasVencidas();

  // Os dois prazos eram para avisos que agora vivem na página de cada
  // solicitação.
  const solicitacoes = await buscarSolicitacoes(sessao.id, idFornecedor);

  return <ListaSolicitacoesRecebidas solicitacoes={solicitacoes} />;
}
