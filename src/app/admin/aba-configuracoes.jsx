'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info } from 'lucide-react';
import {
  GRUPOS,
  PARAMETROS,
  validarParametro,
  validarConsistencia,
  antecedenciaMinimaDias,
  formatarValorParametro,
} from '@/lib/parametros';

// UC 028 — painel de configurações.
//
// Cada parâmetro é alterado individualmente e confirmado (passos 3 e 4). A
// tela confere faixa e consistência antes de enviar; o servidor confere de
// novo, com as mesmas funções.

function formatarData(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AbaConfiguracoes({ configuracoes }) {
  const router = useRouter();
  const [editando, setEditando] = useState(null);
  const [valorNovo, setValorNovo] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [aviso, setAviso] = useState('');
  const [processando, setProcessando] = useState(false);

  const valores = Object.fromEntries(configuracoes.map((c) => [c.chave, c.valor]));
  const porChave = Object.fromEntries(configuracoes.map((c) => [c.chave, c]));

  function abrir(chave) {
    setEditando(chave);
    setValorNovo(String(valores[chave]));
    setErro('');
    setMensagem('');
    setAviso('');
  }

  async function salvar(chave) {
    const numero = Number(String(valorNovo).replace(',', '.'));

    const erroValor = validarParametro(chave, numero);
    if (erroValor) {
      setErro(erroValor);
      return;
    }
    const inconsistencia = validarConsistencia({ ...valores, [chave]: numero });
    if (inconsistencia) {
      setErro(inconsistencia);
      return;
    }

    setErro('');
    setProcessando(true);
    try {
      const resposta = await fetch('/api/admin/configuracoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave, valor: numero }),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não foi possível salvar a alteração.');
        return;
      }

      setEditando(null);
      setMensagem(`${PARAMETROS[chave].rotulo}: alterado para ${formatarValorParametro(chave, numero)}.`);

      if (dados.impacto) {
        const { minimoAnterior, minimoNovo, servicosAbaixoDoMinimo } = dados.impacto;
        setAviso(
          `A antecedência mínima dos serviços passou de ${minimoAnterior} para ${minimoNovo} dias.` +
          (servicosAbaixoDoMinimo > 0
            ? ` ${servicosAbaixoDoMinimo} serviço(s) ativo(s) estão abaixo do novo mínimo e precisarão ser ajustados na próxima edição.`
            : '')
        );
      }

      router.refresh();
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex gap-3 rounded-lg border border-festa-200 bg-festa-50 p-4 text-sm text-slate-700">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-festa-600" aria-hidden="true" />
        <div>
          <p>
            As alterações valem para as próximas operações. Comissão e multas já
            congeladas em pagamentos existentes não mudam (RN027).
          </p>
          <p className="mt-1">
            Antecedência mínima atual dos serviços:{' '}
            <span className="font-semibold text-festa-800">
              {antecedenciaMinimaDias(valores)} dias
            </span>
            {' '}— calculada a partir dos prazos de resposta e de pagamento (RN046).
          </p>
        </div>
      </div>

      {mensagem && <p className="text-sm text-sucesso-700">{mensagem}</p>}
      {aviso && <p className="text-sm text-atencao-700">{aviso}</p>}

      {GRUPOS.map((grupo) => {
        const chaves = Object.keys(PARAMETROS).filter(
          (chave) => PARAMETROS[chave].grupo === grupo.id && porChave[chave]
        );
        if (chaves.length === 0) return null;

        return (
          <section key={grupo.id}>
            <h2 className="mb-3 text-base font-medium text-slate-900">{grupo.titulo}</h2>
            <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {chaves.map((chave) => {
                const definicao = PARAMETROS[chave];
                const registro = porChave[chave];
                const emEdicao = editando === chave;

                return (
                  <li key={chave} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">
                          {definicao.rotulo}
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            {definicao.regra}
                          </span>
                        </p>
                        <p className="text-sm text-slate-600">{registro.descricao}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Alterado em {formatarData(registro.data_alteracao)}
                        </p>
                      </div>

                      {!emEdicao && (
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-lg font-semibold text-slate-900">
                            {formatarValorParametro(chave, registro.valor)}
                          </span>
                          <button type="button" onClick={() => abrir(chave)}
                            disabled={processando}
                            className="rounded-lg px-3 py-1.5 text-sm font-medium text-festa-700 transition-colors hover:bg-festa-50">
                            Alterar
                          </button>
                        </div>
                      )}
                    </div>

                    {emEdicao && (
                      <div className="mt-3 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <input type="number" value={valorNovo}
                            step={definicao.inteiro ? 1 : 0.01}
                            min={definicao.min} max={definicao.max}
                            onChange={(e) => { setValorNovo(e.target.value); setErro(''); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') salvar(chave); }}
                            aria-label={definicao.rotulo}
                            className="w-40 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-slate-900 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
                          <span className="text-sm text-slate-600">{definicao.unidade}</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Faixa aceita: {definicao.min} a {definicao.max} {definicao.unidade}.
                        </p>
                        {erro && <p className="text-sm text-red-600">{erro}</p>}
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => salvar(chave)} disabled={processando}
                            className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
                            {processando ? 'Salvando...' : 'Confirmar alteração'}
                          </button>
                          <button type="button" onClick={() => { setEditando(null); setErro(''); }}
                            disabled={processando}
                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
