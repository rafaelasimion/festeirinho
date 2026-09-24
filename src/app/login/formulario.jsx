'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import Campo from '@/componentes/campo';

function formatarData(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleDateString('pt-BR');
}

export default function FormularioLogin() {
  const router = useRouter();
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [bloqueio, setBloqueio] = useState(null);
  const [entrando, setEntrando] = useState(false);

  // UC 006 — a solicitação de revisão parte daqui, da tela de bloqueio.
  const [pedindoRevisao, setPedindoRevisao] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [erroRevisao, setErroRevisao] = useState('');
  const [revisaoEnviada, setRevisaoEnviada] = useState(false);

  async function entrar() {
    setErro('');
    setEntrando(true);

    try {
      const resposta = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador, senha }),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (resposta.ok) {
        router.push(dados.destino);
        router.refresh();
        return;
      }

      if (dados.codigo === 'CONTA_SUSPENSA' || dados.codigo === 'CONTA_EXCLUIDA') {
        setBloqueio(dados);
        return;
      }

      setErro(dados.erro ?? 'Não foi possível entrar.');
    } catch {
      setErro('Falha de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setEntrando(false);
    }
  }

  async function enviarRevisao() {
    setErroRevisao('');
    setEntrando(true);

    try {
      // As credenciais seguem junto: sem sessão, é o que prova que quem
      // pede a revisão é o dono da conta.
      const resposta = await fetch('/api/revisao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador, senha, justificativa }),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErroRevisao(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (!resposta.ok) {
        setErroRevisao(dados.erro ?? 'Não foi possível enviar a solicitação.');
        return;
      }

      setPedindoRevisao(false);
      setRevisaoEnviada(true);
    } catch {
      setErroRevisao('Falha de conexão. Tente novamente.');
    } finally {
      setEntrando(false);
    }
  }

  // UC 003, fluxo 6b — conta excluída: bloqueio definitivo, sem revisão.
  if (bloqueio?.codigo === 'CONTA_EXCLUIDA') {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="mb-4 text-2xl font-semibold text-slate-900">Conta excluída</h1>
        <p className="text-sm text-slate-700">{bloqueio.mensagem}</p>
      </main>
    );
  }

  // UC 003, fluxo 6a — conta suspensa.
  if (bloqueio?.codigo === 'CONTA_SUSPENSA') {
    const revisao = bloqueio.revisao ?? { situacao: 'nenhuma' };
    // 6a.2 — a opção de revisão só aparece quando não há pedido em aberto
    // nem análise concluída para a suspensão vigente.
    const podePedirRevisao = revisao.situacao === 'nenhuma' && !revisaoEnviada;

    return (
      <main className="mx-auto max-w-md p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-perigo-50">
              <ShieldAlert className="h-5 w-5 text-perigo-600" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Conta suspensa</h1>
              <p className="text-sm text-slate-600">
                Suspensa em {formatarData(bloqueio.dataSuspensao)}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-perigo-50 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-perigo-700">
              Motivo
            </p>
            <p className="mt-1 whitespace-pre-line text-slate-700">{bloqueio.motivo}</p>
          </div>

          {/* 6a.3 — pedido em análise */}
          {revisao.situacao === 'pendente' && (
            <p className="mt-4 text-sm text-slate-700">
              Sua solicitação de revisão enviada em {formatarData(revisao.dataEnvio)} está
              em análise. Você será informado do resultado nesta tela.
            </p>
          )}

          {/* 6a.4 — análise concluída com manutenção da suspensão */}
          {revisao.situacao === 'analisada' && (
            <div className="mt-4 rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Resultado da revisão
              </p>
              <p className="mt-1 whitespace-pre-line text-slate-700">{revisao.resultado}</p>
              <p className="mt-2 text-xs text-slate-500">
                Em caso de dúvida, entre em contato pelo suporte da plataforma.
              </p>
            </div>
          )}

          {revisaoEnviada && (
            <p className="mt-4 rounded-lg bg-sucesso-50 p-3 text-sm text-sucesso-800">
              Solicitação enviada. A administração vai analisar e o resultado aparece
              nesta tela na próxima tentativa de acesso.
            </p>
          )}

          {/* UC 006 — formulário de revisão */}
          {podePedirRevisao && (
            pedindoRevisao ? (
              <div className="mt-5 space-y-3 border-t border-slate-200 pt-5">
                <label htmlFor="justificativa"
                  className="block text-sm font-medium text-slate-700">
                  Justificativa
                </label>
                <textarea id="justificativa" rows={4} value={justificativa}
                  onChange={(e) => { setJustificativa(e.target.value); setErroRevisao(''); }}
                  placeholder="Explique por que a suspensão deve ser revista."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
                <p className="text-xs text-slate-500">
                  {justificativa.trim().length}/20 caracteres mínimos.
                </p>
                {erroRevisao && <p className="text-sm text-red-600">{erroRevisao}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={enviarRevisao}
                    disabled={entrando || justificativa.trim().length < 20}
                    className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
                    {entrando ? 'Enviando...' : 'Enviar solicitação'}
                  </button>
                  <button type="button" onClick={() => setPedindoRevisao(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 border-t border-slate-200 pt-5">
                <p className="mb-3 text-sm text-slate-600">
                  Se você acredita que houve engano, pode pedir que a administração
                  revise esta suspensão.
                </p>
                <button type="button" onClick={() => setPedindoRevisao(true)}
                  className="rounded-lg border border-festa-600 px-4 py-2 text-sm font-medium text-festa-700 transition-colors hover:bg-festa-50">
                  Solicitar revisão
                </button>
              </div>
            )
          )}

          <button type="button"
            onClick={() => { setBloqueio(null); setRevisaoEnviada(false); setPedindoRevisao(false); }}
            className="mt-5 text-sm font-medium text-slate-600 hover:underline">
            Voltar ao login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Entrar</h1>

      <div className="space-y-4">
        <Campo label="E-mail ou nome de usuário" name="identificador" value={identificador}
          onChange={(e) => setIdentificador(e.target.value)} />

        <Campo label="Senha" name="senha" type="password" value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') entrar(); }} />

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button type="button" onClick={entrar} disabled={entrando}
          className="w-full rounded-lg bg-festa-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
          {entrando ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="pt-2 text-center text-sm text-slate-600">
          Ainda não tem conta?{' '}
          <Link href="/cadastro" className="font-medium text-festa-700 hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  );
}
