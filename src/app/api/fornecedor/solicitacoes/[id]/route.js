import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterFornecedorLogado } from '@/lib/autorizacao';
import { gerarPagamento } from '@/lib/pagamento-servidor';

// RF022/RF023 — resposta do fornecedor à solicitação.

const MOTIVOS_RECUSA = ['agenda_indisponivel', 'fora_da_area', 'inviabilidade', 'outro'];

export async function PATCH(request, { params }) {
  const { erro, fornecedor } = await obterFornecedorLogado();
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

  const acao = String(corpo.acao ?? '');
  if (acao !== 'aprovar' && acao !== 'recusar') {
    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 });
  }

  // RN021 — a recusa exige um motivo da lista padronizada.
  const motivoRecusa = String(corpo.motivoRecusa ?? '');
  if (acao === 'recusar' && !MOTIVOS_RECUSA.includes(motivoRecusa)) {
    return NextResponse.json({ erro: 'Selecione o motivo da recusa.' }, { status: 400 });
  }

  // A solicitação precisa ser de um serviço DESTE fornecedor. O JOIN com
  // servico é o que garante isso — sem ele, bastaria trocar o número na URL
  // para responder solicitação alheia.
  const [linhas] = await pool.execute(
    `SELECT so.id, so.status, so.data_limite_resposta_fornecedor
       FROM solicitacao so
       JOIN servico s ON s.id = so.id_servico
      WHERE so.id = ? AND s.id_fornecedor = ?
      LIMIT 1`,
    [idSolicitacao, fornecedor.id]
  );

  if (linhas.length === 0) {
    return NextResponse.json({ erro: 'Solicitação não encontrada.' }, { status: 404 });
  }

  const solicitacao = linhas[0];

  if (solicitacao.status !== 'aguardando_analise') {
    return NextResponse.json(
      { erro: 'Esta solicitação já foi respondida ou não está mais aberta.' },
      { status: 409 }
    );
  }

  // RN035 — passou do prazo, expira em vez de responder.
  if (new Date(solicitacao.data_limite_resposta_fornecedor) < new Date()) {
    await pool.execute(
      `UPDATE solicitacao
          SET status = 'expirado', data_resposta_fornecedor = NOW()
        WHERE id = ? AND status = 'aguardando_analise'`,
      [idSolicitacao]
    );
    return NextResponse.json(
      { erro: 'O prazo de resposta desta solicitação expirou.' },
      { status: 409 }
    );
  }

  if (acao === 'recusar') {
    try {
      await pool.execute(
        `UPDATE solicitacao
            SET status = 'recusado',
                motivo_recusa = ?,
                data_resposta_fornecedor = NOW()
          WHERE id = ? AND status = 'aguardando_analise'`,
        [motivoRecusa, idSolicitacao]
      );
      return NextResponse.json({ status: 'recusado' });
    } catch (erro) {
      console.error('[fornecedor/solicitacoes PATCH recusar]', erro);
      return NextResponse.json(
        { erro: 'Não foi possível registrar a resposta.' },
        { status: 500 }
      );
    }
  }

  // RN023 — aprovada, a solicitação segue para pagamento, e o registro de
  // pagamento nasce no mesmo instante. As duas coisas numa transação: uma
  // solicitação "aguardando pagamento" sem pagamento gerado deixaria o
  // cliente sem para onde ir.
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    await conexao.execute(
      `UPDATE solicitacao
          SET status = 'aguardando_pagamento',
              data_resposta_fornecedor = NOW()
        WHERE id = ? AND status = 'aguardando_analise'`,
      [idSolicitacao]
    );

    await gerarPagamento(conexao, idSolicitacao);

    await conexao.commit();
    return NextResponse.json({ status: 'aguardando_pagamento' });
  } catch (erro) {
    await conexao.rollback();
    console.error('[fornecedor/solicitacoes PATCH aprovar]', erro);
    return NextResponse.json(
      { erro: 'Não foi possível aprovar a solicitação.' },
      { status: 500 }
    );
  } finally {
    conexao.release();
  }
}