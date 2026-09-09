import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import FormularioCadastroFornecedor from './formulario';

export default async function CadastroFornecedor() {
  const sessao = await lerSessao();
  if (sessao) redirect('/minha-conta');

  return <FormularioCadastroFornecedor />;
}