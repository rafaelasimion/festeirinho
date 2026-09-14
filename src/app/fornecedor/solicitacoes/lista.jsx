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
  return new Date(valor).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function ListaSolicitacoesRecebidas({ solicitacoes }) {
  const router = useRouter();
  const [recusando, setRecusando] = useState(null); // id da solicitação
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

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErroGeral(dados.erro ?? 'Não foi possível registrar a resposta.');
        return;
      }

      setRecusando(null);
      setMotivo('');
      setMensagem(
        acao === 'aprovar'
          ? 'Solicitação aprovada. O cliente foi encaminhado para o pagamento.'
          : 'Solicitação recusada.'
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
      <h1 className="mb-6 text-2xl font-semibold">Solicitações recebidas</h1>

      {mensagem && <p className="mb-4 text-sm text-green-700">{mensagem}</p>}
      {erroGeral && <p className="mb-4 text-sm text-red-600">{erroGeral}</p>}

      {solicitacoes.length === 0 ? (
        <p className="text-sm text-gray-600">
          Você ainda não recebeu solicitações.
        </p>
      ) : (
        <ul className="space-y-4">
          {solicitacoes.map((solicitacao) => {
            const aberta = solicitacao.status === 'aguardando_analise';
            // O endereço completo só aparece depois da aprovação. Antes
            // disso, bairro e cidade bastam para avaliar deslocamento.
            const mostrarEnderecoCompleto = !aberta && solicitacao.status !== 'recusado'
              && solicitacao.status !== 'expirado';

            return (
              <li key={solicitacao.id} className="rounded-lg border border-gray-300 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-medium">{solicitacao.servico}</h2>
                    <p className="text-sm text-gray-600">
                      Cliente: {solicitacao.cliente}
                    </p>
                    <p className="mt-2 text-sm">
                      {formatarDataHora(solicitacao.data_hora_evento)} ·{' '}
                      {solicitacao.duracao}h · {solicitacao.numero_convidados} convidados
                    </p>
                    <p className="text-sm text-gray-600">
                      {solicitacao.tipo_local} · {solicitacao.bairro},{' '}
                      {solicitacao.cidade}/{solicitacao.estado}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{formatarPreco(solicitacao.valor_final)}</p>
                    <div className="mt-1.5">
                      <Etiqueta tom={TOM_STATUS_SOLICITACAO[solicitacao.status]}>
                        {ROTULO_STATUS_SOLICITACAO[solicitacao.status]}
                      </Etiqueta>
                    </div>
                  </div>
                </div>

                {(solicitacao.tema || solicitacao.nome_aniversariante || solicitacao.observacoes) && (
                  <div className="mt-3 space-y-1 text-sm text-gray-700">
                    {solicitacao.tema && <p><span className="font-medium">Tema: </span>{solicitacao.tema}</p>}
                    {solicitacao.nome_aniversariante && (
                      <p>
                        <span className="font-medium">Aniversariante: </span>
                        {solicitacao.nome_aniversariante}
                        {solicitacao.idade_aniversariante !== null &&
                          `, ${solicitacao.idade_aniversariante} anos`}
                      </p>
                    )}
                    {solicitacao.observacoes && (
                      <p><span className="font-medium">Observações: </span>{solicitacao.observacoes}</p>
                    )}
                  </div>
                )}

                {mostrarEnderecoCompleto && (
                  <p className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm">
                    <span className="font-medium">Endereço: </span>
                    {solicitacao.rua}, {solicitacao.numero}
                    {solicitacao.complemento && ` — ${solicitacao.complemento}`}
                    {' · '}{solicitacao.bairro} · CEP {solicitacao.cep}
                  </p>
                )}

                {solicitacao.status === 'recusado' && solicitacao.motivo_recusa && (
                  <p className="mt-3 text-sm text-gray-600">
                    Motivo informado: {ROTULO_MOTIVO_RECUSA[solicitacao.motivo_recusa]}
                  </p>
                )}

                {aberta && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <p className="mb-3 text-xs text-gray-500">
                      Responda até {formatarDataHora(solicitacao.data_limite_resposta_fornecedor)}.
                      Sem resposta, a solicitação expira automaticamente.
                    </p>

                    {recusando === solicitacao.id ? (
                      <div className="space-y-3">
                        <div>
                          <label htmlFor={`motivo-${solicitacao.id}`}
                            className="mb-1 block text-sm font-medium">
                            Motivo da recusa
                          </label>
                          <select id={`motivo-${solicitacao.id}`} value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2">
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
                            className="rounded-lg bg-festa-600 hover:bg-festa-700 px-3 py-1.5 text-sm text-white disabled:opacity-50">
                            Confirmar recusa
                          </button>
                          <button type="button"
                            onClick={() => { setRecusando(null); setMotivo(''); }}
                            className="rounded-lg border rounded-lg border border-festa-600 text-festa-700 hover:bg-festa-50 px-3 py-1.5 text-sm px-3 py-1.5 text-sm">
                            Voltar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button type="button" disabled={processando}
                          onClick={() => responder(solicitacao.id, 'aprovar')}
                          className="rounded-lg bg-festa-600 hover:bg-festa-700 px-3 py-1.5 text-sm text-white disabled:opacity-50">
                          Aprovar
                        </button>
                        <button type="button" disabled={processando}
                          onClick={() => setRecusando(solicitacao.id)}
                          className="rounded-lg border rounded-lg border border-festa-600 text-festa-700 hover:bg-festa-50 px-3 py-1.5 text-sm px-3 py-1.5 text-sm">
                          Recusar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}