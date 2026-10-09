'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Campo from '@/componentes/campo';
import { AVISO_NOVA_VERIFICACAO } from '@/lib/fornecedor';

// UC 045, fluxo 1a — editar os dados da vitrine.
//
// Era um painel que abria no fim da vitrine, ao clicar no lápis do topo.
// Clicando lá em cima, o formulário nascia fora da vista, lá embaixo, e
// nada na tela dizia que ele estava ali: a reação natural era clicar no
// lápis de novo, o que o fechava. Página própria resolve — o clique leva a
// uma tela que é só o formulário, e salvar ou cancelar volta para a
// vitrine.

export default function FormularioVitrine({ fornecedor }) {
  const router = useRouter();
  const [campos, setCampos] = useState({
    nomeExibicao: fornecedor.nomeExibicao ?? '',
    descricao: fornecedor.descricao ?? '',
    whatsappUrl: fornecedor.whatsappUrl ?? '',
    instagramUrl: fornecedor.instagramUrl ?? '',
    site: fornecedor.site ?? '',
  });
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [salvando, setSalvando] = useState(false);

  function aoDigitar(evento) {
    const { name, value } = evento.target;
    setCampos((anterior) => ({ ...anterior, [name]: value }));
    setErros((anterior) => ({ ...anterior, [name]: undefined }));
  }

  async function salvar() {
    setErroGeral('');
    setErros({});
    setSalvando(true);

    try {
      const resposta = await fetch('/api/fornecedor/vitrine', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErroGeral(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (!resposta.ok) {
        if (dados.erros) setErros(dados.erros);
        else setErroGeral(dados.erro ?? 'Não foi possível salvar.');
        return;
      }

      // De volta à vitrine, com os dados novos: o push troca de tela e o
      // refresh descarta o cache do servidor, senão a vitrine reaparece
      // mostrando exatamente o que acabou de ser alterado.
      router.push(`/fornecedores/${fornecedor.id}`);
      router.refresh();
    } catch {
      setErroGeral('Falha de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href={`/fornecedores/${fornecedor.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-festa-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Minha vitrine
      </Link>

      <h1 className="text-2xl font-semibold text-slate-900">Dados da vitrine</h1>
      <p className="mt-1 text-sm text-slate-600">
        É o que o cliente vê no topo da sua vitrine.
      </p>

      {/* UC 045, fluxo 1a.3 — o aviso vem ANTES de salvar, não depois.
          Perder o selo de verificado não pode virar surpresa. */}
      {fornecedor.statusVerificacao === 'aprovado' && (
        <p className="mt-3 rounded-lg bg-atencao-50 p-3 text-sm text-atencao-800">
          {AVISO_NOVA_VERIFICACAO}
        </p>
      )}

      <div className="mt-4 space-y-4">
        <Campo label="Nome de exibição" name="nomeExibicao" value={campos.nomeExibicao}
          onChange={aoDigitar} erro={erros.nomeExibicao} placeholder="Nome do negócio" />

        <div>
          <label htmlFor="descricao" className="mb-1.5 block text-sm font-medium text-slate-700">
            Descrição
          </label>
          <textarea id="descricao" name="descricao" rows={4} value={campos.descricao}
            onChange={aoDigitar}
            placeholder="Um pouco sobre o negócio, especialidades e diferenciais..."
            className="w-full rounded-xl border border-festa-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/25" />
          {erros.descricao && (
            <p className="mt-1 text-sm text-perigo-600">{erros.descricao}</p>
          )}
        </div>

        <Campo label="WhatsApp" name="whatsappUrl" value={campos.whatsappUrl}
          onChange={aoDigitar} erro={erros.whatsappUrl}
          placeholder="wa.me/5516999998888" />

        <Campo label="Instagram" name="instagramUrl" value={campos.instagramUrl}
          onChange={aoDigitar} erro={erros.instagramUrl}
          placeholder="instagram.com/perfil" />

        <Campo label="Site" name="site" value={campos.site}
          onChange={aoDigitar} erro={erros.site} placeholder="site.com.br" />

        {erroGeral && (
          <p className="rounded-xl bg-perigo-50 px-4 py-3 text-sm text-perigo-700">
            {erroGeral}
          </p>
        )}

        <button type="button" onClick={salvar} disabled={salvando}
          className="w-full rounded-xl bg-festa-600 px-4 py-3.5 font-semibold text-white transition-colors hover:bg-festa-700 disabled:cursor-not-allowed disabled:opacity-50">
          {salvando ? 'Salvando...' : 'Salvar alterações'}
        </button>

        <Link href={`/fornecedores/${fornecedor.id}`}
          className="block w-full rounded-xl border border-festa-600 px-4 py-3.5 text-center font-semibold text-festa-700 transition-colors hover:bg-festa-50">
          Cancelar
        </Link>
      </div>
    </main>
  );
}
