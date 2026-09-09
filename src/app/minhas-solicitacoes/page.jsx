import Link from 'next/link';
import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { expirarSolicitacoesVencidas } from '@/lib/solicitacao-servidor';
import { expirarPagamentosVencidos } from '@/lib/pagamento-servidor';
import {
  formatarPreco,
  ROTULO_STATUS_SOLICITACAO,
  ROTULO_MOTIVO_RECUSA,
} from '@/lib/solicitacao';

function formatarDataHora(valor) {
  return new Date(valor).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default async function MinhasSolicitacoes() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');
  if (sessao.tipoUsuario !== 'cliente') redirect('/minha-conta');

  // RN035 e RN025 — fecha o que venceu antes de mostrar a lista.
  await expirarSolicitacoesVencidas();
  await expirarPagamentosVencidos();

  const [solicitacoes] = await pool.execute(
    `SELECT so.id, so.data_hora_evento, so.duracao, so.numero_convidados,
            so.valor_final, so.status, so.motivo_recusa,
            so.data_solicitacao, so.data_limite_resposta_fornecedor,
            s.nome AS servico, f.nome_exibicao AS fornecedor,
            e.cidade, e.estado,
            p.id AS id_pagamento, p.status AS status_pagamento, p.data_limite
       FROM solicitacao so
       JOIN cliente c     ON c.id  = so.id_cliente
       JOIN servico s     ON s.id  = so.id_servico
       JOIN fornecedor f  ON f.id  = s.id_fornecedor
       JOIN endereco e    ON e.id  = so.id_endereco
       LEFT JOIN pagamento p ON p.id_solicitacao = so.id
      WHERE c.id_usuario = ?
      ORDER BY so.data_solicitacao DESC`,
    [sessao.id]
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Minhas solicitações</h1>
        <Link href="/servicos" className="text-sm hover:underline">
          Buscar serviços
        </Link>
      </div>

      {solicitacoes.length === 0 ? (
        <p className="text-sm text-gray-600">
          Você ainda não enviou nenhuma solicitação.{' '}
          <Link href="/servicos" className="underline">Ver serviços disponíveis</Link>.
        </p>
      ) : (
        <ul className="space-y-4">
          {solicitacoes.map((solicitacao) => (
            <li key={solicitacao.id} className="rounded border border-gray-300 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-medium">{solicitacao.servico}</h2>
                  <p className="text-sm text-gray-600">{solicitacao.fornecedor}</p>
                  <p className="mt-2 text-sm">
                    {formatarDataHora(solicitacao.data_hora_evento)} ·{' '}
                    {Number(solicitacao.duracao)}h ·{' '}
                    {solicitacao.numero_convidados} convidados
                  </p>
                  <p className="text-sm text-gray-600">
                    {solicitacao.cidade}/{solicitacao.estado}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-semibold">{formatarPreco(solicitacao.valor_final)}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    {ROTULO_STATUS_SOLICITACAO[solicitacao.status]}
                  </p>
                </div>
              </div>

              {solicitacao.status === 'aguardando_analise' && (
                <p className="mt-3 text-xs text-gray-500">
                  O fornecedor tem até{' '}
                  {formatarDataHora(solicitacao.data_limite_resposta_fornecedor)} para responder.
                </p>
              )}

              {solicitacao.status === 'aguardando_pagamento' && solicitacao.id_pagamento && (
                <div className="mt-4 flex items-center justify-between gap-4 border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-600">
                    Pague até {formatarDataHora(solicitacao.data_limite)} para confirmar.
                  </p>
                  <Link href={`/pagamento/${solicitacao.id_pagamento}`}
                    className="shrink-0 rounded bg-gray-900 px-3 py-1.5 text-sm text-white">
                    Pagar
                  </Link>
                </div>
              )}

              {solicitacao.status === 'confirmado' && solicitacao.id_pagamento && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <Link href={`/pagamento/${solicitacao.id_pagamento}`}
                    className="text-sm underline">
                    Ver comprovante
                  </Link>
                </div>
              )}

              {solicitacao.status === 'recusado' && solicitacao.motivo_recusa && (
                <p className="mt-3 rounded border border-gray-300 bg-gray-50 p-2 text-sm">
                  <span className="font-medium">Motivo da recusa: </span>
                  {ROTULO_MOTIVO_RECUSA[solicitacao.motivo_recusa]}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}