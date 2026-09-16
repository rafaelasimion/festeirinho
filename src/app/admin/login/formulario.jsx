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
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-festa-100">
            <ShieldCheck className="h-5 w-5 text-festa-600" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Painel administrativo</h1>
            <p className="text-sm text-slate-600">Acesso restrito à administração</p>
          </div>
        </div>

        <div className="space-y-4">
          <Campo label="E-mail" name="email" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} />

          <Campo label="Senha" name="senha" type="password" value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') entrar(); }} />

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <button type="button" onClick={entrar} disabled={entrando}
            className="w-full rounded-lg bg-festa-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
            {entrando ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </div>
    </main>
  );
}
