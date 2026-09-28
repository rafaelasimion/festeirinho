import Link from 'next/link';
import { lerSessao } from '@/lib/sessao';
import SinoNotificacoes from '@/componentes/sino-notificacoes';
import MenuNavegacao from '@/componentes/menu-navegacao';

// Componente de servidor: lê a sessão antes de renderizar, então o menu
// já chega no navegador com os links certos. Não existe um instante em
// que o visitante vê links de fornecedor antes de a página descobrir
// quem ele é.
//
// Aqui só se decide O QUE cada papel vê. COMO isso aparece — em linha no
// desktop, atrás de um botão no celular — é com o MenuNavegacao.

const LINKS_CLIENTE = [
  { href: '/servicos', rotulo: 'Serviços' },
  { href: '/favoritos', rotulo: 'Favoritos' },
  { href: '/minhas-solicitacoes', rotulo: 'Minhas solicitações' },
];

const LINKS_FORNECEDOR = [
  // "Meus serviços" saiu: a vitrine passou a ser a única lista, e o
  // cadastro e a edição se alcançam pelos botões de lá.
  { href: '/fornecedor/vitrine', rotulo: 'Minha vitrine' },
  { href: '/fornecedor/solicitacoes', rotulo: 'Solicitações' },
  { href: '/fornecedor/financeiro', rotulo: 'Financeiro' },
];

export default async function Cabecalho() {
  const sessao = await lerSessao();
  const ehFornecedor = sessao?.tipoUsuario === 'fornecedor';

  // "Meu perfil" é mais um destino, não a ação principal da barra. Como
  // botão ele pesava no desktop e, no menu do celular, ficava sozinho com
  // cara de botão no meio de uma lista de links. Entra na mesma lista.
  const links = !sessao ? [] : [
    ...(ehFornecedor ? LINKS_FORNECEDOR : LINKS_CLIENTE),
    { href: '/minha-conta', rotulo: 'Meu perfil' },
  ];

  return (
    // relative é o que ancora o painel do menu logo abaixo da barra.
    <header className="relative border-b border-gray-200">
      <nav className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-6 py-4">
        {/* A logo é o nome escrito, então o alt é o nome — e não "logo do
            Festeirinho", que faria o leitor de tela anunciar duas vezes.
            Largura e altura declaradas evitam que o menu "pule" quando a
            imagem termina de carregar. */}
        <Link href="/" className="shrink-0">
          <img src="/logo-festeirinho.webp" alt="Festeirinho"
            width={640} height={184}
            className="h-7 w-auto sm:h-8" />
        </Link>

        {!sessao && (
          <div className="flex items-center gap-3 text-sm">
            <Link href="/cadastro" className="text-slate-700 transition-colors hover:text-festa-700">
              Criar conta
            </Link>
            <Link href="/login"
              className="inline-flex items-center rounded-lg bg-festa-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-festa-700">
              Entrar
            </Link>
          </div>
        )}

        {sessao && (
          <div className="flex items-center gap-2 sm:gap-3">
            {/* O sino fica fora do menu: um aviso não lido precisa ser
                visto sem ninguém precisar abrir nada. */}
            <SinoNotificacoes />
            <MenuNavegacao links={links} />
          </div>
        )}
      </nav>
    </header>
  );
}
