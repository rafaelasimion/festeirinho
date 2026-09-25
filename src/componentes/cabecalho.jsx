import Link from 'next/link';
import { lerSessao } from '@/lib/sessao';
import { pool } from '@/lib/db';
import SinoNotificacoes from '@/componentes/sino-notificacoes';

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
              <Link href="/cadastro" className="hover:text-festa-700">
                Criar conta
              </Link>
              <Link href="/login"
                className="inline-flex items-center rounded-lg bg-festa-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-festa-700">
                Entrar
              </Link>
            </>
          )}

          {sessao && (
            <>
            <SinoNotificacoes />
              {ehFornecedor && (
                <>
                  <Link href="/fornecedor/servicos" className="hover:text-festa-700">
                    Meus serviços
                  </Link>
                  <Link href="/fornecedor/solicitacoes" className="hover:text-festa-700">
                    Solicitações recebidas
                  </Link>
                  <Link href="/fornecedor/financeiro" className="hover:text-festa-700">
                    Financeiro
                  </Link>
                  <Link href="/fornecedor/perfil" className="hover:text-festa-700">
                    Meu perfil
                  </Link>
                </>
              )}

              {!ehFornecedor && (
                <>
                  <Link href="/servicos" className="hover:text-festa-700">
                    Serviços
                  </Link>
                  <Link href="/minhas-solicitacoes" className="hover:text-festa-700">
                    Minhas solicitações
                  </Link>
                </>
              )}

              <Link href="/minha-conta" className="hover:text-festa-700">
                {nome ?? 'Minha conta'}
              </Link>

              <form action="/api/logout" method="post">
                <button type="submit"
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-50">
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