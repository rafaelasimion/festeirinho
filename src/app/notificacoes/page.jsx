import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Bell, CalendarCheck, CreditCard, XCircle, Star, Store, UserCog, Wallet,
} from 'lucide-react';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';

// UC 017 / RF064 — central de notificações.

export const metadata = { title: 'Notificações — Festeirinho' };

// Cada tipo tem um ícone e um destino. Os tipos com solicitação levam à
// lista de solicitações do papel correspondente; os demais, à seção
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
    return ehFornecedor ? '/fornecedor/solicitacoes' : '/minhas-solicitacoes';
  }
  if (notificacao.tipo === 'servico') return '/fornecedor/servicos';
  if (notificacao.tipo === 'financeiro') return '/fornecedor/financeiro';
  return ehFornecedor ? '/fornecedor/perfil' : '/minha-conta';
}

function formatarDataHora(valor) {
  return new Date(valor).toLocaleString('pt-BR', {
    dateStyle: 'short', timeStyle: 'short',
  });
}

export default async function Notificacoes() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const ehFornecedor = sessao.tipoUsuario === 'fornecedor';

  // UC 017, etapa 3 — ordem cronológica decrescente.
  const [notificacoes] = await pool.execute(
    `SELECT id, tipo, titulo, mensagem, id_solicitacao, lida, data_criacao
       FROM notificacao WHERE id_usuario = ?
      ORDER BY data_criacao DESC, id DESC
      LIMIT 100`,
    [sessao.id]
  );

  // UC 017, etapa 4 — marca como lidas as que acabaram de ser exibidas.
  //
  // A leitura acontece DEPOIS da consulta, de propósito: assim esta visita
  // ainda mostra em destaque o que estava por ler, e o indicador zera na
  // navegação seguinte. Marcar antes apagaria o destaque justamente na tela
  // em que ele importa.
  //
  // A CHECK da tabela exige "lida" e a data de leitura preenchidas juntas.
  const naoLidas = notificacoes.filter((n) => !n.lida).length;
  if (naoLidas > 0) {
    await pool.execute(
      `UPDATE notificacao SET lida = TRUE, data_leitura = NOW()
        WHERE id_usuario = ? AND lida = FALSE`,
      [sessao.id]
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Notificações</h1>

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
                    notificacao.lida
                      ? 'border-slate-200 bg-white hover:bg-slate-50'
                      : 'border-festa-200 bg-festa-50 hover:bg-festa-100'}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    notificacao.lida ? 'bg-slate-100' : 'bg-white'}`}>
                    <Icone className={`h-5 w-5 ${
                      notificacao.lida ? 'text-slate-500' : 'text-festa-600'}`}
                      aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className={`font-medium ${
                        notificacao.lida ? 'text-slate-800' : 'text-festa-800'}`}>
                        {notificacao.titulo}
                      </p>
                      <span className="text-xs text-slate-500">
                        {formatarDataHora(notificacao.data_criacao)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-700">{notificacao.mensagem}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {rotulo}
                      {!notificacao.lida && ' · nova'}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
