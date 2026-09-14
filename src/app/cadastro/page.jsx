import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import EscolhaCadastro from './escolha';

export default async function Cadastro() {
  const sessao = await lerSessao();
  if (sessao) redirect('/minha-conta');

  return <EscolhaCadastro />;
}