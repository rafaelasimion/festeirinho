import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import FormularioLogin from './formulario';

export default async function Login() {
  const sessao = await lerSessao();
  if (sessao) redirect('/minha-conta');

  return <FormularioLogin />;
}