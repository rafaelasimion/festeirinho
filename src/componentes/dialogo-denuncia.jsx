'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { motivosDoTipo } from '@/lib/denuncia';

// RF067 / RN052 — formulário de denúncia, comum aos dois tipos.
//
// O tipo não é enviado ao servidor: ele decide pelo papel de quem está
// logado. A propriedade aqui serve só para mostrar os motivos certos.

export default function DialogoDenuncia({ tipo, alvo, aoConcluir, aoVoltar }) {
  const [motivoPadrao, setMotivoPadrao] = useState('');
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const motivos = motivosDoTipo(tipo);

  async function enviar() {
    setErro('');
    setEnviando(true);
    try {
      const resposta = await fetch('/api/denuncias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...alvo, motivoPadrao, descricao }),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }
      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não foi possível registrar a denúncia.');
        return;
      }

      aoConcluir();
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-perigo-200 bg-perigo-50 p-4">
      <div className="flex items-start gap-3">
        <Flag className="mt-0.5 h-5 w-5 shrink-0 text-perigo-600" aria-hidden="true" />
        <div>
          <p className="font-medium text-slate-900">
            {tipo === 'avaliacao' ? 'Denunciar este comentário' : 'Denunciar este fornecedor'}
          </p>
          <p className="mt-0.5 text-sm text-slate-600">
            {tipo === 'avaliacao'
              ? 'A administração analisa o conteúdo. Críticas negativas ao serviço não são removidas — só conteúdo inadequado.'
              : 'A administração analisa a denúncia. Ela não gera reembolso nem altera o andamento da contratação.'}
          </p>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">Motivo</legend>
        {motivos.map(({ valor, rotulo, detalhe }) => (
          <label key={valor}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
              motivoPadrao === valor
                ? 'border-perigo-600 bg-white'
                : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <input type="radio" name="motivo-denuncia" value={valor}
              checked={motivoPadrao === valor}
              onChange={(e) => setMotivoPadrao(e.target.value)}
              className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium text-slate-800">{rotulo}</span>
              <span className="block text-xs text-slate-500">{detalhe}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div>
        <label htmlFor="descricao-denuncia"
          className="mb-1.5 block text-sm font-medium text-slate-700">
          Descreva o ocorrido
        </label>
        <textarea id="descricao-denuncia" rows={4} value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Conte os detalhes. A administração usará este texto para decidir."
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
        <p className="mt-1 text-xs text-slate-500">
          {descricao.trim().length}/20 caracteres mínimos.
        </p>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={enviar}
          disabled={enviando || motivoPadrao === '' || descricao.trim().length < 20}
          className="rounded-lg bg-perigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-perigo-700 disabled:opacity-50">
          {enviando ? 'Enviando...' : 'Enviar denúncia'}
        </button>
        <button type="button" onClick={aoVoltar} disabled={enviando}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
          Voltar
        </button>
      </div>
    </div>
  );
}
