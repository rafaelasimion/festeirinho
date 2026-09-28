import Link from 'next/link';
import { BadgeCheck, CalendarClock, ShieldCheck } from 'lucide-react';
import { lerSessao } from '@/lib/sessao';

// Os três pilares que o sistema realmente cumpre: verificação (RF014,
// RF025), antecedência mínima por serviço (RN019) e retenção do valor até
// a conclusão (RN057). Não é propaganda — é o que o código faz.
const DESTAQUES = [
  {
    titulo: 'Fornecedores verificados',
    texto: 'Cada perfil e cada serviço passa por verificação antes de aparecer para os clientes.',
    Icone: BadgeCheck,
  },
  {
    titulo: 'Contratação com prazo',
    texto: 'Cada serviço define a antecedência mínima necessária, para dar tempo de resposta e de pagamento.',
    Icone: CalendarClock,
  },
  {
    titulo: 'Pagamento pela plataforma',
    texto: 'O valor fica retido até a conclusão do serviço, com regras claras de cancelamento e reembolso.',
    Icone: ShieldCheck,
  },
];

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
            className="inline-flex items-center rounded-lg bg-festa-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-festa-700">
            Quero contratar serviços
          </Link>
          <Link href="/cadastro/fornecedor"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            Quero oferecer meus serviços
          </Link>
        </div>
      )}

      {sessao?.tipoUsuario === 'fornecedor' && (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/fornecedor/servicos"
            className="inline-flex items-center rounded-lg bg-festa-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-festa-700">
            Gerenciar meus serviços
          </Link>
          <Link href="/fornecedor/perfil"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            Meu perfil
          </Link>
        </div>
      )}

      {sessao?.tipoUsuario === 'cliente' && (
        <div className="mt-8">
          <Link href="/minha-conta"
            className="inline-flex items-center rounded-lg bg-festa-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-festa-700">
            Minha conta
          </Link>
        </div>
      )}

      <section className="mt-14 grid gap-4 sm:grid-cols-3">
        {DESTAQUES.map(({ titulo, texto, Icone }) => (
          <div key={titulo}
            className="rounded-2xl border border-festa-200 bg-festa-100 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
              <Icone className="h-5 w-5 text-festa-600" aria-hidden="true" />
            </span>
            <h2 className="mt-3 font-medium text-slate-900">{titulo}</h2>
            <p className="mt-1 text-sm text-slate-600">{texto}</p>
          </div>
        ))}
      </section>
    </main>
  );
}