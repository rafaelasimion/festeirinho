import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import FormularioConta from './formulario';

export const metadata = { title: 'Editar conta — Festeirinho' };

export default async function EditarConta() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const [linhas] = await pool.execute(
    `SELECT nome, nome_usuario, email, telefone, estado, cidade
       FROM usuario WHERE id = ? LIMIT 1`,
    [sessao.id]
  );
  if (linhas.length === 0) redirect('/login');

  // CPF e data de nascimento não entram: o RF004 lista os dados editáveis
  // e eles ficam de fora, por identificarem a pessoa por trás do cadastro.
  const [documento] = await pool.execute(
    sessao.tipoUsuario === 'fornecedor'
      ? `SELECT tipo_pessoa, cpf, cnpj FROM fornecedor WHERE id_usuario = ? LIMIT 1`
      : `SELECT 'PF' AS tipo_pessoa, cpf, NULL AS cnpj FROM cliente WHERE id_usuario = ? LIMIT 1`,
    [sessao.id]
  );

  return (
    <FormularioConta
      dados={linhas[0]}
      documento={documento[0] ?? null}
      ehFornecedor={sessao.tipoUsuario === 'fornecedor'}
    />
  );
}
