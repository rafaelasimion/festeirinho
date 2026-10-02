import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import { buscarSolicitacoes, fecharPendenciasVencidas } from './consulta';
import ListaMinhasSolicitacoes from './lista';

export default async function MinhasSolicitacoes() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');
  if (sessao.tipoUsuario !== 'cliente') redirect('/minha-conta');

  await fecharPendenciasVencidas();

  // A lista não precisa mais do titular nem do prazo de confirmação: os
  // dois eram para painéis que agora vivem na página da solicitação.
  const solicitacoes = await buscarSolicitacoes(sessao.id);

  return <ListaMinhasSolicitacoes solicitacoes={solicitacoes} />;
}
