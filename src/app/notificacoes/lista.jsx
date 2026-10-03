'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell, CalendarCheck, CreditCard, XCircle, Star, Store, UserCog, Wallet,
} from 'lucide-react';
import { formatarDataHora } from '@/lib/datas';

// Cada tipo tem um ícone e um destino. Os tipos com solicitação levam à
// solicitação em si, no papel de quem recebeu o aviso; os demais, à seção
// relacionada (RN065).
const TIPOS = {
  solicitacao: { Icone: CalendarCheck, rotulo: 'Solicitação' },
  pagamento: { Icone: CreditCard, rotulo: 'Pagamento' },
  cancelamento: { Icone: XCircle, rotulo: 'Cancelamento' },
  avaliacao: { Icone: Star, rotulo: 'Avaliação' },
  servico: { Icone: Store, rotulo: 'Serviço' },
  conta: { Icone: UserCog, rotulo: 'Conta' },
  financeiro: { Icone: Wallet, rotulo: 'Financeiro' },
};

function destino(notificacao, ehFornecedor) {
  if (notificacao.id_solicitacao) {
    // UC 017, passo 6 — "a tela do item relacionado à notificação", que
    // agora existe para os dois papéis. Antes só havia a lista, e quem
    // clicava num aviso sobre a solicitação 3 caía numa lista de doze para
    // procurá-la de novo.
    return ehFornecedor
      ? `/fornecedor/solicitacoes/${notificacao.id_solicitacao}`
      : `/minhas-solicitacoes/${notificacao.id_solicitacao}`;
  }
  // O aviso de serviço aprovado ou recusado leva à vitrine: é lá que o
  // serviço aparece, com o motivo da recusa junto quando há um.
  if (notificacao.tipo === 'servico') return '/fornecedor/vitrine';
  if (notificacao.tipo === 'financeiro') return '/fornecedor/financeiro';
  return ehFornecedor ? '/fornecedor/perfil' : '/minha-conta';
}

// UC 017, etapa 3 — a lista da central de notificações.
//
// É componente de cliente por duas razões que andam juntas.
//
// A primeira: o sino. Ele conta as não lidas, é componente de servidor e
// mora no cabeçalho, que mora no layout — e layout não é re-renderizado em
// navegação do lado do cliente. A central marcava tudo como lido no banco,
// a tela mostrava tudo como lido, e o número continuava lá, com a contagem
// de quando o layout foi montado. Só um F5 o derrubava. O router.refresh()
// daqui busca a rota de novo a partir do topo, layout incluído.
//
// A segunda: esse refresh traria de volta a lista com tudo já marcado como
// lido, e o destaque lilás do que estava por ler morreria meio segundo
// depois de a pessoa chegar — justamente na tela em que ele serve para
// alguma coisa. Por isso quem estava por ler é decidido UMA vez, na
// montagem, e guardado em estado de cliente: router.refresh() re-renderiza
// o servidor mas preserva o estado do cliente, então o destaque atravessa
// o refresh intacto e só se desfaz quando a pessoa sai e volta.
export default function ListaNotificacoes({ notificacoes, ehFornecedor }) {
  const router = useRouter();

  // Congelado na chegada, de propósito: a prop `notificacoes` muda depois
  // do refresh, este conjunto não. O inicializador em função garante que o
  // cálculo aconteça só na primeira montagem.
  const [naoLidasNaChegada] = useState(
    () => new Set(notificacoes.filter((n) => !n.lida).map((n) => n.id))
  );

  const lida = (notificacao) => !naoLidasNaChegada.has(notificacao.id);

  // A trava garante UM refresh por montagem, aconteça o que acontecer com
  // as dependências do efeito. Sem ela o laço é real: o efeito depende de
  // `router`, e basta useRouter() devolver um objeto novo a cada render
  // para o refresh disparar de novo a cada re-renderização — e o refresh
  // CAUSA uma re-renderização. Um contador no teste mostrou exatamente
  // isso: dois pedidos onde devia haver um. Num servidor de verdade, seria
  // um pedido atrás do outro, para sempre.
  const jaAtualizou = useRef(false);

  useEffect(() => {
    // Sem nada por ler, o sino já está zerado e não há o que buscar.
    if (naoLidasNaChegada.size === 0 || jaAtualizou.current) return;
    jaAtualizou.current = true;
    router.refresh();
  }, [naoLidasNaChegada, router]);

  return (
    <>
    {notificacoes.length === 0 ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <Bell className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
        <p className="mt-3 text-sm text-slate-600">
          Você não tem notificações. Os avisos sobre suas solicitações, pagamentos
          e conta aparecem aqui.
        </p>
      </div>
    ) : (
      <ul className="space-y-2">
        {notificacoes.map((notificacao) => {
          const { Icone, rotulo } = TIPOS[notificacao.tipo];
          return (
            <li key={notificacao.id}>
              <Link href={destino(notificacao, ehFornecedor)}
                className={`flex gap-3 rounded-xl border p-4 transition-colors ${
                  lida(notificacao)
                    ? 'border-slate-200 bg-white hover:bg-slate-50'
                    : 'border-festa-200 bg-festa-50 hover:bg-festa-100'}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  lida(notificacao) ? 'bg-slate-100' : 'bg-white'}`}>
                  <Icone className={`h-5 w-5 ${
                    lida(notificacao) ? 'text-slate-500' : 'text-festa-600'}`}
                    aria-hidden="true" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className={`font-medium ${
                      lida(notificacao) ? 'text-slate-800' : 'text-festa-800'}`}>
                      {notificacao.titulo}
                    </p>
                    <span className="text-xs text-slate-500">
                      {formatarDataHora(notificacao.data_criacao)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-700">{notificacao.mensagem}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {rotulo}
                    {!lida(notificacao) && ' · nova'}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    )}
    </>
  );
}
