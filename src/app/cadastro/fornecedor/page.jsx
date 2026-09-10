import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import { obterConfiguracoes } from '@/lib/configuracao';
import FormularioCadastroFornecedor from './formulario';

export default async function CadastroFornecedor() {
  const sessao = await lerSessao();
  if (sessao) redirect('/minha-conta');

  // RN068 — o raio sugerido no cadastro vem da configuração, não do código.
  // Como esta é uma página de servidor, o valor é lido aqui e entregue ao
  // formulário como propriedade; não precisa de rota de API para isso.
  const configuracoes = await obterConfiguracoes();

  return (
    <FormularioCadastroFornecedor
      raioPadrao={configuracoes.raio_atendimento_padrao_km}
    />
  );
}