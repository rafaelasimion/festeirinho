'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, Star, EyeOff } from 'lucide-react';
import Etiqueta from '@/componentes/etiqueta';
import {
  ROTULO_MOTIVO,
  ROTULO_RESULTADO_DENUNCIA,
  TOM_RESULTADO_DENUNCIA,
} from '@/lib/denuncia';

// RF068 / UC 026 — análise das denúncias.

function formatarDataHora(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AbaDenuncias({ denuncias }) {
  const router = useRouter();
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const pendentes = denuncias.filter((d) => d.status_denuncia === 'pendente');

  async function analisar(corpo, textoSucesso) {
    setErro('');
    setMensagem('');
    setProcessando(true);
    try {
      const resposta = await fetch('/api/admin/denuncias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return false;
      }
      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não foi possível registrar a análise.');
        return false;
      }

      setMensagem(textoSucesso);
      router.refresh();
      return true;
    } catch {
      setErro('Falha de conexão. Tente novamente.');
      return false;
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        A denúncia é disciplinar: não gera reembolso, não bloqueia repasse e não
        suspende conta por si só. Se o caso justificar suspensão, ela é registrada
        na aba Contas.
      </p>

      {pendentes.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-atencao-50 p-3 text-sm text-slate-700">
          <Flag className="h-4 w-4 shrink-0 text-atencao-600" aria-hidden="true" />
          {pendentes.length === 1
            ? '1 denúncia aguardando análise.'
            : `${pendentes.length} denúncias aguardando análise.`}
        </p>
      )}

      {mensagem && <p className="text-sm text-sucesso-700">{mensagem}</p>}
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {denuncias.length === 0 ? (
        <p className="text-sm text-slate-600">Nenhuma denúncia registrada.</p>
      ) : (
        <ul className="space-y-4">
          {denuncias.map((denuncia) => (
            <ItemDenuncia key={`${denuncia.id}-${denuncia.status_denuncia}`}
              denuncia={denuncia} processando={processando} aoAnalisar={analisar} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemDenuncia({ denuncia, processando, aoAnalisar }) {
  const [decidindo, setDecidindo] = useState(null); // 'procedente' | 'improcedente'
  const [justificativa, setJustificativa] = useState('');
  const [ocultar, setOcultar] = useState(false);
  const [motivoOcultacao, setMotivoOcultacao] = useState('');

  const pendente = denuncia.status_denuncia === 'pendente';
  const ehDeAvaliacao = denuncia.tipo_denuncia === 'avaliacao';
  // RN045 — só há o que moderar enquanto o comentário estiver visível.
  const podeOcultar = ehDeAvaliacao
    && denuncia.comentario
    && denuncia.origem_ocultacao !== 'moderacao';

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-medium text-slate-900">
            {ehDeAvaliacao ? 'Comentário denunciado' : 'Fornecedor denunciado'}
          </h2>
          <p className="text-sm text-slate-600">
            {denuncia.servico} · {denuncia.fornecedor}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Denunciado por {ehDeAvaliacao ? denuncia.fornecedor : denuncia.cliente} em{' '}
            {formatarDataHora(denuncia.data_denuncia)}
          </p>
        </div>

        {pendente ? (
          <Etiqueta tom="atencao" contorno>pendente de análise</Etiqueta>
        ) : (
          <Etiqueta tom={TOM_RESULTADO_DENUNCIA[denuncia.resultado_analise]}>
            {ROTULO_RESULTADO_DENUNCIA[denuncia.resultado_analise]}
          </Etiqueta>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-perigo-200 bg-perigo-50 p-3 text-sm">
        <p className="font-medium text-slate-800">
          {ROTULO_MOTIVO[denuncia.motivo_padrao]}
        </p>
        <p className="mt-1 whitespace-pre-line text-slate-700">{denuncia.motivo}</p>
      </div>

      {/* O conteúdo denunciado, para a análise não depender de memória. */}
      {ehDeAvaliacao && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex" aria-label={`Nota ${denuncia.nota} de 5`}>
              {[1, 2, 3, 4, 5].map((posicao) => (
                <Star key={posicao} aria-hidden="true"
                  className={`h-4 w-4 ${posicao <= denuncia.nota
                    ? 'fill-atencao-600 text-atencao-600'
                    : 'text-slate-300'}`} />
              ))}
            </span>
            <span className="text-slate-600">Avaliação de {denuncia.cliente}</span>
            {denuncia.origem_ocultacao === 'moderacao' && (
              <Etiqueta tom="perigo" contorno>já removido</Etiqueta>
            )}
          </div>
          <p className="mt-2 whitespace-pre-line text-slate-700">{denuncia.comentario}</p>
        </div>
      )}

      {!pendente && (
        <div className="mt-3 rounded-lg border border-slate-200 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Justificativa · {formatarDataHora(denuncia.data_analise)}
          </p>
          <p className="mt-1 whitespace-pre-line text-slate-700">
            {denuncia.justificativa_analise}
          </p>
        </div>
      )}

      <div className="mt-4 border-t border-slate-200 pt-4">
        {!pendente ? (
          <p className="text-sm text-slate-600">
            Denúncia analisada. A decisão foi comunicada a quem denunciou.
          </p>
        ) : decidindo ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Justificativa da decisão
              </label>
              <textarea rows={3} value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="O texto é exibido a quem denunciou."
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
              <p className="mt-1 text-xs text-slate-500">
                {justificativa.trim().length}/20 caracteres mínimos.
              </p>
            </div>

            {/* UC 026 — a remoção do comentário é decisão separada. Uma
                avaliação negativa porém legítima é julgada improcedente e
                permanece no ar (RN045). */}
            {decidindo === 'procedente' && podeOcultar && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input type="checkbox" checked={ocultar}
                    onChange={(e) => setOcultar(e.target.checked)} className="mt-1" />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                      <EyeOff className="h-4 w-4 text-slate-600" aria-hidden="true" />
                      Remover o comentário da vitrine
                    </span>
                    <span className="block text-xs text-slate-500">
                      A nota continua contando na média do serviço; só o texto deixa de
                      aparecer.
                    </span>
                  </span>
                </label>

                {ocultar && (
                  <div className="mt-3">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Motivo da remoção
                    </label>
                    <textarea rows={2} value={motivoOcultacao}
                      onChange={(e) => setMotivoOcultacao(e.target.value)}
                      placeholder="Fica registrado e é informado a quem escreveu."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
                    <p className="mt-1 text-xs text-slate-500">
                      {motivoOcultacao.trim().length}/10 caracteres mínimos.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button"
                disabled={processando
                  || justificativa.trim().length < 20
                  || (ocultar && motivoOcultacao.trim().length < 10)}
                onClick={async () => {
                  const certo = await aoAnalisar({
                    id: denuncia.id,
                    resultado: decidindo,
                    justificativa,
                    ocultarComentario: decidindo === 'procedente' && ocultar,
                    motivoOcultacao,
                  }, decidindo === 'procedente' && ocultar
                    ? 'Denúncia procedente e comentário removido da vitrine.'
                    : `Denúncia julgada ${decidindo}.`);
                  if (certo) {
                    setDecidindo(null);
                    setJustificativa('');
                    setOcultar(false);
                    setMotivoOcultacao('');
                  }
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                  decidindo === 'procedente'
                    ? 'bg-perigo-600 hover:bg-perigo-700'
                    : 'bg-festa-600 hover:bg-festa-700'}`}>
                Confirmar decisão
              </button>
              <button type="button"
                onClick={() => { setDecidindo(null); setOcultar(false); }}
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
              className="rounded-lg border border-perigo-600 px-4 py-2 text-sm font-medium text-perigo-700 transition-colors hover:bg-perigo-50 disabled:opacity-50">
              Julgar procedente
            </button>
            <button type="button" disabled={processando}
              onClick={() => { setDecidindo('improcedente'); setJustificativa(''); }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50">
              Julgar improcedente
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
