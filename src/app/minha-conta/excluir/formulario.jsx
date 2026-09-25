'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, Check } from 'lucide-react';
import Campo from '@/componentes/campo';

// UC 007 — confirmação da exclusão.

export default function FormularioExclusao({ impedimentos, ehFornecedor }) {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [bloqueios, setBloqueios] = useState(impedimentos);
  const [concluida, setConcluida] = useState(false);

  async function excluir() {
    setErro('');
    setProcessando(true);
    try {
      const resposta = await fetch('/api/perfil/excluir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (resposta.ok) {
        setConcluida(true);
        // A sessão já foi encerrada no servidor; o refresh limpa o
        // cabeçalho e as telas em memória.
        router.refresh();
        return;
      }

      // Entre abrir a tela e confirmar, algo pode ter mudado.
      if (dados.impedimentos) {
        setBloqueios(dados.impedimentos);
        return;
      }
      setErro(dados.erros?.senha ?? dados.erro ?? 'Não foi possível excluir a conta.');
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  if (concluida) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sucesso-50">
          <Check className="h-6 w-6 text-sucesso-600" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Conta excluída</h1>
        <p className="mt-2 text-sm text-slate-600">
          Seus dados pessoais foram removidos. O histórico das contratações
          permanece guardado sem identificação, por obrigação fiscal.
        </p>
        <Link href="/"
          className="mt-6 inline-block rounded-lg bg-festa-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-festa-700">
          Voltar ao início
        </Link>
      </main>
    );
  }

  const bloqueada = bloqueios.length > 0;

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <Link href="/minha-conta/editar"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-festa-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar
      </Link>

      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Excluir conta</h1>
      <p className="mb-6 text-sm text-slate-600">
        A exclusão é definitiva: não há como recuperar a conta nem criar outra com
        os mesmos dados de acesso.
      </p>

      {bloqueada ? (
        <div className="rounded-xl border border-atencao-200 bg-atencao-50 p-5">
          <p className="flex items-center gap-2 font-medium text-slate-900">
            <AlertTriangle className="h-5 w-5 text-atencao-600" aria-hidden="true" />
            Ainda não é possível excluir
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
            {bloqueios.map((bloqueio) => <li key={bloqueio}>{bloqueio}</li>)}
          </ul>
          <p className="mt-3 text-xs text-slate-600">
            Essas pendências existem para proteger quem contratou com você e o
            dinheiro em trânsito.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
            <p className="font-medium text-slate-900">O que acontece ao excluir</p>
            <ul className="mt-3 space-y-2 text-slate-700">
              <li>
                <span className="font-medium">São apagados: </span>
                nome, nome de usuário, e-mail, telefone, foto, localização
                {ehFornecedor
                  ? ', CPF ou CNPJ, razão social e redes sociais.'
                  : ', CPF e data de nascimento.'}
              </li>
              <li>
                <span className="font-medium">São preservados sem identificação: </span>
                o histórico de solicitações, pagamentos, cancelamentos e avaliações,
                por integridade dos registros e obrigação fiscal.
              </li>
              {ehFornecedor && (
                <li>
                  <span className="font-medium">Na vitrine e no histórico, </span>
                  seu nome de exibição passa a constar como “Fornecedor removido”.
                </li>
              )}
              <li>
                <span className="font-medium">O acesso é bloqueado </span>
                em caráter definitivo, sem possibilidade de reativação.
              </li>
            </ul>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <input type="checkbox" checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)} className="mt-1" />
            <span className="text-sm text-slate-700">
              Entendi que a exclusão é definitiva e que não poderei recuperar
              minha conta.
            </span>
          </label>

          <Campo label="Confirme sua senha" name="senha" type="password"
            value={senha} onChange={(e) => { setSenha(e.target.value); setErro(''); }}
            dica="Pedimos a senha porque esta ação não pode ser desfeita." />

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={excluir}
              disabled={processando || !confirmado || senha === ''}
              className="rounded-lg bg-perigo-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-perigo-700 disabled:opacity-50">
              {processando ? 'Excluindo...' : 'Excluir minha conta'}
            </button>
            <Link href="/minha-conta"
              className="rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50">
              Cancelar
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
