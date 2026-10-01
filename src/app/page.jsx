import Link from 'next/link';
import { BadgeCheck, CalendarClock, ShieldCheck } from 'lucide-react';
import { lerSessao } from '@/lib/sessao';

// Os três pilares que o sistema realmente cumpre: moderação do serviço
// (RN031, RF013), antecedência mínima por serviço (RN019) e retenção do
// valor até a conclusão (RN057). Não é propaganda — é o que o código faz.
const DESTAQUES = [
  {
    // O texto dizia que o perfil do fornecedor passa por verificação antes
    // de aparecer, e isso contraria a RN005: o perfil não espera nada, e a
    // verificação só acende o selo. Quem passa por análise antes de entrar
    // na busca é o serviço (RN031).
    titulo: 'Serviços conferidos',
    texto: 'Cada serviço passa pela análise da administração antes de aparecer na busca.',
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
    <main className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
        A festa das crianças, organizada num lugar só
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">
        O Festeirinho conecta quem está organizando uma festa infantil a
        fornecedores de buffet, decoração, animação, fotografia e muito mais.
        Você encontra, solicita e contrata pela plataforma.
      </p>

      {!sessao && (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/cadastro/cliente"
            className="inline-flex items-center rounded-xl bg-festa-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-festa-700">
            Quero contratar serviços
          </Link>
          <Link href="/cadastro/fornecedor"
            className="inline-flex items-center rounded-xl border border-festa-600 bg-white px-5 py-3 font-semibold text-festa-700 transition-colors hover:bg-festa-50">
            Quero oferecer meus serviços
          </Link>
        </div>
      )}

      {sessao?.tipoUsuario === 'fornecedor' && (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/fornecedor/vitrine"
            className="inline-flex items-center rounded-xl bg-festa-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-festa-700">
            Minha vitrine
          </Link>
          <Link href="/fornecedor/perfil"
            className="inline-flex items-center rounded-xl border border-festa-600 bg-white px-5 py-3 font-semibold text-festa-700 transition-colors hover:bg-festa-50">
            Meu perfil
          </Link>
        </div>
      )}

      {sessao?.tipoUsuario === 'cliente' && (
        <div className="mt-8">
          <Link href="/minha-conta"
            className="inline-flex items-center rounded-xl bg-festa-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-festa-700">
            Minha conta
          </Link>
        </div>
      )}

      {/* Cartão branco com borda, igual a todos os outros do sistema. O
          lilás cheio que havia aqui era a única peça da plataforma pintada
          por inteiro, e sobre ele o texto cinza perdia contraste — o roxo
          fica no ícone, que é onde ele identifica sem atrapalhar a
          leitura. */}
      <section className="mt-14 grid gap-4 sm:grid-cols-3">
        {DESTAQUES.map(({ titulo, texto, Icone }) => (
          <div key={titulo}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-festa-100">
              <Icone className="h-5 w-5 text-festa-600" aria-hidden="true" />
            </span>
            <h2 className="mt-3.5 font-semibold text-slate-900">{titulo}</h2>
            <p className="mt-1 text-sm text-slate-600">{texto}</p>
          </div>
        ))}
      </section>
    </main>
  );
}