'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FormularioRecebimento from '@/componentes/formulario-recebimento';
import { descreverRecebimento } from '@/lib/recebimento';

// UC 036 — o cliente informa para onde o reembolso de um pagamento por
// boleto deve ir. Os quatro estados possíveis:
//   sem dados   → convite para informar
//   pendente    → aguardando a validação da administração (UC 038)
//   rejeitado   → motivo + reenvio (RN061)
//   validado    → reembolso seguiu para o gateway

export default function DadosReembolso({ idCancelamento, titular, dados }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erroServidor, setErroServidor] = useState('');

  const status = dados?.status_validacao ?? null;

  async function enviar(metodo, dadosRecebimento) {
    setErroServidor('');
    setProcessando(true);
    try {
      const resposta = await fetch('/api/reembolsos', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idCancelamento, dados: dadosRecebimento }),
      });

      let retorno;
      try {
        retorno = await resposta.json();
      } catch {
        setErroServidor(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (!resposta.ok) {
        const primeiro = retorno.erros ? Object.values(retorno.erros)[0] : null;
        setErroServidor(primeiro ?? retorno.erro ?? 'Não foi possível enviar os dados.');
        return;
      }

      setAberto(false);
      router.refresh();
    } catch {
      setErroServidor('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  if (status === 'pendente') {
    return (
      <div className="mt-3 rounded-lg border border-atencao-200 bg-atencao-50 p-3 text-sm text-slate-700">
        <p className="font-medium text-slate-800">Dados de recebimento em validação</p>
        <p className="mt-0.5">{descreverRecebimento(dados)}</p>
        <p className="mt-1 text-xs text-slate-500">
          Assim que forem validados, o reembolso é enviado.
        </p>
      </div>
    );
  }

  if (status === 'validado') {
    return (
      <div className="mt-3 rounded-lg border border-sucesso-200 bg-sucesso-50 p-3 text-sm text-slate-700">
        <p className="font-medium text-slate-800">Dados validados</p>
        <p className="mt-0.5">{descreverRecebimento(dados)}</p>
      </div>
    );
  }

  const rejeitado = status === 'rejeitado';

  if (aberto) {
    return (
      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
        <FormularioRecebimento
          titular={titular}
          motivoRejeicao={rejeitado ? dados.motivo_rejeicao : null}
          rotuloBotao={rejeitado ? 'Reenviar dados' : 'Enviar dados'}
          processando={processando}
          erroServidor={erroServidor}
          aoVoltar={() => setAberto(false)}
          aoEnviar={(dadosRecebimento) => enviar(rejeitado ? 'PUT' : 'POST', dadosRecebimento)} />
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-atencao-200 bg-atencao-50 p-3 text-sm">
      <p className="text-slate-700">
        {rejeitado
          ? <>Os dados foram rejeitados: {dados.motivo_rejeicao}</>
          : <>Como o pagamento foi por boleto, informe para onde enviar o reembolso.</>}
      </p>
      <button type="button" onClick={() => setAberto(true)}
        className="shrink-0 rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700">
        {rejeitado ? 'Corrigir dados' : 'Informar dados'}
      </button>
    </div>
  );
}
