'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FormularioRecebimento from '@/componentes/formulario-recebimento';
import DestinoRecebimento from '@/componentes/destino-recebimento';
import { Bloco } from '@/componentes/bloco';
import { formatarPreco } from '@/lib/solicitacao';

// UC 036 — o cliente informa para onde o reembolso de um pagamento por
// boleto deve ir. Os quatro estados possíveis:
//   sem dados   → convite para informar
//   pendente    → aguardando a validação da administração (UC 038)
//   rejeitado   → motivo + reenvio (RN061)
//   validado    → reembolso seguiu para o gateway

export default function DadosReembolso({ idCancelamento, valor, titular, dados }) {
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

  const rejeitado = status === 'rejeitado';

  // O que mostrar dentro do cartão, conforme o estado. Sem caixas: o
  // cartão já é a moldura, e o estado se lê pelo fio colorido do bloco.
  let conteudo;
  if (status === 'pendente') {
    conteudo = (
      <Bloco tom="atencao" rotulo="Dados em validação">
        <DestinoRecebimento dados={dados} />
        <span className="mt-1.5 block text-xs text-slate-500">
          Assim que forem validados, o reembolso é enviado.
        </span>
      </Bloco>
    );
  } else if (status === 'validado') {
    conteudo = (
      <Bloco tom="sucesso" rotulo="Dados validados">
        <DestinoRecebimento dados={dados} />
      </Bloco>
    );
  } else if (aberto) {
    conteudo = (
      <FormularioRecebimento
        titular={titular}
        motivoRejeicao={rejeitado ? dados.motivo_rejeicao : null}
        rotuloBotao={rejeitado ? 'Reenviar dados' : 'Enviar dados'}
        processando={processando}
        erroServidor={erroServidor}
        aoVoltar={() => setAberto(false)}
        aoEnviar={(dadosRecebimento) => enviar(rejeitado ? 'PUT' : 'POST', dadosRecebimento)} />
    );
  } else {
    conteudo = (
      <div className="space-y-3">
        {rejeitado ? (
          <Bloco tom="perigo" rotulo="Dados rejeitados">{dados.motivo_rejeicao}</Bloco>
        ) : (
          <p className="text-sm text-slate-700">
            Como o pagamento foi por boleto, informe para onde enviar o reembolso.
          </p>
        )}
        <button type="button" onClick={() => setAberto(true)}
          className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700">
          {rejeitado ? 'Corrigir dados' : 'Informar dados'}
        </button>
      </div>
    );
  }

  // Cartão próprio, abaixo do resumo da solicitação, e não dentro do
  // quadro do cancelamento. Lá dentro, o formulário virava uma caixa dentro
  // de outra caixa dentro do cartão, e o cartão crescia tanto que a foto
  // do serviço, que acompanha a altura dele, esticava junto (CT-80).
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900">
        Reembolso de {formatarPreco(valor)}
      </h2>
      <div className="mt-3">{conteudo}</div>
    </section>
  );
}
