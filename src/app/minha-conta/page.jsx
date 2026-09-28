import { redirect } from 'next/navigation';
import {
  UserPen, Bell, Heart, ClipboardList, Store, Package, Wallet,
  CreditCard, LifeBuoy, LogOut, BadgeCheck,
} from 'lucide-react';
import { lerSessao } from '@/lib/sessao';
import { pool } from '@/lib/db';
import FotoPerfil from '@/componentes/foto-perfil';
import MinhaLocalizacao from '@/componentes/minha-localizacao';
import Etiqueta from '@/componentes/etiqueta';
import { SecaoMenu, ItemMenu } from '@/componentes/menu-conta';

// Esta página roda no servidor. Ela lê a sessão ANTES de renderizar
// qualquer coisa — quem não estiver logado é mandado para o login e
// nunca chega a receber o conteúdo. É o molde de toda página protegida.
//
// A foto de perfil é um componente de cliente dentro de uma página de
// servidor: a página entrega os dados prontos, e só o pedaço interativo
// roda no navegador.

const ROTULO_STATUS = {
  ativo: 'Conta ativa',
  pausado: 'Serviços pausados',
  inativo: 'Conta inativa',
};

const TOM_STATUS = {
  ativo: 'sucesso',
  pausado: 'atencao',
  inativo: 'neutro',
};

export default async function MinhaConta() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const ehFornecedor = sessao.tipoUsuario === 'fornecedor';

  // O status vem do perfil, não do usuário: cliente e fornecedor guardam
  // o seu em colunas diferentes (e só o fornecedor pode estar "pausado").
  const [linhas] = await pool.execute(
    `SELECT u.nome, u.nome_usuario, u.email, u.cidade, u.estado, u.foto_perfil,
            u.latitude, u.longitude,
            ${ehFornecedor
              ? 'f.status_fornecedor AS status, f.status_verificacao'
              : "c.status_cliente AS status, NULL AS status_verificacao"}
       FROM usuario u
       ${ehFornecedor
         ? 'JOIN fornecedor f ON f.id_usuario = u.id'
         : 'JOIN cliente c ON c.id_usuario = u.id'}
      WHERE u.id = ?
      LIMIT 1`,
    [sessao.id]
  );

  if (linhas.length === 0) redirect('/login');
  const usuario = linhas[0];
  const verificado = usuario.status_verificacao === 'aprovado';

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <header className="flex flex-col items-center text-center">
        <FotoPerfil
          layout="centrado"
          fotoAtual={usuario.foto_perfil}
          nome={usuario.nome}
          avisoVerificacao={ehFornecedor} />

        <h1 className="mt-4 flex items-center gap-1.5 text-2xl font-semibold text-slate-900">
          {usuario.nome}
          {/* RF014 — o selo de verificado é do fornecedor aprovado. */}
          {verificado && (
            <BadgeCheck className="h-5 w-5 text-festa-600" aria-label="Fornecedor verificado" />
          )}
        </h1>
        <p className="text-slate-500">@{usuario.nome_usuario}</p>

        <div className="mt-3">
          <Etiqueta tom={TOM_STATUS[usuario.status] ?? 'neutro'}>
            {ROTULO_STATUS[usuario.status] ?? usuario.status}
          </Etiqueta>
        </div>

        <p className="mt-3 text-sm text-slate-500">
          {usuario.email} · {usuario.cidade}/{usuario.estado}
        </p>
      </header>

      <SecaoMenu titulo="Conta">
        <ItemMenu href="/minha-conta/editar" Icone={UserPen}
          titulo="Dados de cadastro" descricao="Edite seus dados pessoais" />

        {ehFornecedor ? (
          <>
            <ItemMenu href="/fornecedor/perfil" Icone={Store}
              titulo="Perfil do negócio"
              descricao="Nome de exibição, descrição, disponibilidade e raio de atendimento" />
            <ItemMenu href="/fornecedor/servicos" Icone={Package}
              titulo="Meus serviços" descricao="Cadastre e gerencie o que você oferece" />
            <ItemMenu href="/fornecedor/solicitacoes" Icone={ClipboardList}
              titulo="Solicitações recebidas" descricao="Aprove, recuse e acompanhe" />
            <ItemMenu href="/fornecedor/financeiro" Icone={Wallet}
              titulo="Financeiro" descricao="Saldo, repasses e saques" />
          </>
        ) : (
          <>
            <ItemMenu href="/minhas-solicitacoes" Icone={ClipboardList}
              titulo="Minhas solicitações" descricao="Acompanhe suas contratações" />
            <ItemMenu href="/favoritos" Icone={Heart}
              titulo="Favoritos" descricao="Os serviços que você guardou" />
            {/* RF032 — cartões só existem para quem paga. */}
            <ItemMenu href="/minha-conta/cartoes" Icone={CreditCard}
              titulo="Cartões salvos" descricao="Gerencie seus cartões de crédito" />
          </>
        )}

        <ItemMenu href="/notificacoes" Icone={Bell}
          titulo="Notificações" descricao="Seus avisos da plataforma" />
      </SecaoMenu>

      {/* Trocar senha e excluir conta ficam um nível abaixo, dentro de
          "Dados de cadastro". São ações raras e de peso; deixá-las na
          primeira tela do perfil as põe mais à vista do que merecem. */}

      {/* RF066 / RN068 — quem não autorizou a captura no cadastro pode
          fazê-lo aqui. Sem coordenadas, a busca filtra por cidade. */}
      <section className="mt-8">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Localização
        </h2>
        <MinhaLocalizacao
          coordenadas={usuario.latitude === null ? null : {
            latitude: Number(usuario.latitude),
            longitude: Number(usuario.longitude),
          }}
          descricao={ehFornecedor
            ? 'Define a partir de onde seu raio de atendimento é medido.'
            : 'Mostra os fornecedores que atendem a sua região, com a distância até cada um.'} />
      </section>

      <SecaoMenu titulo="Suporte">
        <ItemMenu href="/suporte" Icone={LifeBuoy}
          titulo="Fale conosco" descricao="Atendimento por e-mail ou WhatsApp" />

        {/* Sair é uma ação que MUDA estado no servidor, então é POST, e
            não um link. Como <form>, funciona mesmo sem JavaScript. */}
        <form action="/api/logout" method="post">
          <ItemMenu type="submit" Icone={LogOut} titulo="Sair da conta" />
        </form>
      </SecaoMenu>
    </main>
  );
}
