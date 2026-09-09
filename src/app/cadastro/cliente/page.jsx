import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import FormularioCadastroCliente from './formulario';

export default async function CadastroCliente() {
  const sessao = await lerSessao();
  if (sessao) redirect('/minha-conta');

  return <FormularioCadastroCliente />;
}