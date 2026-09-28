import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';

// Atalho para a vitrine do próprio fornecedor.
//
// A vitrine mora em /fornecedores/<id>, mas o menu não sabe o id de quem
// está logado sem ir ao banco. Esta rota é o endereço fixo que o cabeçalho
// e o perfil usam: ela descobre o id e encaminha.

export default async function MinhaVitrine() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');
  if (sessao.tipoUsuario !== 'fornecedor') redirect('/minha-conta');

  const [linhas] = await pool.execute(
    'SELECT id FROM fornecedor WHERE id_usuario = ? LIMIT 1',
    [sessao.id]
  );

  if (linhas.length === 0) redirect('/minha-conta');
  redirect(`/fornecedores/${linhas[0].id}`);
}
