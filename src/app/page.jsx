import Link from 'next/link';
import { lerSessao } from '@/lib/sessao';

export default async function Inicio() {
  const sessao = await lerSessao();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-semibold">
        A festa das crianças, organizada num lugar só
      </h1>
      <p className="mt-4 max-w-2xl text-gray-600">
        O Festeirinho conecta quem está organizando uma festa infantil a
        fornecedores de buffet, decoração, animação, fotografia e muito mais.
        Você encontra, solicita e contrata pela plataforma.
      </p>

      {!sessao && (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/cadastro/cliente"
            className="rounded bg-gray-900 px-4 py-2.5 text-sm text-white">
            Quero contratar serviços
          </Link>
          <Link href="/cadastro/fornecedor"
            className="rounded border border-gray-400 px-4 py-2.5 text-sm">
            Quero oferecer meus serviços
          </Link>
        </div>
      )}

      {sessao?.tipoUsuario === 'fornecedor' && (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/fornecedor/servicos"
            className="rounded bg-gray-900 px-4 py-2.5 text-sm text-white">
            Gerenciar meus serviços
          </Link>
          <Link href="/fornecedor/perfil"
            className="rounded border border-gray-400 px-4 py-2.5 text-sm">
            Meu perfil
          </Link>
        </div>
      )}

      {sessao?.tipoUsuario === 'cliente' && (
        <div className="mt-8">
          <Link href="/minha-conta"
            className="rounded bg-gray-900 px-4 py-2.5 text-sm text-white">
            Minha conta
          </Link>
        </div>
      )}

      <section className="mt-16 grid gap-8 sm:grid-cols-3">
        <div>
          <h2 className="font-medium">Fornecedores verificados</h2>
          <p className="mt-1 text-sm text-gray-600">
            Cada perfil e cada serviço passa por verificação antes de aparecer
            para os clientes.
          </p>
        </div>
        <div>
          <h2 className="font-medium">Contratação com prazo</h2>
          <p className="mt-1 text-sm text-gray-600">
            Cada serviço define a antecedência mínima necessária, para dar tempo
            de resposta e de pagamento.
          </p>
        </div>
        <div>
          <h2 className="font-medium">Pagamento pela plataforma</h2>
          <p className="mt-1 text-sm text-gray-600">
            O valor fica retido até a conclusão do serviço, com regras claras de
            cancelamento e reembolso.
          </p>
        </div>
      </section>
    </main>
  );
}