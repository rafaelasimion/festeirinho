'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import Etiqueta from '@/componentes/etiqueta';
import {
  formatarPreco,
  SUFIXO_PRECO,
  ROTULO_VERIFICACAO,
  TOM_VERIFICACAO,
} from '@/lib/solicitacao';
import {
  ROTULO_MOTIVO_CONTESTACAO,
  ROTULO_RESULTADO_CONTESTACAO,
  TOM_RESULTADO_CONTESTACAO,
} from '@/lib/contestacao';
import AbaFinanceiro from './aba-financeiro';

function formatarDataHora(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function PainelVerificacao({
  nomeAdministrador, fornecedores, servicos, contestacoes = [],
  dadosPendentes = [], processamentos = [],
}) {
  const router = useRouter();
  const [aba, setAba] = useState('fornecedores');
  const [rejeitando, setRejeitando] = useState(null); // `${tipo}:${id}`
  const [motivo, setMotivo] = useState('');
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const pendentesFornecedor = fornecedores.filter((f) => f.status_verificacao === 'pendente').length;
  const pendentesServico = servicos.filter((s) => s.status_verificacao === 'pendente').length;
  const pendentesContestacao = contestacoes.filter((c) => c.status_contestacao === 'pendente').length;
  const pendentesFinanceiro = dadosPendentes.length + processamentos.length;

  async function analisar(tipo, id, acao, motivoRejeicao = null) {
    setErro('');
    setMensagem('');
    setProcessando(true);

    try {
      const resposta = await fetch('/api/admin/verificacao', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, id, acao, motivoRejeicao }),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não foi possível registrar a análise.');
        return;
      }

      setRejeitando(null);
      setMotivo('');
      setMensagem(acao === 'aprovar' ? 'Aprovado.' : 'Rejeitado, com o motivo registrado.');
      router.refresh();
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  async function analisarContestacao(id, resultado, justificativa) {
    setErro('');
    setMensagem('');
    setProcessando(true);

    try {
      const resposta = await fetch('/api/admin/contestacoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resultado, justificativa }),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não foi possível registrar a análise.');
        return;
      }

      setMensagem(
        dados.resultado === 'improcedente'
          ? 'Contestação julgada improcedente. A solicitação foi concluída.'
          : dados.aguardandoDadosRecebimento
            ? 'Contestação julgada procedente. O reembolso aguarda os dados de recebimento do cliente.'
            : 'Contestação julgada procedente. A solicitação foi cancelada com reembolso integral.'
      );
      router.refresh();
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-festa-100">
            <ShieldCheck className="h-5 w-5 text-festa-600" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Painel administrativo</h1>
            <p className="text-sm text-slate-600">{nomeAdministrador}</p>
          </div>
        </div>

        <form action="/api/admin/logout" method="post">
          <button type="submit"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            Sair
          </button>
        </form>
      </header>

      <div className="mb-6 flex flex-wrap gap-2" role="tablist">
        <Aba ativa={aba === 'fornecedores'} aoClicar={() => setAba('fornecedores')}
          rotulo="Fornecedores" pendentes={pendentesFornecedor} />
        <Aba ativa={aba === 'servicos'} aoClicar={() => setAba('servicos')}
          rotulo="Serviços" pendentes={pendentesServico} />
        <Aba ativa={aba === 'contestacoes'} aoClicar={() => setAba('contestacoes')}
          rotulo="Contestações" pendentes={pendentesContestacao} />
        <Aba ativa={aba === 'financeiro'} aoClicar={() => setAba('financeiro')}
          rotulo="Financeiro" pendentes={pendentesFinanceiro} />
      </div>

      {mensagem && <p className="mb-4 text-sm text-sucesso-700">{mensagem}</p>}
      {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}

      {aba === 'fornecedores' && (
        <Lista vazio="Nenhum fornecedor cadastrado.">
          {fornecedores.map((f) => (
            // A chave inclui o status: quando ele muda, o React recria o item
            // e o estado interno de "alterar decisão" volta ao início.
            <Item key={`${f.id}-${f.status_verificacao}`}
              titulo={f.nome_exibicao}
              subtitulo={`${f.responsavel} · ${f.cidade}/${f.estado}`}
              status={f.status_verificacao}
              motivoRejeicao={f.motivo_rejeicao}
              rejeitando={rejeitando === `fornecedor:${f.id}`}
              motivo={motivo}
              aoMudarMotivo={setMotivo}
              processando={processando}
              aoAprovar={() => analisar('fornecedor', f.id, 'aprovar')}
              aoAbrirRejeicao={() => { setRejeitando(`fornecedor:${f.id}`); setMotivo(''); }}
              aoCancelarRejeicao={() => { setRejeitando(null); setMotivo(''); }}
              aoRejeitar={() => analisar('fornecedor', f.id, 'rejeitar', motivo)}>
              <dl className="mt-3 space-y-1 text-sm text-slate-600">
                <Linha rotulo="Tipo">
                  {f.tipo_pessoa === 'PF'
                    ? `Pessoa física · CPF ${f.cpf ?? '—'}`
                    : `Pessoa jurídica · CNPJ ${f.cnpj ?? '—'} · ${f.razao_social ?? '—'}`}
                </Linha>
                <Linha rotulo="Contato">{f.email} · {f.telefone}</Linha>
                <Linha rotulo="Descrição" quebraLinha>{f.descricao}</Linha>
                {(f.instagram_url || f.whatsapp_url || f.site) && (
                  <Linha rotulo="Links">
                    {[f.instagram_url, f.whatsapp_url, f.site].filter(Boolean).join(' · ')}
                  </Linha>
                )}
              </dl>
            </Item>
          ))}
        </Lista>
      )}

      {aba === 'servicos' && (
        <Lista vazio="Nenhum serviço cadastrado.">
          {servicos.map((s) => (
            <Item key={`${s.id}-${s.status_verificacao}`}
              titulo={s.nome}
              subtitulo={`${s.fornecedor} · ${s.categoria}`}
              status={s.status_verificacao}
              motivoRejeicao={s.motivo_rejeicao}
              rejeitando={rejeitando === `servico:${s.id}`}
              motivo={motivo}
              aoMudarMotivo={setMotivo}
              processando={processando}
              aoAprovar={() => analisar('servico', s.id, 'aprovar')}
              aoAbrirRejeicao={() => { setRejeitando(`servico:${s.id}`); setMotivo(''); }}
              aoCancelarRejeicao={() => { setRejeitando(null); setMotivo(''); }}
              aoRejeitar={() => analisar('servico', s.id, 'rejeitar', motivo)}>
              <dl className="mt-3 space-y-1 text-sm text-slate-600">
                <Linha rotulo="Preço">
                  {formatarPreco(s.preco_base)}{SUFIXO_PRECO[s.cobranca]}
                </Linha>
                <Linha rotulo="Condições">
                  antecedência de {s.dias_antecedencia} dias
                  {s.capacidade_max !== null && ` · até ${s.capacidade_max} convidados`}
                </Linha>
                <Linha rotulo="Descrição" quebraLinha>{s.descricao}</Linha>
              </dl>
            </Item>
          ))}
        </Lista>
      )}

      {aba === 'contestacoes' && (
        <Lista vazio="Nenhuma contestação registrada.">
          {contestacoes.map((c) => (
            <ItemContestacao key={`${c.id}-${c.status_contestacao}`}
              contestacao={c}
              processando={processando}
              aoAnalisar={(resultado, justificativa) =>
                analisarContestacao(c.id, resultado, justificativa)} />
          ))}
        </Lista>
      )}

      {aba === 'financeiro' && (
        <AbaFinanceiro dadosPendentes={dadosPendentes} processamentos={processamentos} />
      )}
    </main>
  );
}

function Aba({ ativa, aoClicar, rotulo, pendentes }) {
  return (
    <button type="button" role="tab" aria-selected={ativa} onClick={aoClicar}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        ativa ? 'bg-festa-600 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
      }`}>
      {rotulo}
      {pendentes > 0 && (
        <span className={`rounded-full px-2 py-0.5 text-xs ${
          ativa ? 'bg-white/20 text-white' : 'bg-atencao-100 text-atencao-800'
        }`}>
          {pendentes}
        </span>
      )}
    </button>
  );
}

function Lista({ children, vazio }) {
  const itens = Array.isArray(children) ? children : [children];
  if (itens.filter(Boolean).length === 0) {
    return <p className="text-sm text-slate-600">{vazio}</p>;
  }
  return <ul className="space-y-4">{children}</ul>;
}

function Linha({ rotulo, children, quebraLinha = false }) {
  return (
    <div>
      <dt className="inline font-medium text-slate-700">{rotulo}: </dt>
      <dd className={quebraLinha ? 'inline whitespace-pre-line' : 'inline'}>{children}</dd>
    </div>
  );
}

function Item({
  titulo, subtitulo, status, motivoRejeicao, children,
  rejeitando, motivo, aoMudarMotivo, processando,
  aoAprovar, aoAbrirRejeicao, aoCancelarRejeicao, aoRejeitar,
}) {
  // Item já analisado mostra o resultado, não os botões: ele não está
  // esperando decisão. "Alterar decisão" cobre o engano, que acontece.
  const [revendo, setRevendo] = useState(false);
  const analisado = status !== 'pendente';

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-slate-900">{titulo}</h2>
          <p className="text-sm text-slate-600">{subtitulo}</p>
        </div>
        <Etiqueta tom={TOM_VERIFICACAO[status]} contorno>
          {ROTULO_VERIFICACAO[status]}
        </Etiqueta>
      </div>

      {children}

      {motivoRejeicao && status === 'rejeitado' && (
        <p className="mt-3 rounded-lg border border-perigo-200 bg-perigo-50 p-2 text-sm text-slate-700">
          <span className="font-medium">Motivo registrado: </span>{motivoRejeicao}
        </p>
      )}

      <div className="mt-4 border-t border-slate-200 pt-4">
        {rejeitando ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Motivo da rejeição
              </label>
              <textarea rows={3} value={motivo}
                onChange={(e) => aoMudarMotivo(e.target.value)}
                placeholder="Explique o que precisa ser corrigido. O texto é exibido ao fornecedor."
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
              <p className="mt-1 text-xs text-slate-500">
                {motivo.trim().length}/10 caracteres mínimos.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={aoRejeitar}
                disabled={processando || motivo.trim().length < 10}
                className="rounded-lg bg-perigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-perigo-700 disabled:opacity-50">
                Confirmar rejeição
              </button>
              <button type="button" onClick={aoCancelarRejeicao}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                Voltar
              </button>
            </div>
          </div>
        ) : analisado && !revendo ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {status === 'aprovado'
                ? 'Aprovado e disponível na plataforma.'
                : 'Rejeitado. Volta para análise quando o fornecedor corrigir.'}
            </p>
            <button type="button" onClick={() => setRevendo(true)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-festa-700 transition-colors hover:bg-festa-50">
              Alterar decisão
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={aoAprovar} disabled={processando}
              className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
              Aprovar
            </button>
            <button type="button" onClick={aoAbrirRejeicao} disabled={processando}
              className="rounded-lg border border-perigo-600 px-4 py-2 text-sm font-medium text-perigo-700 transition-colors hover:bg-perigo-50 disabled:opacity-50">
              Rejeitar
            </button>
            {revendo && (
              <button type="button" onClick={() => setRevendo(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                Cancelar
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

// UC 043 — a decisão da contestação é DEFINITIVA: procedente cancela com
// reembolso, improcedente conclui a solicitação. Por isso não existe
// "alterar decisão" aqui, diferente da verificação de cadastro.
function ItemContestacao({ contestacao, processando, aoAnalisar }) {
  const [decidindo, setDecidindo] = useState(null); // 'procedente' | 'improcedente'
  const [justificativa, setJustificativa] = useState('');

  const pendente = contestacao.status_contestacao === 'pendente';

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-slate-900">{contestacao.servico}</h2>
          <p className="text-sm text-slate-600">
            {contestacao.cliente} contestou · fornecedor {contestacao.fornecedor}
          </p>
        </div>
        {pendente ? (
          <Etiqueta tom="atencao" contorno>pendente de análise</Etiqueta>
        ) : (
          <Etiqueta tom={TOM_RESULTADO_CONTESTACAO[contestacao.resultado_contestacao]}>
            {ROTULO_RESULTADO_CONTESTACAO[contestacao.resultado_contestacao]}
          </Etiqueta>
        )}
      </div>

      <dl className="mt-3 space-y-1 text-sm text-slate-600">
        <Linha rotulo="Evento">
          {formatarDataHora(contestacao.data_hora_evento)} · {contestacao.duracao}h ·{' '}
          {contestacao.numero_convidados} convidados
        </Linha>
        <Linha rotulo="Valor">{formatarPreco(contestacao.valor_final)}</Linha>
        <Linha rotulo="Pagamento">
          {contestacao.status_pagamento ?? 'sem pagamento'}
          {contestacao.forma_pagamento && ` · ${contestacao.forma_pagamento}`}
        </Linha>
        <Linha rotulo="Conclusão registrada em">
          {formatarDataHora(contestacao.data_registro_conclusao_fornecedor)}
        </Linha>
        <Linha rotulo="Contestada em">
          {formatarDataHora(contestacao.data_contestacao_cliente)}
        </Linha>
      </dl>

      <div className="mt-3 rounded-lg border border-atencao-200 bg-atencao-50 p-3 text-sm">
        <p className="font-medium text-slate-800">
          {ROTULO_MOTIVO_CONTESTACAO[contestacao.motivo_contestacao_cliente]}
        </p>
        <p className="mt-1 whitespace-pre-line text-slate-700">
          {contestacao.descricao_contestacao_cliente}
        </p>
      </div>

      {!pendente && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-800">Justificativa da decisão</p>
          <p className="mt-1 whitespace-pre-line text-slate-700">
            {contestacao.justificativa_contestacao}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Analisada em {formatarDataHora(contestacao.data_analise_contestacao)}.
          </p>
        </div>
      )}

      <div className="mt-4 border-t border-slate-200 pt-4">
        {!pendente ? (
          <p className="text-sm text-slate-600">
            {contestacao.resultado_contestacao === 'procedente'
              ? 'Solicitação cancelada com reembolso integral ao cliente.'
              : 'Solicitação concluída; a carência do repasse ao fornecedor foi iniciada.'}
          </p>
        ) : decidindo ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              {decidindo === 'procedente'
                ? 'Procedente: a solicitação será cancelada, com reembolso integral ao cliente e sem repasse ao fornecedor.'
                : 'Improcedente: a solicitação será concluída e o repasse ao fornecedor entra em carência.'}
            </p>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Justificativa da decisão
              </label>
              <textarea rows={4} value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Explique a decisão. O texto é exibido ao cliente e ao fornecedor."
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
              <p className="mt-1 text-xs text-slate-500">
                {justificativa.trim().length}/20 caracteres mínimos.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button"
                disabled={processando || justificativa.trim().length < 20}
                onClick={() => aoAnalisar(decidindo, justificativa)}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                  decidindo === 'procedente'
                    ? 'bg-sucesso-600 hover:bg-sucesso-700'
                    : 'bg-perigo-600 hover:bg-perigo-700'
                }`}>
                Confirmar decisão
              </button>
              <button type="button" onClick={() => { setDecidindo(null); setJustificativa(''); }}
                disabled={processando}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={processando}
              onClick={() => { setDecidindo('procedente'); setJustificativa(''); }}
              className="rounded-lg border border-sucesso-600 px-4 py-2 text-sm font-medium text-sucesso-700 transition-colors hover:bg-sucesso-50 disabled:opacity-50">
              Julgar procedente
            </button>
            <button type="button" disabled={processando}
              onClick={() => { setDecidindo('improcedente'); setJustificativa(''); }}
              className="rounded-lg border border-perigo-600 px-4 py-2 text-sm font-medium text-perigo-700 transition-colors hover:bg-perigo-50 disabled:opacity-50">
              Julgar improcedente
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
