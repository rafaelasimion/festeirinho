import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import FormularioLogin from './formulario';

// Quem já está logado e abre o login vai para onde o login o levaria: a
// tela inicial do seu perfil (UC 003, passo 7).
export default async function Login() {
  const sessao = await lerSessao();
  if (sessao) redirect('/');

  return <FormularioLogin />;
}