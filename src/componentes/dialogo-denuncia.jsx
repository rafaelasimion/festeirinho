'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { motivosDoTipo } from '@/lib/denuncia';
import TituloPainel from '@/componentes/titulo-painel';
import OpcoesRadio from '@/componentes/opcoes-radio';

// RF067 / RN052 — formulário de denúncia, comum aos dois tipos.
//
// O tipo não é enviado ao servidor: ele decide pelo papel de quem está
// logado. A propriedade aqui serve só para mostrar os motivos certos.
//
// O formulário fica direto no cartão do painel, sem caixa colorida em volta:
// quem diz o assunto é o TituloPainel.

const MINIMO_DESCRICAO = 20;

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
    <div className="space-y-5">
      <TituloPainel icone={Flag} tom="perigo"
        titulo={tipo === 'avaliacao' ? 'Denunciar este comentário' : 'Denunciar este fornecedor'}>
        {tipo === 'avaliacao'
          ? 'A administração analisa o conteúdo. Críticas negativas ao serviço não são removidas — só conteúdo inadequado.'
          : 'A administração analisa a denúncia. Ela não gera reembolso nem altera o andamento da contratação.'}
      </TituloPainel>

      <OpcoesRadio nome="motivo-denuncia" legenda="Motivo" tom="perigo"
        opcoes={motivos} valor={motivoPadrao} aoEscolher={setMotivoPadrao}
        desabilitado={enviando} />

      <div>
        <label htmlFor="descricao-denuncia"
          className="mb-1.5 block text-sm font-medium text-slate-700">
          Descreva o ocorrido
        </label>
        <textarea id="descricao-denuncia" rows={4} value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Conte os detalhes. A administração usará este texto para decidir."
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
        {/* O contador só fala enquanto falta texto. */}
        {descricao.trim().length < MINIMO_DESCRICAO && (
          <p className="mt-1 text-xs text-slate-500">
            Mínimo de {MINIMO_DESCRICAO} caracteres ({descricao.trim().length} até agora).
          </p>
        )}
      </div>

      {erro && <p className="text-sm text-perigo-600">{erro}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={enviar}
          disabled={enviando || motivoPadrao === '' || descricao.trim().length < MINIMO_DESCRICAO}
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
