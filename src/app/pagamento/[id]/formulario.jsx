'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatarPreco } from '@/lib/solicitacao';

function formatarDataHora(valor) {
  return new Date(valor).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function FormularioPagamento({
  pagamento,
  boletoDisponivel,
  diasMinimosBoleto,
}) {
  const router = useRouter();
  const [forma, setForma] = useState('pix');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  if (pagamento.status === 'pago') {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="mb-2 text-2xl font-semibold">Pagamento confirmado</h1>
        <p className="mb-6 text-sm text-gray-600">
          Sua contratação de {pagamento.servico} com {pagamento.fornecedor} está confirmada.
        </p>
        <dl className="space-y-2 rounded-lg border border-gray-300 p-4 text-sm">
          <div><dt className="inline font-medium">Valor: </dt>
            <dd className="inline">{formatarPreco(pagamento.valorBruto)}</dd></div>
          <div><dt className="inline font-medium">Forma: </dt>
            <dd className="inline">{pagamento.formaPagamento === 'pix' ? 'Pix' : 'Boleto'}</dd></div>
          <div><dt className="inline font-medium">Identificador: </dt>
            <dd className="inline">{pagamento.idTransacao}</dd></div>
        </dl>
        <Link href="/minhas-solicitacoes"
          className="mt-6 inline-flex items-center rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700">
          Ver minhas solicitações
        </Link>
      </main>
    );
  }

  if (pagamento.status !== 'pendente') {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="mb-2 text-2xl font-semibold">Pagamento indisponível</h1>
        <p className="text-sm text-gray-600">
          {pagamento.status === 'expirado'
            ? 'O prazo de pagamento se esgotou e a solicitação foi cancelada.'
            : 'Este pagamento foi encerrado após o limite de tentativas recusadas.'}
        </p>
        <Link href="/minhas-solicitacoes"
          className="mt-6 inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
          Voltar
        </Link>
      </main>
    );
  }

  const tentativasRestantes = 3 - pagamento.numeroTentativas;

  async function pagar(resultado) {
    setErro('');
    setAviso('');
    setProcessando(true);

    try {
      const resposta = await fetch(`/api/pagamentos/${pagamento.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formaPagamento: forma, resultado }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não foi possível processar o pagamento.');
        router.refresh();
        return;
      }

      if (dados.status === 'pago') {
        router.refresh();
        return;
      }

      setAviso(dados.mensagem ?? '');
      router.refresh();
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Pagamento</h1>
      <p className="mb-6 text-sm text-gray-600">
        {pagamento.servico} · {pagamento.fornecedor}
      </p>

      <div className="mb-6 rounded-lg border border-gray-300 p-4">
        <p className="text-sm text-gray-600">Valor total</p>
        <p className="text-2xl font-semibold">{formatarPreco(pagamento.valorBruto)}</p>
        <p className="mt-2 text-sm">
          Evento em {formatarDataHora(pagamento.dataHoraEvento)}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          Pague até {formatarDataHora(pagamento.dataLimite)}. Sem confirmação até lá,
          a solicitação é cancelada automaticamente.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Forma de pagamento</p>

        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="forma" value="pix"
            checked={forma === 'pix'} onChange={(e) => setForma(e.target.value)} />
          Pix
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="forma" value="boleto" disabled={!boletoDisponivel}
            checked={forma === 'boleto'} onChange={(e) => setForma(e.target.value)} />
          <span className={boletoDisponivel ? '' : 'text-gray-400'}>
            Boleto
            {!boletoDisponivel &&
              ` — indisponível: exige ao menos ${diasMinimosBoleto} dias de antecedência do evento`}
          </span>
        </label>

        <p className="text-xs text-gray-500">
          Cartão de crédito estará disponível após o cadastro de cartões.
        </p>
      </div>

      {pagamento.numeroTentativas > 0 && (
        <p className="mt-4 text-sm text-gray-600">
          Tentativas recusadas: {pagamento.numeroTentativas} de 3.
          {tentativasRestantes > 0 && ` Restam ${tentativasRestantes}.`}
        </p>
      )}

      {aviso && <p className="mt-4 text-sm text-amber-700">{aviso}</p>}
      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      <div className="mt-8 rounded-lg border border-dashed rounded-lg border border-festa-600 text-festa-700 hover:bg-festa-50 px-3 py-1.5 text-sm p-4">
        <p className="text-sm font-medium">Simulação do gateway de pagamento</p>
        <p className="mt-1 text-xs text-gray-600">
          A plataforma não processa pagamentos diretamente: quem aprova ou recusa é
          o gateway externo. Enquanto a integração não existe, escolha abaixo a
          resposta que o gateway devolveria.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={processando}
            onClick={() => pagar('sucesso')}
            className="rounded-lg bg-festa-600 hover:bg-festa-700 px-4 py-2 text-sm text-white disabled:opacity-50">
            Pagamento aprovado
          </button>
          <button type="button" disabled={processando}
            onClick={() => pagar('recusa')}
            className="rounded-lg border rounded-lg border border-festa-600 text-festa-700 hover:bg-festa-50 px-3 py-1.5 text-sm px-4 py-2 text-sm disabled:opacity-50">
            Pagamento recusado
          </button>
          <button type="button" disabled={processando}
            onClick={() => pagar('erro_tecnico')}
            className="rounded-lg border rounded-lg border border-festa-600 text-festa-700 hover:bg-festa-50 px-3 py-1.5 text-sm px-4 py-2 text-sm disabled:opacity-50">
            Falha técnica
          </button>
        </div>
      </div>
    </main>
  );
}