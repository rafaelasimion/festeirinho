'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import Campo from '@/componentes/campo';
import MolduraAuth from '@/componentes/moldura-auth';

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
      <MolduraAuth>
        <h1 className="text-center text-2xl font-semibold text-slate-900">
          Conta excluída
        </h1>
        <p className="mt-3 text-center text-slate-600">{bloqueio.mensagem}</p>
        <Link href="/"
          className="mt-8 flex w-full items-center justify-center rounded-xl border border-festa-600 px-4 py-3.5 font-semibold text-festa-700 transition-colors hover:bg-festa-50">
          Voltar ao início
        </Link>
      </MolduraAuth>
    );
  }

  // UC 003, fluxo 6a — conta suspensa.
  if (bloqueio?.codigo === 'CONTA_SUSPENSA') {
    const revisao = bloqueio.revisao ?? { situacao: 'nenhuma' };
    // 6a.2 — a opção de revisão só aparece quando não há pedido em aberto
    // nem análise concluída para a suspensão vigente.
    const podePedirRevisao = revisao.situacao === 'nenhuma' && !revisaoEnviada;

    return (
      <MolduraAuth>
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-perigo-50">
            <ShieldAlert className="h-7 w-7 text-perigo-600" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Conta suspensa</h1>
          <p className="mt-1 text-sm text-slate-600">
            Suspensa em {formatarData(bloqueio.dataSuspensao)}
          </p>
        </div>

        <div className="mt-6 rounded-xl bg-perigo-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-perigo-700">
            Motivo
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
            {bloqueio.motivo}
          </p>
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
          <div className="mt-4 rounded-xl border border-festa-100 bg-festa-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Resultado da revisão
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
              {revisao.resultado}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Em caso de dúvida,{' '}
              <Link href="/suporte?assunto=conta&origem=conta"
                className="font-medium text-festa-700 hover:underline">
                fale com o suporte
              </Link>.
            </p>
          </div>
        )}

        {revisaoEnviada && (
          <p className="mt-4 rounded-xl bg-sucesso-50 p-4 text-sm text-sucesso-800">
            Solicitação enviada. A administração vai analisar e o resultado aparece
            nesta tela na próxima tentativa de acesso.
          </p>
        )}

        {/* UC 006 — formulário de revisão */}
        {podePedirRevisao && (
          pedindoRevisao ? (
            <div className="mt-6 space-y-3 border-t border-slate-200 pt-6">
              <label htmlFor="justificativa"
                className="block text-sm font-medium text-slate-700">
                Justificativa
              </label>
              <textarea id="justificativa" rows={4} value={justificativa}
                onChange={(e) => { setJustificativa(e.target.value); setErroRevisao(''); }}
                placeholder="Explique por que a suspensão deve ser revista."
                className="w-full rounded-xl border border-festa-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/25" />
              <p className="text-xs text-slate-500">
                {justificativa.trim().length}/20 caracteres mínimos.
              </p>
              {erroRevisao && <p className="text-sm text-perigo-600">{erroRevisao}</p>}
              <div className="space-y-3 pt-1">
                <button type="button" onClick={enviarRevisao}
                  disabled={entrando || justificativa.trim().length < 20}
                  className="w-full rounded-xl bg-festa-600 px-4 py-3.5 font-semibold text-white transition-colors hover:bg-festa-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {entrando ? 'Enviando...' : 'Enviar solicitação'}
                </button>
                <button type="button" onClick={() => setPedindoRevisao(false)}
                  className="w-full rounded-xl border border-festa-600 px-4 py-3.5 font-semibold text-festa-700 transition-colors hover:bg-festa-50">
                  Voltar
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 border-t border-slate-200 pt-6">
              <p className="mb-4 text-sm text-slate-600">
                Se você acredita que houve engano, pode pedir que a administração
                revise esta suspensão.
              </p>
              <button type="button" onClick={() => setPedindoRevisao(true)}
                className="w-full rounded-xl border border-festa-600 px-4 py-3.5 font-semibold text-festa-700 transition-colors hover:bg-festa-50">
                Solicitar revisão
              </button>
            </div>
          )
        )}

        <button type="button"
          onClick={() => { setBloqueio(null); setRevisaoEnviada(false); setPedindoRevisao(false); }}
          className="mt-6 w-full text-sm font-medium text-slate-600 hover:underline">
          Voltar ao login
        </button>
      </MolduraAuth>
    );
  }

  return (
    <MolduraAuth>
      <div className="text-center">
        {/* Sem aumento no desktop: o cartão tem largura fixa, então um
            corpo maior só faria o título quebrar em duas linhas. */}
        <h1 className="text-2xl font-semibold text-slate-900">
          Bem-vindo de volta!
        </h1>
        <p className="mt-1.5 text-slate-600">Entre para continuar planejando</p>
      </div>

      <div className="mt-8 space-y-5">
        <Campo label="E-mail ou nome de usuário" name="identificador"
          value={identificador} placeholder="nome@email.com"
          autoComplete="username"
          onChange={(e) => setIdentificador(e.target.value)} />

        <Campo label="Senha" name="senha" type="password" value={senha}
          placeholder="Sua senha" autoComplete="current-password"
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') entrar(); }} />

        {erro && (
          <p className="rounded-xl bg-perigo-50 px-4 py-3 text-sm text-perigo-700">
            {erro}
          </p>
        )}

        <button type="button" onClick={entrar} disabled={entrando}
          className="w-full rounded-xl bg-festa-600 px-4 py-3.5 font-semibold text-white transition-colors hover:bg-festa-700 disabled:cursor-not-allowed disabled:opacity-50">
          {entrando ? 'Entrando...' : 'Entrar'}
        </button>
      </div>

      {/* Separador: a linha é decorativa, então fica em aria-hidden e o
          "ou" não é lido como se fosse conteúdo. */}
      <div aria-hidden="true" className="my-7 flex items-center gap-4">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-sm text-slate-400">ou</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <p className="text-center text-slate-600">Ainda não tem uma conta?</p>
      <Link href="/cadastro"
        className="mt-3 flex w-full items-center justify-center rounded-xl border border-festa-600 px-4 py-3.5 font-semibold text-festa-700 transition-colors hover:bg-festa-50">
        Cadastre-se
      </Link>
    </MolduraAuth>
  );
}
