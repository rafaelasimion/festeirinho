import { redirect } from 'next/navigation';
import { administradorAtivo } from '@/lib/sessao-admin';
import FormularioLoginAdmin from './formulario';

export const metadata = {
  title: 'Entrar — Painel administrativo',
};

export default async function LoginAdmin() {
  // Já autenticado: vai direto ao painel, como nas telas de login do site.
  const administrador = await administradorAtivo();
  if (administrador) redirect('/admin');

  return <FormularioLoginAdmin />;
}
