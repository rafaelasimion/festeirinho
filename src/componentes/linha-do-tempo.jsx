import { marcosDaSolicitacao } from '@/lib/solicitacao';
import { formatarDataHora } from '@/lib/datas';

// RF023 — a linha do tempo da solicitação, nas duas telas de detalhe.
//
// O que ela resolve: o cartão já mostrava as datas dos marcos, mas
// espalhadas pelos avisos e pelos painéis, cada uma numa frase sua. Quem
// precisava reconstruir a história — e é exatamente o que uma contestação
// ou uma denúncia obrigam a fazer — lia seis parágrafos em ordem aleatória.
// Aqui ela está numa coluna só, do mais antigo para o mais recente.
//
// Sem estado e sem interação: é componente de servidor, e o HTML já chega
// pronto.

const TONS = {
  neutro: 'bg-slate-300',
  sucesso: 'bg-sucesso-600',
  atencao: 'bg-atencao-600',
  perigo: 'bg-perigo-600',
};

export default function LinhaDoTempo({ solicitacao }) {
  const marcos = marcosDaSolicitacao(solicitacao);

  // Uma solicitação recém-enviada tem um marco só. Uma linha do tempo de um
  // ponto não é uma linha do tempo — é a data de envio, que o resumo já dá.
  if (marcos.length < 2) return null;

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Histórico
      </h2>

      <ol className="space-y-0">
        {marcos.map((marco, posicao) => {
          const ultimo = posicao === marcos.length - 1;

          return (
            <li key={`${marco.data}-${marco.titulo}`} className="flex gap-3">
              {/* A coluna da esquerda: o ponto e o fio que desce até o
                  próximo. O fio é um irmão do ponto, com largura de 2px e
                  altura esticada pelo flex, em vez de uma borda no <li> —
                  assim ele não passa por baixo do último ponto. */}
              <div className="flex w-2 shrink-0 flex-col items-center">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  TONS[marco.tom] ?? TONS.neutro}`} aria-hidden="true" />
                {!ultimo && <span className="w-0.5 flex-1 bg-slate-200" aria-hidden="true" />}
              </div>

              <div className={`min-w-0 ${ultimo ? '' : 'pb-4'}`}>
                <p className="text-sm font-medium text-slate-800">{marco.titulo}</p>
                <p className="text-xs text-slate-500">
                  {formatarDataHora(marco.data)}
                  {marco.detalhe && <span className="text-slate-600"> · {marco.detalhe}</span>}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
