'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import Campo from '@/componentes/campo';

export default function FormularioLoginAdmin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function entrar() {
    setErro('');
    setEntrando(true);

    try {
      const resposta = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (resposta.ok) {
        router.push('/admin');
        router.refresh();
        return;
      }

      setErro(dados.erro ?? 'Não foi possível entrar.');
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setEntrando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {/* O selo centralizado, e não numa linha com o título: esta tela não
            faz parte do fluxo de ninguém que use a plataforma, e o escudo
            centrado avisa disso antes de a pessoa ler qualquer palavra. */}
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-festa-100">
            <ShieldCheck className="h-7 w-7 text-festa-600" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Painel administrativo</h1>
          <p className="mt-1 text-sm text-slate-600">Acesso restrito à administração</p>
        </div>

        <div className="mt-8 space-y-5">
          <Campo label="E-mail" name="email" type="email" value={email}
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)} />

          <Campo label="Senha" name="senha" type="password" value={senha}
            autoComplete="current-password"
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') entrar(); }} />

          {erro && (
            <p className="rounded-xl bg-perigo-50 px-4 py-3 text-sm text-perigo-700">{erro}</p>
          )}

          <button type="button" onClick={entrar} disabled={entrando}
            className="w-full rounded-xl bg-festa-600 px-4 py-3.5 font-semibold text-white transition-colors hover:bg-festa-700 disabled:cursor-not-allowed disabled:opacity-50">
            {entrando ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </div>
    </main>
  );
}
