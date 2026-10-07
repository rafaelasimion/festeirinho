'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertTriangle, Check, X } from 'lucide-react';
import Etiqueta from '@/componentes/etiqueta';
import CartaoAdmin, { AcoesAdmin, ListaVazia } from '@/componentes/cartao-admin';
import { BotaoAcao } from '@/componentes/acoes-solicitacao';
import { CampoTexto } from '@/componentes/campo';
import { formatarPreco } from '@/lib/solicitacao';
import { descreverRecebimento, TIPOS_CHAVE_PIX } from '@/lib/recebimento';
import { formatarDataHora } from '@/lib/datas';
import AvisoPainel from '@/componentes/aviso-painel';

// Aba "Financeiro" do painel administrativo.
//
// Duas filas, na ordem em que o dinheiro anda:
//   1. dados de recebimento aguardando validação (UC 038)
//   2. transferências e estornos em processamento, esperando o gateway

export default function AbaFinanceiro({ dadosPendentes, processamentos }) {
  const router = useRouter();
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  async function executar(corpo, textoSucesso) {
    setErro('');
    setMensagem('');
    setProcessando(true);
    try {
      const resposta = await fetch('/api/admin/financeiro', {
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
        setErro(dados.erro ?? 'Não foi possível concluir a operação.');
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
    <div className="space-y-10">
      <AvisoPainel mensagem={mensagem} erro={erro} />

      <section>
        <h2 className="mb-1 text-base font-semibold text-slate-900">
          Dados de recebimento para validar
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          Confira se os dados pertencem ao titular da conta na plataforma antes de validar.
        </p>

        {dadosPendentes.length === 0 ? (
          <ListaVazia>Nenhum dado aguardando validação.</ListaVazia>
        ) : (
          <ul className="space-y-4">
            {dadosPendentes.map((d) => (
              <ItemValidacao key={d.id} dados={d} processando={processando}
                aoDecidir={(resultado, motivo) => executar(
                  { acao: 'validar_dados', id: d.id, resultado, motivo },
                  resultado === 'validado'
                    ? 'Dados validados. A transferência foi enviada ao gateway.'
                    : 'Dados rejeitados, com o motivo registrado.'
                )} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-base font-semibold text-slate-900">
          Em processamento no gateway
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          Simulação: informe o resultado que o gateway devolveria.
        </p>

        {processamentos.length === 0 ? (
          <ListaVazia>Nada em processamento.</ListaVazia>
        ) : (
          <ul className="space-y-4">
            {processamentos.map((p) => (
              <ItemProcessamento key={`${p.origem}-${p.id}`} item={p} processando={processando}
                aoConcluir={(resultado, motivo) => executar(
                  p.origem === 'saque'
                    ? { acao: 'concluir_saque', id: p.id, resultado, motivo }
                    : { acao: 'concluir_reembolso', id: p.id },
                  p.origem === 'saque'
                    ? resultado === 'concluido'
                      ? 'Saque concluído.'
                      : 'Saque recusado. O valor voltou ao saldo do fornecedor.'
                    : 'Reembolso concluído.'
                )} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ItemValidacao({ dados, processando, aoDecidir }) {
  const [rejeitando, setRejeitando] = useState(false);
  const [motivo, setMotivo] = useState('');

  // RN061 — os dados precisam pertencer ao titular. O painel já compara o
  // documento informado com o da conta, para a administração não ter de
  // conferir de cabeça.
  const documentoConfere = dados.cpf_cnpj_titular === dados.documento_conta;
  const rotuloChave = TIPOS_CHAVE_PIX.find((t) => t.valor === dados.tipo_chave_pix)?.rotulo;

  const rodape = rejeitando ? (
    <div className="space-y-3">
      <CampoTexto label="Motivo da rejeição" name={`motivo-dados-${dados.id}`}
        rows={3} value={motivo} minimo={10} maximo={500}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Explique o que está errado. O texto é exibido para quem enviou os dados." />
      <AcoesAdmin>
        <BotaoAcao tom="perigoCheio" Icone={X}
          disabled={processando || motivo.trim().length < 10 || motivo.trim().length > 500}
          onClick={() => aoDecidir('rejeitado', motivo)}>
          Confirmar rejeição
        </BotaoAcao>
        <BotaoAcao tom="discreto" onClick={() => { setRejeitando(false); setMotivo(''); }}>
          Voltar
        </BotaoAcao>
      </AcoesAdmin>
    </div>
  ) : (
    <AcoesAdmin>
      <BotaoAcao tom="principal" Icone={Check} disabled={processando}
        onClick={() => aoDecidir('validado')}>
        Validar
      </BotaoAcao>
      <BotaoAcao tom="perigo" Icone={X} disabled={processando}
        onClick={() => setRejeitando(true)}>
        Rejeitar
      </BotaoAcao>
    </AcoesAdmin>
  );

  return (
    <CartaoAdmin
      titulo={`${dados.origem === 'saque' ? 'Saque' : 'Reembolso'} de ${formatarPreco(dados.valor)}`}
      subtitulo={
        <>
          {dados.origem === 'saque' ? 'Fornecedor' : 'Cliente'}: {dados.nome_conta}
          <span className="mt-0.5 block text-xs text-slate-500">
            Enviado em {formatarDataHora(dados.data_envio)}
          </span>
        </>
      }
      etiqueta={<Etiqueta tom="atencao" formato="ponto">aguardando validação</Etiqueta>}
      rodape={rodape}
    >
      {/* RN061 — a conferência é lado a lado de propósito: o painel já
          comparou os documentos e a cor do segundo painel dá a resposta
          antes de a pessoa ler os números. */}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Destino informado
          </dt>
          <dd className="mt-1 text-slate-700">
            {dados.tipo_recebimento === 'pix'
              ? <>Pix · {rotuloChave}<br />{dados.chave_pix}</>
              : <>{descreverRecebimento(dados)}</>}
          </dd>
        </div>

        <div className={`rounded-xl border p-3.5 ${
          documentoConfere ? 'border-sucesso-200 bg-sucesso-50' : 'border-perigo-200 bg-perigo-50'}`}>
          <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {documentoConfere
              ? <CheckCircle2 className="h-4 w-4 text-sucesso-600" aria-hidden="true" />
              : <AlertTriangle className="h-4 w-4 text-perigo-600" aria-hidden="true" />}
            Titular {documentoConfere ? 'confere' : 'não confere'}
          </dt>
          <dd className="mt-1 text-slate-700">
            Informado: {dados.nome_titular} · {dados.cpf_cnpj_titular}<br />
            Na conta: {dados.nome_conta} · {dados.documento_conta}
          </dd>
        </div>
      </dl>
    </CartaoAdmin>
  );
}

function ItemProcessamento({ item, processando, aoConcluir }) {
  const [falhando, setFalhando] = useState(false);
  const [motivo, setMotivo] = useState('');

  const rodape = falhando ? (
    <div className="space-y-3">
      <CampoTexto label="Motivo da falha" name={`motivo-falha-${item.origem}-${item.id}`}
        rows={2} value={motivo} minimo={10} maximo={500}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo da falha informado pelo gateway." />
      <AcoesAdmin>
        <BotaoAcao tom="perigoCheio" Icone={X}
          disabled={processando || motivo.trim().length < 10 || motivo.trim().length > 500}
          onClick={() => aoConcluir('recusado', motivo)}>
          Registrar falha
        </BotaoAcao>
        <BotaoAcao tom="discreto" onClick={() => { setFalhando(false); setMotivo(''); }}>
          Voltar
        </BotaoAcao>
      </AcoesAdmin>
    </div>
  ) : (
    <AcoesAdmin>
      <BotaoAcao tom="sucesso" Icone={Check} disabled={processando}
        onClick={() => aoConcluir('concluido')}>
        {item.origem === 'saque' ? 'Transferência confirmada' : 'Estorno confirmado'}
      </BotaoAcao>
      {/* UC 037, fluxo 9a — só o saque tem caminho de falha documentado. */}
      {item.origem === 'saque' && (
        <BotaoAcao tom="perigo" Icone={X} disabled={processando}
          onClick={() => setFalhando(true)}>
          Transferência falhou
        </BotaoAcao>
      )}
    </AcoesAdmin>
  );

  return (
    <CartaoAdmin
      titulo={`${item.origem === 'saque' ? 'Transferência de saque' : 'Estorno de reembolso'} · ${formatarPreco(item.valor)}`}
      subtitulo={
        <>
          {item.nome_conta}
          {item.destino && (
            <span className="mt-0.5 block text-xs text-slate-500">{item.destino}</span>
          )}
        </>
      }
      etiqueta={<Etiqueta tom="atencao" formato="ponto">processando</Etiqueta>}
      rodape={rodape}
    >
      <p className="text-sm text-slate-600">
        Aguardando o retorno do gateway. Informe abaixo o resultado que ele devolveria.
      </p>
    </CartaoAdmin>
  );
}
