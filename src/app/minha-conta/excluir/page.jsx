import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import { impedimentosParaExcluir } from '@/lib/exclusao-servidor';
import FormularioExclusao from './formulario';

export const metadata = { title: 'Excluir conta — Festeirinho' };

export default async function ExcluirConta() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  // RN044 — os impedimentos são calculados antes de mostrar a tela, para a
  // pessoa saber de saída o que falta resolver em vez de descobrir só ao
  // tentar confirmar.
  const impedimentos = await impedimentosParaExcluir(sessao.id, sessao.tipoUsuario);

  return (
    <FormularioExclusao
      impedimentos={impedimentos}
      ehFornecedor={sessao.tipoUsuario === 'fornecedor'}
    />
  );
}
