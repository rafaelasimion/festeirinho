'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import Campo from '@/componentes/campo';
import Etiqueta from '@/componentes/etiqueta';
import FormularioRecebimento from '@/componentes/formulario-recebimento';
import { formatarPreco } from '@/lib/solicitacao';
import {
  ROTULO_STATUS_SAQUE,
  TOM_STATUS_SAQUE,
  ROTULO_STATUS_VALIDACAO,
  descreverRecebimento,
} from '@/lib/recebimento';

function formatarDataHora(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Saques({ saldoDisponivel, valorMinimoSaque, titular, saques }) {
  const router = useRouter();
  const [etapa, setEtapa] = useState(null); // null | 'valor' | 'dados'
  const [valor, setValor] = useState('');
  const [erroValor, setErroValor] = useState('');
  const [reenviando, setReenviando] = useState(null); // id do saque
  const [processando, setProcessando] = useState(false);
  const [erroServidor, setErroServidor] = useState('');
  const [mensagem, setMensagem] = useState('');

  const podeSacar = saldoDisponivel >= valorMinimoSaque;

  // UC 037, etapa 3 e fluxo 3a — o valor é conferido antes de pedir os dados.
  function avancarParaDados() {
    const numero = Math.round(Number(String(valor).replace(',', '.')) * 100) / 100;
    if (!Number.isFinite(numero) || numero <= 0) {
      setErroValor('Informe o valor do saque.');
      return;
    }
    if (numero < valorMinimoSaque) {
      setErroValor(`O valor mínimo de saque é ${formatarPreco(valorMinimoSaque)}.`);
      return;
    }
    if (numero > saldoDisponivel) {
      setErroValor(`O valor excede o saldo disponível de ${formatarPreco(saldoDisponivel)}.`);
      return;
    }
    setErroValor('');
    setEtapa('dados');
  }

  async function enviar(metodo, corpo, textoSucesso) {
    setErroServidor('');
    setMensagem('');
    setProcessando(true);

    try {
      const resposta = await fetch('/api/fornecedor/saques', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErroServidor(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (!resposta.ok) {
        // Erros por campo vêm num objeto; mostro o primeiro, que é o que a
        // pessoa precisa corrigir agora.
        const primeiro = dados.erros ? Object.values(dados.erros)[0] : null;
        setErroServidor(primeiro ?? dados.erro ?? 'Não foi possível concluir a operação.');
        return;
      }

      setEtapa(null);
      setValor('');
      setReenviando(null);
      setMensagem(textoSucesso);
      router.refresh();
    } catch {
      setErroServidor('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-slate-900">Saques</h2>
        {etapa === null && (
          <button type="button" disabled={!podeSacar}
            onClick={() => { setEtapa('valor'); setErroServidor(''); setMensagem(''); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:cursor-not-allowed disabled:opacity-50">
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            Solicitar saque
          </button>
        )}
      </div>

      {mensagem && <p className="mb-4 text-sm text-sucesso-700">{mensagem}</p>}

      {etapa === 'valor' && (
        <div className="mb-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">
            Saldo disponível: <span className="font-semibold text-slate-900">
              {formatarPreco(saldoDisponivel)}
            </span>. Mínimo por saque: {formatarPreco(valorMinimoSaque)}.
          </p>
          <Campo label="Valor do saque (R$)" name="valorSaque" type="number"
            step="0.01" min={valorMinimoSaque} max={saldoDisponivel}
            value={valor} onChange={(e) => { setValor(e.target.value); setErroValor(''); }}
            erro={erroValor} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setValor(String(saldoDisponivel))}
              className="rounded-lg border border-festa-600 px-4 py-2 text-sm font-medium text-festa-700 transition-colors hover:bg-festa-50">
              Sacar tudo
            </button>
            <button type="button" onClick={avancarParaDados}
              className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700">
              Continuar
            </button>
            <button type="button" onClick={() => setEtapa(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
              Voltar
            </button>
          </div>
        </div>
      )}

      {etapa === 'dados' && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-4 text-sm text-slate-600">
            Saque de <span className="font-semibold text-slate-900">
              {formatarPreco(Number(String(valor).replace(',', '.')))}
            </span>. Informe para onde transferir.
          </p>
          <FormularioRecebimento
            titular={titular}
            rotuloBotao="Confirmar saque"
            processando={processando}
            erroServidor={erroServidor}
            aoVoltar={() => setEtapa('valor')}
            aoEnviar={(dados) => enviar(
              'POST',
              { valor: Number(String(valor).replace(',', '.')), dados },
              'Saque solicitado. O valor foi reservado e os dados seguem para validação.'
            )} />
        </div>
      )}

      {saques.length === 0 ? (
        <p className="text-sm text-slate-600">Nenhum saque solicitado ainda.</p>
      ) : (
        <ul className="space-y-3">
          {saques.map((s) => {
            const rejeitado = s.status === 'pendente' && s.status_validacao === 'rejeitado';

            return (
              <li key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{formatarPreco(s.valor)}</p>
                    <p className="text-sm text-slate-600">{descreverRecebimento(s)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Solicitado em {formatarDataHora(s.data_solicitacao)}
                      {s.data_processamento && ` · concluído em ${formatarDataHora(s.data_processamento)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Etiqueta tom={TOM_STATUS_SAQUE[s.status]}>
                      {ROTULO_STATUS_SAQUE[s.status]}
                    </Etiqueta>
                    {s.status === 'pendente' && s.status_validacao && (
                      <span className="text-xs text-slate-500">
                        Dados: {ROTULO_STATUS_VALIDACAO[s.status_validacao].toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>

                {s.status === 'recusado' && s.motivo_recusa && (
                  <p className="mt-3 rounded-lg border border-perigo-200 bg-perigo-50 p-2 text-sm text-slate-700">
                    A transferência falhou: {s.motivo_recusa} O valor voltou ao seu saldo.
                  </p>
                )}

                {/* RN061 — rejeição dos dados: o saque segue pendente, com o
                    valor reservado, até o reenvio. */}
                {rejeitado && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    {reenviando === s.id ? (
                      <FormularioRecebimento
                        titular={titular}
                        motivoRejeicao={s.motivo_rejeicao}
                        rotuloBotao="Reenviar dados"
                        processando={processando}
                        erroServidor={erroServidor}
                        aoVoltar={() => setReenviando(null)}
                        aoEnviar={(dados) => enviar(
                          'PUT',
                          { idSaque: s.id, dados },
                          'Dados reenviados. Eles voltam para validação.'
                        )} />
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-perigo-700">
                          Dados rejeitados: {s.motivo_rejeicao}
                        </p>
                        <button type="button"
                          onClick={() => { setReenviando(s.id); setErroServidor(''); }}
                          className="shrink-0 rounded-lg border border-festa-600 px-4 py-2 text-sm font-medium text-festa-700 transition-colors hover:bg-festa-50">
                          Corrigir dados
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
