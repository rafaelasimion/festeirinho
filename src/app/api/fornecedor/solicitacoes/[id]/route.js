import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterFornecedorLogado } from '@/lib/autorizacao';
import { gerarPagamento } from '@/lib/pagamento-servidor';
import { registrarCancelamento } from '@/lib/cancelamento-servidor';

// RF022/RF023 — resposta do fornecedor à solicitação.
// UC 019 — registro da conclusão do serviço.
// UC 022 — solicitação de cancelamento pelo fornecedor.

const MOTIVOS_RECUSA = ['agenda_indisponivel', 'fora_da_area', 'inviabilidade', 'outro'];
const ACOES = ['aprovar', 'recusar', 'registrar_conclusao', 'cancelar'];

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
  if (!ACOES.includes(acao)) {
    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 });
  }

  // A solicitação precisa ser de um serviço DESTE fornecedor. O JOIN com
  // servico é o que garante isso — sem ele, bastaria trocar o número na URL
  // para agir sobre solicitação alheia.
  const [linhas] = await pool.execute(
    `SELECT so.id, so.status, so.data_limite_resposta_fornecedor,
            so.data_registro_conclusao_fornecedor,
            DATE_ADD(so.data_hora_evento, INTERVAL so.duracao * 60 MINUTE) AS termino_previsto
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

  // ---------------- UC 022: cancelar ----------------
  if (acao === 'cancelar') {
    const motivo = String(corpo.motivo ?? '').trim();
    if (motivo.length < 10) {
      return NextResponse.json(
        { erro: 'Descreva o motivo do cancelamento em ao menos 10 caracteres.' },
        { status: 400 }
      );
    }
    if (motivo.length > 1000) {
      return NextResponse.json({ erro: 'Motivo muito longo.' }, { status: 400 });
    }

    // RN051 — cancelamento pelo fornecedor devolve 100% ao cliente, sem multa.
    const resultado = await registrarCancelamento({
      idSolicitacao,
      solicitadoPor: 'fornecedor',
      motivo,
    });

    if (resultado.erro) {
      return NextResponse.json({ erro: resultado.erro }, { status: resultado.status });
    }
    return NextResponse.json(resultado.cancelamento);
  }

  // ---------------- UC 019: registrar conclusão ----------------
  if (acao === 'registrar_conclusao') {
    if (solicitacao.status !== 'confirmado') {
      return NextResponse.json(
        { erro: 'Só é possível registrar a conclusão de uma solicitação confirmada.' },
        { status: 409 }
      );
    }

    if (solicitacao.data_registro_conclusao_fornecedor !== null) {
      return NextResponse.json(
        { erro: 'A conclusão desta solicitação já foi registrada.' },
        { status: 409 }
      );
    }

    // UC 019, pré-condição: o evento já deve ter ocorrido.
    if (new Date(solicitacao.termino_previsto) > new Date()) {
      return NextResponse.json(
        { erro: 'A conclusão só pode ser registrada após o término previsto do evento.' },
        { status: 409 }
      );
    }

    try {
      await pool.execute(
        `UPDATE solicitacao
            SET data_registro_conclusao_fornecedor = NOW()
          WHERE id = ?
            AND status = 'confirmado'
            AND data_registro_conclusao_fornecedor IS NULL`,
        [idSolicitacao]
      );
      return NextResponse.json({ conclusaoRegistrada: true });
    } catch (erroConclusao) {
      console.error('[fornecedor/solicitacoes registrar_conclusao]', erroConclusao);
      return NextResponse.json(
        { erro: 'Não foi possível registrar a conclusão.' },
        { status: 500 }
      );
    }
  }

  // ---------------- UC 015: aprovar ou recusar ----------------
  const motivoRecusa = String(corpo.motivoRecusa ?? '');
  if (acao === 'recusar' && !MOTIVOS_RECUSA.includes(motivoRecusa)) {
    return NextResponse.json({ erro: 'Selecione o motivo da recusa.' }, { status: 400 });
  }

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
    } catch (erroRecusa) {
      console.error('[fornecedor/solicitacoes recusar]', erroRecusa);
      return NextResponse.json(
        { erro: 'Não foi possível registrar a resposta.' },
        { status: 500 }
      );
    }
  }

  // RN023 — aprovada, a solicitação segue para pagamento, e o registro de
  // pagamento nasce no mesmo instante, numa transação.
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
  } catch (erroAprovacao) {
    await conexao.rollback();
    console.error('[fornecedor/solicitacoes aprovar]', erroAprovacao);
    return NextResponse.json(
      { erro: 'Não foi possível aprovar a solicitação.' },
      { status: 500 }
    );
  } finally {
    conexao.release();
  }
}
