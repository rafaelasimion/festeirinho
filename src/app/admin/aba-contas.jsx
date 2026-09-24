'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Store, ShieldAlert } from 'lucide-react';
import Etiqueta from '@/componentes/etiqueta';

// UC 027 / UC 035 — contas da plataforma: suspensão, reativação e análise
// das solicitações de revisão.

const ROTULO_STATUS = {
  ativo: 'ativa',
  suspenso: 'suspensa',
  inativo: 'inativa',
  excluido: 'excluída',
};

const TOM_STATUS = {
  ativo: 'sucesso',
  suspenso: 'perigo',
  inativo: 'neutro',
  excluido: 'neutro',
};

function formatarDataHora(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// Plural sem "(s)": a palavra certa para cada quantidade. Tem duas formas
// porque em português o plural nem sempre é só acrescentar a letra —
// "contestação" vira "contestações".
function plural(quantidade, singular, muitos) {
  return `${quantidade} ${quantidade === 1 ? singular : muitos}`;
}

// UC 027 — a pré-condição é existir um motivo que justifique a suspensão.
// Parte dos motivos tem registro no sistema: contestação decidida contra a
// pessoa e cancelamentos que ela causou. Outros vêm de fora (fraude,
// denúncia por e-mail, ordem judicial) — por isso a lista completa continua
// acessível, mas não é o que a aba mostra de saída.
function precisaAtencao(conta) {
  return conta.status === 'suspenso'
    || conta.status_solicitacao_revisao === 'pendente'
    || conta.alerta_contestacoes > 0
    || conta.alerta_cancelamentos > 0;
}

export default function AbaContas({ contas }) {
  const router = useRouter();
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const revisoesPendentes = contas.filter((c) => c.status_solicitacao_revisao === 'pendente');
  const comAtencao = contas.filter(precisaAtencao);
  const visiveis = mostrarTodas ? contas : comAtencao;

  async function executar(corpo, textoSucesso) {
    setErro('');
    setMensagem('');
    setProcessando(true);
    try {
      const resposta = await fetch('/api/admin/contas', {
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
    <div className="space-y-4">
      {revisoesPendentes.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-atencao-50 p-3 text-sm text-slate-700">
          <ShieldAlert className="h-4 w-4 shrink-0 text-atencao-600" aria-hidden="true" />
          {plural(revisoesPendentes.length, 'solicitação de revisão aguardando',
            'solicitações de revisão aguardando')} análise.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {mostrarTodas
            ? `${plural(contas.length, 'conta cadastrada', 'contas cadastradas')}.`
            : `${plural(comAtencao.length, 'conta com ocorrência registrada',
                'contas com ocorrência registrada')}.`}
        </p>
        <button type="button" onClick={() => setMostrarTodas(!mostrarTodas)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
          {mostrarTodas ? 'Ver só as que pedem atenção' : 'Ver todas as contas'}
        </button>
      </div>

      {mensagem && <p className="text-sm text-sucesso-700">{mensagem}</p>}
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {visiveis.length === 0 ? (
        <p className="text-sm text-slate-600">
          {mostrarTodas
            ? 'Nenhuma conta cadastrada.'
            : 'Nenhuma conta com ocorrência registrada. Para suspender por um motivo externo à plataforma, use "Ver todas as contas".'}
        </p>
      ) : (
        <ul className="space-y-4">
          {visiveis.map((conta) => (
            <ItemConta key={`${conta.tipo}-${conta.id}`} conta={conta}
              processando={processando} aoExecutar={executar} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemConta({ conta, processando, aoExecutar }) {
  const [suspendendo, setSuspendendo] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [resultado, setResultado] = useState('');

  const ehFornecedor = conta.tipo === 'fornecedor';
  const Icone = ehFornecedor ? Store : User;
  const suspensa = conta.status === 'suspenso';
  const excluida = conta.status === 'excluido';
  const revisaoPendente = conta.status_solicitacao_revisao === 'pendente';

  const corpoBase = { tipo: conta.tipo, id: conta.id };

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-festa-100">
            {conta.foto_perfil ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={conta.foto_perfil} alt="" className="h-full w-full object-cover" />
            ) : (
              <Icone className="h-5 w-5 text-festa-600" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <h2 className="font-medium text-slate-900">
              {ehFornecedor ? conta.nome_exibicao : conta.nome}
            </h2>
            <p className="text-sm text-slate-600">
              {ehFornecedor ? 'Fornecedor' : 'Cliente'} · {conta.email}
              {conta.cidade && ` · ${conta.cidade}/${conta.estado}`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <Etiqueta tom={TOM_STATUS[conta.status]} contorno>
            {ROTULO_STATUS[conta.status]}
          </Etiqueta>
          {revisaoPendente && <Etiqueta tom="atencao">revisão pendente</Etiqueta>}
        </div>
      </div>

      {(conta.alerta_contestacoes > 0 || conta.alerta_cancelamentos > 0) && (
        <dl className="mt-3 space-y-1 rounded-lg bg-atencao-50 p-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-700">
              {ehFornecedor
                ? 'Contestações julgadas procedentes'
                : 'Contestações julgadas improcedentes'}
            </dt>
            <dd className="font-semibold text-atencao-800">{conta.alerta_contestacoes}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-700">Cancelamentos causados por esta conta</dt>
            <dd className="font-semibold text-atencao-800">{conta.alerta_cancelamentos}</dd>
          </div>
        </dl>
      )}

      {suspensa && conta.motivo_suspensao && (
        <div className="mt-3 rounded-lg bg-perigo-50 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-perigo-700">
            Motivo da suspensão · {formatarDataHora(conta.data_suspensao)}
          </p>
          <p className="mt-1 whitespace-pre-line text-slate-700">{conta.motivo_suspensao}</p>
        </div>
      )}

      {conta.status_solicitacao_revisao && (
        <div className="mt-3 rounded-lg border border-slate-200 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Solicitação de revisão · {formatarDataHora(conta.data_solicitacao_revisao)}
          </p>
          <p className="mt-1 whitespace-pre-line text-slate-700">
            {conta.motivo_solicitacao_revisao}
          </p>
          {conta.status_solicitacao_revisao === 'analisada' && (
            <div className="mt-2 border-t border-slate-200 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Resposta · {formatarDataHora(conta.data_analise_revisao)}
              </p>
              <p className="mt-1 whitespace-pre-line text-slate-700">
                {conta.resultado_solicitacao_revisao}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-slate-200 pt-4">
        {excluida ? (
          <p className="text-sm text-slate-600">
            Conta excluída em caráter definitivo (RN044). Não há ação disponível.
          </p>
        ) : suspendendo ? (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Motivo da suspensão
            </label>
            <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="O texto é exibido ao usuário na tela de bloqueio."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
            <p className="text-xs text-slate-500">{motivo.trim().length}/10 caracteres mínimos.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={processando || motivo.trim().length < 10}
                onClick={async () => {
                  const certo = await aoExecutar(
                    { ...corpoBase, acao: 'suspender', motivo },
                    'Conta suspensa. O acesso foi bloqueado.'
                  );
                  if (certo) { setSuspendendo(false); setMotivo(''); }
                }}
                className="rounded-lg bg-perigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-perigo-700 disabled:opacity-50">
                Confirmar suspensão
              </button>
              <button type="button" onClick={() => { setSuspendendo(false); setMotivo(''); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                Voltar
              </button>
            </div>
          </div>
        ) : analisando ? (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Resposta à solicitação de revisão
            </label>
            <textarea rows={4} value={resultado} onChange={(e) => setResultado(e.target.value)}
              placeholder="Explique a decisão. O texto é exibido ao usuário na tela de bloqueio."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
            <p className="text-xs text-slate-500">{resultado.trim().length}/20 caracteres mínimos.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={processando || resultado.trim().length < 20}
                onClick={async () => {
                  const certo = await aoExecutar(
                    { ...corpoBase, acao: 'analisar_revisao', resultado, manterSuspensao: false },
                    'Revisão acolhida. A conta voltou a ficar ativa.'
                  );
                  if (certo) { setAnalisando(false); setResultado(''); }
                }}
                className="rounded-lg bg-sucesso-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sucesso-700 disabled:opacity-50">
                Acolher e reativar
              </button>
              <button type="button" disabled={processando || resultado.trim().length < 20}
                onClick={async () => {
                  const certo = await aoExecutar(
                    { ...corpoBase, acao: 'analisar_revisao', resultado, manterSuspensao: true },
                    'Revisão analisada. A suspensão foi mantida.'
                  );
                  if (certo) { setAnalisando(false); setResultado(''); }
                }}
                className="rounded-lg border border-perigo-600 px-4 py-2 text-sm font-medium text-perigo-700 transition-colors hover:bg-perigo-50 disabled:opacity-50">
                Manter suspensão
              </button>
              <button type="button" onClick={() => { setAnalisando(false); setResultado(''); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {revisaoPendente && (
              <button type="button" disabled={processando} onClick={() => setAnalisando(true)}
                className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
                Analisar revisão
              </button>
            )}
            {suspensa ? (
              // Com revisão pendente, a reativação passa pela análise: a
              // pessoa precisa receber resposta ao que enviou (UC 035).
              !revisaoPendente && (
                <button type="button" disabled={processando}
                  onClick={() => aoExecutar(
                    { ...corpoBase, acao: 'reativar' },
                    'Conta reativada.'
                  )}
                  className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
                  Reativar conta
                </button>
              )
            ) : (
              <button type="button" disabled={processando} onClick={() => setSuspendendo(true)}
                className="rounded-lg border border-perigo-600 px-4 py-2 text-sm font-medium text-perigo-700 transition-colors hover:bg-perigo-50 disabled:opacity-50">
                Suspender conta
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
