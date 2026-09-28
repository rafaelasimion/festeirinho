import Link from 'next/link';
import { lerSessao } from '@/lib/sessao';
import SinoNotificacoes from '@/componentes/sino-notificacoes';

// Componente de servidor: lê a sessão antes de renderizar, então o menu
// já chega no navegador com os links certos. Não existe um instante em
// que o visitante vê "Sair" antes de a página descobrir quem ele é.

export default async function Cabecalho() {
  const sessao = await lerSessao();

  const ehFornecedor = sessao?.tipoUsuario === 'fornecedor';

  return (
    <header className="border-b border-gray-200">
      <nav className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
        {/* A logo é o nome escrito, então o alt é o nome — e não "logo do
            Festeirinho", que faria o leitor de tela anunciar duas vezes.
            Largura e altura declaradas evitam que o menu "pule" quando a
            imagem termina de carregar. */}
        <Link href="/" className="shrink-0">
          <img src="/logo-festeirinho.webp" alt="Festeirinho"
            width={640} height={184}
            className="h-7 w-auto sm:h-8" />
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
                  <Link href="/favoritos" className="hover:text-festa-700">
                    Favoritos
                  </Link>
                  <Link href="/minhas-solicitacoes" className="hover:text-festa-700">
                    Minhas solicitações
                  </Link>
                </>
              )}

              {/* Sair mora no perfil, junto das outras ações da conta.
                  Aqui em cima ele disputava espaço com a navegação e
                  ficava perigosamente perto dos links de uso diário. */}
              <Link href="/minha-conta"
                className="inline-flex items-center rounded-lg bg-festa-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-festa-700">
                Meu perfil
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}