import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import { pool } from '@/lib/db';

// Esta página roda no servidor. Ela lê a sessão ANTES de renderizar
// qualquer coisa — quem não estiver logado é mandado para o login e
// nunca chega a receber o conteúdo. É o molde de toda página protegida.

export default async function MinhaConta() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const [linhas] = await pool.execute(
    'SELECT nome, nome_usuario, email, cidade, estado FROM usuario WHERE id = ?',
    [sessao.id]
  );

  if (linhas.length === 0) redirect('/login');
  const usuario = linhas[0];

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-2 text-2xl font-semibold">Olá, {usuario.nome}</h1>
      <p className="mb-6 text-sm text-gray-600">
        Você está autenticada como {sessao.tipoUsuario}.
      </p>

      <dl className="space-y-2 text-sm">
        <div><dt className="inline font-medium">Usuário: </dt><dd className="inline">{usuario.nome_usuario}</dd></div>
        <div><dt className="inline font-medium">E-mail: </dt><dd className="inline">{usuario.email}</dd></div>
        <div><dt className="inline font-medium">Cidade: </dt><dd className="inline">{usuario.cidade} / {usuario.estado}</dd></div>
      </dl>

      <form action="/api/logout" method="post" className="mt-8">
        <button type="submit"
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
          Sair
        </button>
      </form>
    </main>
  );
}
