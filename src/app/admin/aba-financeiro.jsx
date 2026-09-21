'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import Etiqueta from '@/componentes/etiqueta';
import { formatarPreco } from '@/lib/solicitacao';
import { descreverRecebimento, TIPOS_CHAVE_PIX } from '@/lib/recebimento';

// Aba "Financeiro" do painel administrativo.
//
// Duas filas, na ordem em que o dinheiro anda:
//   1. dados de recebimento aguardando validação (UC 038)
//   2. transferências e estornos em processamento, esperando o gateway

function formatarDataHora(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AbaFinanceiro({ dadosPendentes, processamentos }) {
  const router = useRouter();
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  async function executar(corpo, textoSucesso) {
    setErro('');
    setMensagem('');
    setProcessando(true);
    try {
      const resposta = await fetch('/api/admin/financeiro', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return false;
      }

      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não foi possível concluir a operação.');
        return false;
      }

      setMensagem(textoSucesso);
      router.refresh();
      return true;
    } catch {
      setErro('Falha de conexão. Tente novamente.');
      return false;
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="space-y-10">
      {mensagem && <p className="text-sm text-sucesso-700">{mensagem}</p>}
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <section>
        <h2 className="mb-1 text-base font-medium text-slate-900">
          Dados de recebimento para validar
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          Confira se os dados pertencem ao titular da conta na plataforma antes de validar.
        </p>

        {dadosPendentes.length === 0 ? (
          <p className="text-sm text-slate-600">Nenhum dado aguardando validação.</p>
        ) : (
          <ul className="space-y-4">
            {dadosPendentes.map((d) => (
              <ItemValidacao key={d.id} dados={d} processando={processando}
                aoDecidir={(resultado, motivo) => executar(
                  { acao: 'validar_dados', id: d.id, resultado, motivo },
                  resultado === 'validado'
                    ? 'Dados validados. A transferência foi enviada ao gateway.'
                    : 'Dados rejeitados, com o motivo registrado.'
                )} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-base font-medium text-slate-900">
          Em processamento no gateway
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          Simulação: informe o resultado que o gateway devolveria.
        </p>

        {processamentos.length === 0 ? (
          <p className="text-sm text-slate-600">Nada em processamento.</p>
        ) : (
          <ul className="space-y-4">
            {processamentos.map((p) => (
              <ItemProcessamento key={`${p.origem}-${p.id}`} item={p} processando={processando}
                aoConcluir={(resultado, motivo) => executar(
                  p.origem === 'saque'
                    ? { acao: 'concluir_saque', id: p.id, resultado, motivo }
                    : { acao: 'concluir_reembolso', id: p.id },
                  p.origem === 'saque'
                    ? resultado === 'concluido'
                      ? 'Saque concluído.'
                      : 'Saque recusado. O valor voltou ao saldo do fornecedor.'
                    : 'Reembolso concluído.'
                )} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ItemValidacao({ dados, processando, aoDecidir }) {
  const [rejeitando, setRejeitando] = useState(false);
  const [motivo, setMotivo] = useState('');

  // RN061 — os dados precisam pertencer ao titular. O painel já compara o
  // documento informado com o da conta, para a administração não ter de
  // conferir de cabeça.
  const documentoConfere = dados.cpf_cnpj_titular === dados.documento_conta;
  const rotuloChave = TIPOS_CHAVE_PIX.find((t) => t.valor === dados.tipo_chave_pix)?.rotulo;

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">
            {dados.origem === 'saque' ? 'Saque' : 'Reembolso'} de {formatarPreco(dados.valor)}
          </p>
          <p className="text-sm text-slate-600">
            {dados.origem === 'saque' ? 'Fornecedor' : 'Cliente'}: {dados.nome_conta}
          </p>
        </div>
        <Etiqueta tom="atencao" contorno>aguardando validação</Etiqueta>
      </div>

      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3">
          <dt className="mb-1 font-medium text-slate-700">Destino informado</dt>
          <dd className="text-slate-700">
            {dados.tipo_recebimento === 'pix'
              ? <>Pix · {rotuloChave}<br />{dados.chave_pix}</>
              : <>{descreverRecebimento(dados)}</>}
          </dd>
        </div>
        <div className={`rounded-lg border p-3 ${
          documentoConfere ? 'border-sucesso-200 bg-sucesso-50' : 'border-perigo-200 bg-perigo-50'}`}>
          <dt className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
            {documentoConfere
              ? <CheckCircle2 className="h-4 w-4 text-sucesso-600" aria-hidden="true" />
              : <AlertTriangle className="h-4 w-4 text-perigo-600" aria-hidden="true" />}
            Titular
          </dt>
          <dd className="text-slate-700">
            Informado: {dados.nome_titular} · {dados.cpf_cnpj_titular}<br />
            Na conta: {dados.nome_conta} · {dados.documento_conta}
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-xs text-slate-500">Enviado em {formatarDataHora(dados.data_envio)}.</p>

      <div className="mt-4 border-t border-slate-200 pt-4">
        {rejeitando ? (
          <div className="space-y-3">
            <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explique o que está errado. O texto é exibido para quem enviou os dados."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
            <p className="text-xs text-slate-500">{motivo.trim().length}/10 caracteres mínimos.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={processando || motivo.trim().length < 10}
                onClick={() => aoDecidir('rejeitado', motivo)}
                className="rounded-lg bg-perigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-perigo-700 disabled:opacity-50">
                Confirmar rejeição
              </button>
              <button type="button" onClick={() => { setRejeitando(false); setMotivo(''); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={processando} onClick={() => aoDecidir('validado')}
              className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
              Validar
            </button>
            <button type="button" disabled={processando} onClick={() => setRejeitando(true)}
              className="rounded-lg border border-perigo-600 px-4 py-2 text-sm font-medium text-perigo-700 transition-colors hover:bg-perigo-50 disabled:opacity-50">
              Rejeitar
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function ItemProcessamento({ item, processando, aoConcluir }) {
  const [falhando, setFalhando] = useState(false);
  const [motivo, setMotivo] = useState('');

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">
            {item.origem === 'saque' ? 'Transferência de saque' : 'Estorno de reembolso'} ·{' '}
            {formatarPreco(item.valor)}
          </p>
          <p className="text-sm text-slate-600">{item.nome_conta}</p>
          {item.destino && <p className="text-xs text-slate-500">{item.destino}</p>}
        </div>
        <Etiqueta tom="atencao">processando</Etiqueta>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4">
        {falhando ? (
          <div className="space-y-3">
            <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo da falha informado pelo gateway."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={processando || motivo.trim().length < 10}
                onClick={() => aoConcluir('recusado', motivo)}
                className="rounded-lg bg-perigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-perigo-700 disabled:opacity-50">
                Registrar falha
              </button>
              <button type="button" onClick={() => { setFalhando(false); setMotivo(''); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={processando} onClick={() => aoConcluir('concluido')}
              className="rounded-lg bg-sucesso-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sucesso-700 disabled:opacity-50">
              {item.origem === 'saque' ? 'Transferência confirmada' : 'Estorno confirmado'}
            </button>
            {/* UC 037, fluxo 9a — só o saque tem caminho de falha documentado. */}
            {item.origem === 'saque' && (
              <button type="button" disabled={processando} onClick={() => setFalhando(true)}
                className="rounded-lg border border-perigo-600 px-4 py-2 text-sm font-medium text-perigo-700 transition-colors hover:bg-perigo-50 disabled:opacity-50">
                Transferência falhou
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
