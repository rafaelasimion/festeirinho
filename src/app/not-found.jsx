import Link from 'next/link';
import { Home, Search } from 'lucide-react';

// Tela de endereço inexistente (404).
//
// No App Router este arquivo atende dois casos: um endereço que não casa
// com rota nenhuma, e um notFound() chamado de dentro de uma página —
// serviço, fornecedor ou pagamento que não existe, ou que não é de quem
// está pedindo. Por isso o texto não promete qual dos dois foi: dizer
// "este serviço não existe" a quem tentou abrir o pagamento de outra
// pessoa entregaria que o registro existe, só não é dela.

export const metadata = {
  title: 'Página não encontrada · Festeirinho',
};

export default function NaoEncontrada() {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* O mascote sobre o padrão de festa: é o mesmo par que aparece nos
            espaços sem foto, então a tela de erro continua parecendo do
            mesmo sistema. */}
        <div className="flex items-end justify-center bg-festa-50 pt-6"
          style={{
            backgroundImage: 'url(/padrao-festa.webp)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascote-festeirinho.webp" alt=""
            width={480} height={480}
            className="h-40 w-40 object-contain" />
        </div>

        <div className="p-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-festa-600">
            Erro 404
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Essa página saiu da festa
          </h1>
          <p className="mt-2 text-slate-600">
            O endereço não existe ou o que estava aqui saiu do ar.
          </p>

          <div className="mt-6 space-y-2">
            <Link href="/"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-festa-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-festa-700">
              <Home className="h-5 w-5" aria-hidden="true" />
              Voltar ao início
            </Link>
            <Link href="/servicos"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-festa-600 px-4 py-3 font-semibold text-festa-700 transition-colors hover:bg-festa-50">
              <Search className="h-5 w-5" aria-hidden="true" />
              Procurar serviços
            </Link>
          </div>
        </div>
      </div>

      {/* UC 039 — quem chegou aqui por um link que devia funcionar precisa
          de um caminho para avisar alguém. */}
      <p className="mt-6 text-center text-sm text-slate-600">
        Achou que deveria existir?{' '}
        <Link href="/suporte" className="font-medium text-festa-700 hover:underline">
          Fale com o suporte
        </Link>
      </p>
    </main>
  );
}
