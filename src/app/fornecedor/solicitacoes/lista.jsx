'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Etiqueta from '@/componentes/etiqueta';
import {
  formatarPreco,
  ROTULO_STATUS_SOLICITACAO,
  TOM_STATUS_SOLICITACAO,
  ROTULO_MOTIVO_RECUSA,
} from '@/lib/solicitacao';

function formatarDataHora(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function somarDias(iso, dias) {
  const data = new Date(iso);
  data.setDate(data.getDate() + dias);
  return data;
}

export default function ListaSolicitacoesRecebidas({
  solicitacoes, prazoRegistroDias, prazoConfirmacaoHoras,
}) {
  const router = useRouter();
  const [recusando, setRecusando] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erroGeral, setErroGeral] = useState('');
  const [mensagem, setMensagem] = useState('');

  async function responder(idSolicitacao, acao, motivoRecusa = null) {
    setErroGeral('');
    setMensagem('');
    setProcessando(true);

    try {
      const resposta = await fetch(`/api/fornecedor/solicitacoes/${idSolicitacao}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, motivoRecusa }),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErroGeral(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (!resposta.ok) {
        setErroGeral(dados.erro ?? 'Não foi possível registrar a resposta.');
        return;
      }

      setRecusando(null);
      setMotivo('');
      setMensagem(
        acao === 'aprovar'
          ? 'Solicitação aprovada. O cliente foi encaminhado para o pagamento.'
          : acao === 'recusar'
            ? 'Solicitação recusada.'
            : 'Conclusão registrada. O cliente foi avisado para confirmar.'
      );
      router.refresh();
    } catch {
      setErroGeral('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Solicitações recebidas</h1>

      {mensagem && <p className="mb-4 text-sm text-sucesso-700">{mensagem}</p>}
      {erroGeral && <p className="mb-4 text-sm text-red-600">{erroGeral}</p>}

      {solicitacoes.length === 0 ? (
        <p className="text-sm text-slate-600">Você ainda não recebeu solicitações.</p>
      ) : (
        <ul className="space-y-4">
          {solicitacoes.map((solicitacao) => {
            const aberta = solicitacao.status === 'aguardando_analise';
            const eventoTerminou = new Date(solicitacao.termino_previsto) <= new Date();

            // UC 019 — pode registrar a conclusão quando a solicitação está
            // confirmada, o evento já terminou e ainda não houve registro.
            const podeRegistrarConclusao =
              solicitacao.status === 'confirmado'
              && eventoTerminou
              && !solicitacao.data_registro_conclusao_fornecedor;

            const aguardandoCliente =
              solicitacao.status === 'confirmado'
              && Boolean(solicitacao.data_registro_conclusao_fornecedor);

            // Endereço completo só depois da aprovação.
            const mostrarEnderecoCompleto =
              !aberta && !['recusado', 'expirado'].includes(solicitacao.status);

            return (
              <li key={solicitacao.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-medium text-slate-900">{solicitacao.servico}</h2>
                    <p className="text-sm text-slate-600">Cliente: {solicitacao.cliente}</p>
                    <p className="mt-2 text-sm text-slate-700">
                      {formatarDataHora(solicitacao.data_hora_evento)} ·{' '}
                      {solicitacao.duracao}h · {solicitacao.numero_convidados} convidados
                    </p>
                    <p className="text-sm text-slate-600">
                      {solicitacao.tipo_local} · {solicitacao.bairro},{' '}
                      {solicitacao.cidade}/{solicitacao.estado}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-slate-900">
                      {formatarPreco(solicitacao.valor_final)}
                    </p>
                    <div className="mt-1.5">
                      <Etiqueta tom={TOM_STATUS_SOLICITACAO[solicitacao.status]}>
                        {ROTULO_STATUS_SOLICITACAO[solicitacao.status]}
                      </Etiqueta>
                    </div>
                  </div>
                </div>

                {(solicitacao.tema || solicitacao.nome_aniversariante || solicitacao.observacoes) && (
                  <div className="mt-3 space-y-1 text-sm text-slate-700">
                    {solicitacao.tema && (
                      <p><span className="font-medium">Tema: </span>{solicitacao.tema}</p>
                    )}
                    {solicitacao.nome_aniversariante && (
                      <p>
                        <span className="font-medium">Aniversariante: </span>
                        {solicitacao.nome_aniversariante}
                        {solicitacao.idade_aniversariante !== null &&
                          `, ${solicitacao.idade_aniversariante} anos`}
                      </p>
                    )}
                    {solicitacao.observacoes && (
                      <p className="whitespace-pre-line">
                        <span className="font-medium">Observações: </span>
                        {solicitacao.observacoes}
                      </p>
                    )}
                  </div>
                )}

                {mostrarEnderecoCompleto && (
                  <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
                    <span className="font-medium">Endereço: </span>
                    {solicitacao.rua}, {solicitacao.numero}
                    {solicitacao.complemento && ` — ${solicitacao.complemento}`}
                    {' · '}{solicitacao.bairro} · CEP {solicitacao.cep}
                  </p>
                )}

                {solicitacao.status === 'recusado' && solicitacao.motivo_recusa && (
                  <p className="mt-3 text-sm text-slate-600">
                    Motivo informado: {ROTULO_MOTIVO_RECUSA[solicitacao.motivo_recusa]}
                  </p>
                )}

                {/* UC 015 — aprovar ou recusar */}
                {aberta && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="mb-3 text-xs text-slate-500">
                      Responda até {formatarDataHora(solicitacao.data_limite_resposta_fornecedor)}.
                      Sem resposta, a solicitação expira automaticamente.
                    </p>

                    {recusando === solicitacao.id ? (
                      <div className="space-y-3">
                        <div>
                          <label htmlFor={`motivo-${solicitacao.id}`}
                            className="mb-1.5 block text-sm font-medium text-slate-700">
                            Motivo da recusa
                          </label>
                          <select id={`motivo-${solicitacao.id}`} value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30">
                            <option value="">Selecione</option>
                            <option value="agenda_indisponivel">Agenda indisponível</option>
                            <option value="fora_da_area">Fora da área de atendimento</option>
                            <option value="inviabilidade">Inviabilidade técnica ou logística</option>
                            <option value="outro">Outro motivo</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" disabled={processando || motivo === ''}
                            onClick={() => responder(solicitacao.id, 'recusar', motivo)}
                            className="rounded-lg bg-perigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-perigo-700 disabled:opacity-50">
                            Confirmar recusa
                          </button>
                          <button type="button"
                            onClick={() => { setRecusando(null); setMotivo(''); }}
                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                            Voltar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={processando}
                          onClick={() => responder(solicitacao.id, 'aprovar')}
                          className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
                          Aprovar
                        </button>
                        <button type="button" disabled={processando}
                          onClick={() => setRecusando(solicitacao.id)}
                          className="rounded-lg border border-perigo-600 px-4 py-2 text-sm font-medium text-perigo-700 transition-colors hover:bg-perigo-50 disabled:opacity-50">
                          Recusar
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* UC 019 — registrar conclusão */}
                {solicitacao.status === 'confirmado' && !aguardandoCliente && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    {podeRegistrarConclusao ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-slate-600">
                          Registre a conclusão até{' '}
                          {formatarDataHora(
                            somarDias(solicitacao.termino_previsto, prazoRegistroDias)
                          )}. Sem registro, a solicitação é cancelada com reembolso ao cliente.
                        </p>
                        <button type="button" disabled={processando}
                          onClick={() => responder(solicitacao.id, 'registrar_conclusao')}
                          className="shrink-0 rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
                          Registrar conclusão
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">
                        A conclusão poderá ser registrada após o término previsto do evento, em{' '}
                        {formatarDataHora(solicitacao.termino_previsto)}.
                      </p>
                    )}
                  </div>
                )}

                {/* UC 020 — aguardando o cliente */}
                {aguardandoCliente && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="text-sm text-slate-600">
                      Conclusão registrada em{' '}
                      {formatarDataHora(solicitacao.data_registro_conclusao_fornecedor)}.
                      Aguardando confirmação do cliente; sem resposta em {prazoConfirmacaoHoras}h,
                      o sistema confirma automaticamente.
                    </p>
                  </div>
                )}

                {solicitacao.status === 'concluido' && (
                  <p className="mt-4 border-t border-slate-200 pt-4 text-sm text-sucesso-700">
                    Serviço concluído e confirmado em{' '}
                    {formatarDataHora(solicitacao.data_confirmacao_conclusao_cliente)}.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
