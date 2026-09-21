import { Wallet, Clock, CheckCircle2 } from 'lucide-react';
import Etiqueta from '@/componentes/etiqueta';
import { formatarPreco } from '@/lib/solicitacao';

// Componente de servidor: só apresenta. Nada aqui muda estado, então não
// precisa de 'use client'.

function formatarData(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleDateString('pt-BR');
}

export default function PainelFinanceiro({
  saldoDisponivel, diasCarencia, valorMinimoSaque, percentualComissao, movimentacoes,
}) {
  const emCarencia = movimentacoes.filter((m) => m.status_repasse === 'pendente');
  const totalEmCarencia = emCarencia.reduce((soma, m) => soma + m.valor, 0);
  const podeSacar = saldoDisponivel >= valorMinimoSaque;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Financeiro</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-festa-200 bg-festa-50 p-5">
          <div className="flex items-center gap-2 text-festa-700">
            <Wallet className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-medium">Saldo disponível</span>
          </div>
          <p className="mt-2 text-3xl font-semibold text-festa-800">
            {formatarPreco(saldoDisponivel)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {podeSacar
              ? 'Disponível para saque.'
              : `Saque a partir de ${formatarPreco(valorMinimoSaque)}.`}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-medium">Em carência</span>
          </div>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {formatarPreco(totalEmCarencia)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {emCarencia.length === 0
              ? 'Nada aguardando liberação.'
              : `${emCarencia.length} valor(es) aguardando o prazo de ${diasCarencia} dias.`}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-600">
        O valor de cada serviço concluído fica retido por {diasCarencia} dias contados da
        confirmação da conclusão, e então é liberado para saque. A plataforma retém{' '}
        {percentualComissao}% de comissão, já descontada nos valores abaixo. Multas de
        cancelamento são liberadas sem carência.
      </p>

      <h2 className="mb-4 mt-8 text-lg font-medium text-slate-900">Movimentações</h2>

      {movimentacoes.length === 0 ? (
        <p className="text-sm text-slate-600">
          Você ainda não tem valores a receber. Eles aparecem aqui quando um serviço é
          concluído ou quando um cancelamento gera multa a seu favor.
        </p>
      ) : (
        <ul className="space-y-3">
          {movimentacoes.map((m) => (
            <li key={`${m.origem}-${m.id_origem}`}
              className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{m.servico}</p>
                <p className="text-sm text-slate-600">
                  {m.origem === 'conclusao'
                    ? 'Serviço concluído'
                    : 'Multa de cancelamento'}
                  {' · solicitação #'}{m.id_solicitacao}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {m.status_repasse === 'liberado' ? (
                    <>Liberado em {formatarData(m.data_repasse)}</>
                  ) : m.origem === 'conclusao' ? (
                    <>Liberação prevista para {formatarData(m.previsao)}</>
                  ) : (
                    <>Liberado junto com a conclusão do cancelamento</>
                  )}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="font-semibold text-slate-900">{formatarPreco(m.valor)}</p>
                <div className="mt-1.5">
                  {m.status_repasse === 'liberado' ? (
                    <Etiqueta tom="sucesso">
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      liberado
                    </Etiqueta>
                  ) : (
                    <Etiqueta tom="atencao">em carência</Etiqueta>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
