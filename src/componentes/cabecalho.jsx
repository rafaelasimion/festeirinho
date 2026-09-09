import Link from 'next/link';
import { lerSessao } from '@/lib/sessao';
import { pool } from '@/lib/db';

// Componente de servidor: lê a sessão antes de renderizar, então o menu
// já chega no navegador com os links certos. Não existe um instante em
// que o visitante vê "Sair" antes de a página descobrir quem ele é.

export default async function Cabecalho() {
  const sessao = await lerSessao();

  let nome = null;
  if (sessao) {
    const [linhas] = await pool.execute(
      'SELECT nome FROM usuario WHERE id = ?',
      [sessao.id]
    );
    nome = linhas[0]?.nome ?? null;
  }

  const ehFornecedor = sessao?.tipoUsuario === 'fornecedor';

  return (
    <header className="border-b border-gray-200">
      <nav className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-lg font-semibold">
          Festeirinho
        </Link>

        <div className="flex items-center gap-4 text-sm">
          {!sessao && (
            <>
              <Link href="/cadastro/cliente" className="hover:underline">
                Criar conta
              </Link>
              <Link href="/login"
                className="rounded bg-gray-900 px-3 py-1.5 text-white">
                Entrar
              </Link>
            </>
          )}

          {sessao && (
            <>
              {ehFornecedor && (
                <>
                  <Link href="/fornecedor/servicos" className="hover:underline">
                    Meus serviços
                  </Link>
                  <Link href="/fornecedor/perfil" className="hover:underline">
                    Meu perfil
                  </Link>
                  <Link href="/servicos" className="hover:underline">
                    Serviços
                  </Link>
                  <Link href="/minhas-solicitacoes" className="hover:underline">
                    Minhas solicitações
                  </Link>
                </>
              )}

              <Link href="/minha-conta" className="hover:underline">
                {nome ?? 'Minha conta'}
              </Link>

              <form action="/api/logout" method="post">
                <button type="submit"
                  className="rounded border border-gray-400 px-3 py-1.5">
                  Sair
                </button>
              </form>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}