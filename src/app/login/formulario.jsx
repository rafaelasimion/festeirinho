'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

  async function entrar() {
    setErro('');
    setBloqueio(null);
    setEntrando(true);

    try {
      const resposta = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador, senha }),
      });

      const dados = await resposta.json();

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

  if (bloqueio?.codigo === 'CONTA_EXCLUIDA') {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="mb-4 text-2xl font-semibold">Conta excluída</h1>
        <p className="text-sm">{bloqueio.mensagem}</p>
      </main>
    );
  }

  if (bloqueio?.codigo === 'CONTA_SUSPENSA') {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="mb-4 text-2xl font-semibold">Conta suspensa</h1>
        <div className="space-y-3 rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm">
          <p><span className="font-medium">Motivo:</span> {bloqueio.motivo}</p>
          <p><span className="font-medium">Data:</span> {formatarData(bloqueio.dataSuspensao)}</p>

          {bloqueio.revisao.situacao === 'nenhuma' && (
            <p>Você pode solicitar uma revisão desta suspensão.</p>
          )}

          {bloqueio.revisao.situacao === 'pendente' && (
            <p>
              Sua solicitação de revisão enviada em{' '}
              {formatarData(bloqueio.revisao.dataEnvio)} está em análise.
            </p>
          )}

          {bloqueio.revisao.situacao === 'analisada' && (
            <>
              <p><span className="font-medium">Resultado da revisão:</span> {bloqueio.revisao.resultado}</p>
              <p>Em caso de dúvida, entre em contato com o suporte.</p>
            </>
          )}
        </div>
        <button type="button" onClick={() => setBloqueio(null)}
          className="mt-4 rounded-lg border rounded-lg border border-festa-600 text-festa-700 hover:bg-festa-50 px-3 py-1.5 text-sm px-3 py-1.5 text-sm">
          Voltar
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-2xl font-semibold">Entrar</h1>

      <div className="space-y-4">
        <div>
          <label htmlFor="identificador" className="mb-1 block text-sm font-medium">
            E-mail ou nome de usuário
          </label>
          <input id="identificador" name="identificador" value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2" />
        </div>

        <div>
          <label htmlFor="senha" className="mb-1 block text-sm font-medium">Senha</label>
          <input id="senha" name="senha" type="password" value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') entrar(); }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2" />
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button type="button" onClick={entrar} disabled={entrando}
          className="w-full rounded-lg bg-festa-600 hover:bg-festa-700 px-4 py-2.5 text-white disabled:opacity-50">
          {entrando ? 'Entrando...' : 'Entrar'}
        </button>
        
      </div>
      
    </main>
  );
}
