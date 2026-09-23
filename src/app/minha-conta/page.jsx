import Link from 'next/link';
import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import { pool } from '@/lib/db';
import FotoPerfil from '@/componentes/foto-perfil';
import MinhaLocalizacao from '@/componentes/minha-localizacao';

// Esta página roda no servidor. Ela lê a sessão ANTES de renderizar
// qualquer coisa — quem não estiver logado é mandado para o login e
// nunca chega a receber o conteúdo. É o molde de toda página protegida.
//
// A foto de perfil é um componente de cliente dentro de uma página de
// servidor: a página entrega os dados prontos, e só o pedaço interativo
// roda no navegador.

export default async function MinhaConta() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const [linhas] = await pool.execute(
    `SELECT nome, nome_usuario, email, cidade, estado, foto_perfil,
            latitude, longitude
       FROM usuario WHERE id = ?`,
    [sessao.id]
  );

  if (linhas.length === 0) redirect('/login');
  const usuario = linhas[0];
  const ehFornecedor = sessao.tipoUsuario === 'fornecedor';

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Minha conta</h1>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <FotoPerfil
          fotoAtual={usuario.foto_perfil}
          nome={usuario.nome}
          avisoVerificacao={ehFornecedor} />

        <div className="mt-5 border-t border-slate-200 pt-5">
          <p className="text-lg font-medium text-slate-900">{usuario.nome}</p>
          <p className="text-sm text-slate-600">
            {ehFornecedor ? 'Conta de fornecedor' : 'Conta de cliente'}
          </p>

          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="inline font-medium text-slate-700">Usuário: </dt>
              <dd className="inline text-slate-700">{usuario.nome_usuario}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-slate-700">E-mail: </dt>
              <dd className="inline text-slate-700">{usuario.email}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-slate-700">Cidade: </dt>
              <dd className="inline text-slate-700">{usuario.cidade}/{usuario.estado}</dd>
            </div>
          </dl>
        </div>

        {/* RF066 / RN068 — quem não autorizou a captura no cadastro pode
            fazê-lo aqui. Sem coordenadas, a busca filtra por cidade. */}
        <div className="mt-6 border-t border-slate-200 pt-5">
          <p className="mb-2 text-sm font-medium text-slate-700">Localização</p>
          <MinhaLocalizacao
            coordenadas={usuario.latitude === null ? null : {
              latitude: Number(usuario.latitude),
              longitude: Number(usuario.longitude),
            }}
            descricao={ehFornecedor
              ? 'Define a partir de onde seu raio de atendimento é medido.'
              : 'Mostra os fornecedores que atendem a sua região, com a distância até cada um.'} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-5">
          {ehFornecedor ? (
            <Link href="/fornecedor/perfil"
              className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700">
              Editar perfil do negócio
            </Link>
          ) : (
            <Link href="/minhas-solicitacoes"
              className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700">
              Minhas solicitações
            </Link>
          )}
          <form action="/api/logout" method="post">
            <button type="submit"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
              Sair
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
