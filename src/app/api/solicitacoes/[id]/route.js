import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterClienteLogado } from '@/lib/autorizacao';

// UC 020 — confirmação da conclusão do serviço pelo cliente.

export async function PATCH(request, { params }) {
  const { erro, cliente } = await obterClienteLogado();
  if (erro) return erro;

  const { id } = await params;
  const idSolicitacao = Number(id);
  if (!Number.isInteger(idSolicitacao)) {
    return NextResponse.json({ erro: 'Solicitação inválida.' }, { status: 400 });
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  if (String(corpo.acao ?? '') !== 'confirmar_conclusao') {
    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 });
  }

  // A solicitação precisa ser DESTE cliente.
  const [linhas] = await pool.execute(
    `SELECT id, status,
            data_registro_conclusao_fornecedor,
            data_confirmacao_conclusao_cliente
       FROM solicitacao
      WHERE id = ? AND id_cliente = ?
      LIMIT 1`,
    [idSolicitacao, cliente.id]
  );

  if (linhas.length === 0) {
    return NextResponse.json({ erro: 'Solicitação não encontrada.' }, { status: 404 });
  }

  const solicitacao = linhas[0];

  // UC 020, pré-condição: o fornecedor precisa ter registrado a conclusão.
  if (solicitacao.data_registro_conclusao_fornecedor === null) {
    return NextResponse.json(
      { erro: 'O fornecedor ainda não registrou a conclusão deste serviço.' },
      { status: 409 }
    );
  }

  if (solicitacao.status !== 'confirmado' ||
      solicitacao.data_confirmacao_conclusao_cliente !== null) {
    return NextResponse.json(
      { erro: 'Esta solicitação não está aguardando confirmação.' },
      { status: 409 }
    );
  }

  try {
    // RN028/RN039 — a confirmação fecha o ciclo: a solicitação passa a
    // "concluído" e a data gravada é o marco de onde a carência do repasse
    // começa a contar (RN056) e a partir do qual a avaliação é liberada.
    await pool.execute(
      `UPDATE solicitacao
          SET data_confirmacao_conclusao_cliente = NOW(),
              status = 'concluido'
        WHERE id = ?
          AND status = 'confirmado'
          AND data_confirmacao_conclusao_cliente IS NULL`,
      [idSolicitacao]
    );

    return NextResponse.json({ status: 'concluido' });
  } catch (erroConfirmacao) {
    console.error('[solicitacoes confirmar_conclusao]', erroConfirmacao);
    return NextResponse.json(
      { erro: 'Não foi possível confirmar a conclusão.' },
      { status: 500 }
    );
  }
}
