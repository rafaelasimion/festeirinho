'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatarPreco } from '@/lib/solicitacao';
import { calcularValores } from '@/lib/cancelamento';

// UC 022 — formulário de cancelamento.
//
// O usuário vê os valores ANTES de confirmar. O cálculo aqui é o mesmo que o
// servidor faz na hora de gravar, importado do mesmo módulo: mostrar um
// número e gravar outro seria pior que não mostrar nada.

export default function DialogoCancelamento({
  solicitadoPor,
  dataEvento,
  pagamento,
  processando,
  aoCancelar,
  aoVoltar,
}) {
  const [motivo, setMotivo] = useState('');

  const { valorMulta, valorReembolso, percentual, rotulo, pago } = calcularValores({
    solicitadoPor,
    dataEvento,
    pagamento,
  });

  return (
    <div className="space-y-4 rounded-lg border border-perigo-200 bg-perigo-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-perigo-600" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-medium text-slate-900">Cancelar esta solicitação</p>
          <p className="mt-0.5 text-sm text-slate-600">
            O cancelamento é definitivo e não pode ser desfeito.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        {!pago ? (
          <p className="text-slate-700">
            O pagamento ainda não foi efetivado, então não há valor a reembolsar
            nem a reter.
          </p>
        ) : solicitadoPor === 'fornecedor' ? (
          <>
            <p className="text-slate-700">
              O cliente receberá o valor integral de volta, sem multa.
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              Reembolso ao cliente: {formatarPreco(valorReembolso)}
            </p>
          </>
        ) : (
          <>
            <p className="text-slate-600">
              Cancelamento {rotulo}: retenção de {percentual}%.
            </p>
            <dl className="mt-3 space-y-1">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Você recebe de volta</dt>
                <dd className="font-semibold text-slate-900">
                  {formatarPreco(valorReembolso)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Valor retido</dt>
                <dd className="font-medium text-perigo-700">
                  {formatarPreco(valorMulta)}
                </dd>
              </div>
            </dl>
            {valorMulta > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                O valor retido é destinado ao fornecedor, como compensação pela
                indisponibilidade gerada pelo cancelamento tardio.
              </p>
            )}
          </>
        )}
      </div>

      <div>
        <label htmlFor="motivo-cancelamento"
          className="mb-1.5 block text-sm font-medium text-slate-700">
          Motivo do cancelamento
        </label>
        <textarea id="motivo-cancelamento" rows={3} value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Explique o que aconteceu. O texto fica registrado na solicitação."
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
        <p className="mt-1 text-xs text-slate-500">
          {motivo.trim().length}/10 caracteres mínimos.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={processando || motivo.trim().length < 10}
          onClick={() => aoCancelar(motivo)}
          className="rounded-lg bg-perigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-perigo-700 disabled:opacity-50">
          {processando ? 'Cancelando...' : 'Confirmar cancelamento'}
        </button>
        <button type="button" onClick={aoVoltar} disabled={processando}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
          Voltar
        </button>
      </div>
    </div>
  );
}
