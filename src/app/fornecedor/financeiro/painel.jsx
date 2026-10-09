import { Wallet, Clock, CheckCircle2 } from 'lucide-react';
import Etiqueta from '@/componentes/etiqueta';
import { formatarPreco } from '@/lib/solicitacao';
import Saques from './saques';
import { formatarData } from '@/lib/datas';

// Componente de servidor: só apresenta. A parte interativa — pedir saque e
// reenviar dados — fica isolada no componente Saques, que é de cliente.

export default function PainelFinanceiro({
  saldoDisponivel, diasCarencia, valorMinimoSaque, percentualComissao,
  titular, movimentacoes, saques,
}) {
  const emCarencia = movimentacoes.filter((m) => m.status_repasse === 'pendente');
  const totalEmCarencia = emCarencia.reduce((soma, m) => soma + m.valor, 0);

  // RF057 / RN027 — comissão efetivamente retida: a dos repasses já
  // liberados, cada um com o percentual congelado no seu pagamento. Soma em
  // centavos inteiros pelo mesmo motivo do cálculo do valor final.
  const liberados = movimentacoes.filter((m) => m.status_repasse === 'liberado');
  const comissaoRetida = liberados
    .reduce((soma, m) => soma + Math.round(m.valor_comissao * 100), 0) / 100;
  const podeSacar = saldoDisponivel >= valorMinimoSaque;
  // As frases da carência mudam de forma, e não só de número: "0 dias" não é
  // prazo nenhum, e "1 dias contados" não concorda. Montar o texto aqui deixa
  // os dois lugares que falam de carência dizendo a mesma coisa.
  const prazoEmDias = diasCarencia === 1 ? '1 dia' : `${diasCarencia} dias`;
  const contadosDa = diasCarencia === 1 ? 'contado da' : 'contados da';
  // O cartão soma tudo o que ainda não foi liberado — inclusive serviços
  // pagos que ainda não aconteceram, que não estão em carência nenhuma.
  // Por isso a frase fala em liberação, e não no prazo da carência.
  const avisoDoCartao = `${emCarencia.length} valor(es) aguardando liberação.`;

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
            <span className="text-sm font-medium">A liberar</span>
          </div>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {formatarPreco(totalEmCarencia)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {emCarencia.length === 0
              ? 'Nada aguardando liberação.'
              : avisoDoCartao}
          </p>
        </div>
      </div>

      {/* A frase muda de forma com a carência em vez de interpolar o número
          numa frase fixa: em zero ela dizia "fica retido por 0 dias", e em um
          dizia "1 dias". */}
      <p className="mt-4 text-sm text-slate-600">
        {diasCarencia === 0
          ? 'O valor de cada serviço concluído é liberado para saque assim que a conclusão é confirmada, sem carência.'
          : `O valor de cada serviço concluído fica retido por ${prazoEmDias} ${contadosDa} confirmação da conclusão, e então é liberado para saque.`}
        {' '}A comissão da plataforma é descontada de cada serviço no percentual
        vigente na data da contratação ({percentualComissao}% para as novas
        contratações). Multas de cancelamento não têm comissão e são liberadas
        sem carência. O saque não tem taxa.
      </p>

      {/* RF057 — o valor de comissão retido, e não só o percentual. */}
      <p className="mt-2 text-sm text-slate-600">
        Comissão retida nos repasses já liberados:{' '}
        <span className="font-medium text-slate-900">{formatarPreco(comissaoRetida)}</span>
      </p>

      <Saques
        saldoDisponivel={saldoDisponivel}
        valorMinimoSaque={valorMinimoSaque}
        titular={titular}
        saques={saques} />

      <h2 className="mb-4 mt-10 text-lg font-medium text-slate-900">Movimentações</h2>

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
                  {m.origem === 'conclusao' ? 'Serviço concluído' : 'Multa de cancelamento'}
                  {' · solicitação #'}{m.id_solicitacao}
                </p>
                {/* RF057 / RN027 — a conta de cada repasse, com o
                    percentual congelado no pagamento daquela contratação. */}
                {m.origem === 'conclusao' && (
                  <p className="mt-1 text-xs text-slate-500">
                    {formatarPreco(m.valor_bruto)} − comissão de{' '}
                    {m.percentual_comissao.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
                    {' '}({formatarPreco(m.valor_comissao)})
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {m.status_repasse === 'liberado' ? (
                    <>Liberado em {formatarData(m.data_repasse)}</>
                  ) : m.origem === 'conclusao' && !m.marco ? (
                    // Pago, mas o serviço ainda não foi concluído: não há
                    // data de confirmação de onde contar a carência (RN056).
                    <>Aguardando a conclusão do serviço</>
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
                    <Etiqueta tom="atencao">
                      {m.origem === 'conclusao' && !m.marco ? 'a realizar' : 'em carência'}
                    </Etiqueta>
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
