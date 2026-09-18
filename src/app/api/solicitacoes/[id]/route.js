import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterClienteLogado } from '@/lib/autorizacao';
import { obterConfiguracoes } from '@/lib/configuracao';
import { registrarCancelamento } from '@/lib/cancelamento-servidor';

// UC 020 — confirmação da conclusão do serviço pelo cliente.
// UC 022 — solicitação de cancelamento pelo cliente.
// UC 042 — contestação da conclusão registrada pelo fornecedor.

const ACOES = ['confirmar_conclusao', 'cancelar', 'contestar'];
const MOTIVOS_CONTESTACAO = [
  'servico_nao_prestado',
  'servico_parcial',
  'servico_divergente',
];

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

  const acao = String(corpo.acao ?? '');
  if (!ACOES.includes(acao)) {
    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 });
  }

  // A solicitação precisa ser DESTE cliente.
  const [linhas] = await pool.execute(
    `SELECT id, status,
            data_registro_conclusao_fornecedor,
            data_confirmacao_conclusao_cliente,
            status_contestacao
       FROM solicitacao
      WHERE id = ? AND id_cliente = ?
      LIMIT 1`,
    [idSolicitacao, cliente.id]
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

    const resultado = await registrarCancelamento({
      idSolicitacao,
      solicitadoPor: 'cliente',
      motivo,
    });

    if (resultado.erro) {
      return NextResponse.json({ erro: resultado.erro }, { status: resultado.status });
    }
    return NextResponse.json(resultado.cancelamento);
  }

  // ---------------- UC 042: contestar ----------------
  if (acao === 'contestar') {
    const motivoContestacao = String(corpo.motivoContestacao ?? '');
    const descricao = String(corpo.descricao ?? '').trim();

    if (!MOTIVOS_CONTESTACAO.includes(motivoContestacao)) {
      return NextResponse.json({ erro: 'Selecione o motivo da contestação.' }, { status: 400 });
    }
    if (descricao.length < 20) {
      return NextResponse.json(
        { erro: 'Descreva o ocorrido em ao menos 20 caracteres.' },
        { status: 400 }
      );
    }
    if (descricao.length > 1000) {
      return NextResponse.json({ erro: 'Descrição muito longa.' }, { status: 400 });
    }

    // UC 042, pré-condições: conclusão registrada, sem confirmação e sem
    // contestação anterior.
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
    if (solicitacao.status_contestacao !== null) {
      return NextResponse.json(
        { erro: 'Esta solicitação já possui uma contestação registrada.' },
        { status: 409 }
      );
    }

    // UC 042, fluxo 3a — fora do prazo da RN039 não há o que contestar: a
    // conclusão já teria sido confirmada automaticamente.
    const configuracoes = await obterConfiguracoes();
    const limite = new Date(solicitacao.data_registro_conclusao_fornecedor);
    limite.setHours(limite.getHours() + configuracoes.prazo_confirmacao_conclusao_horas);
    if (limite < new Date()) {
      return NextResponse.json(
        { erro: 'O prazo para contestar esta conclusão já se esgotou.' },
        { status: 409 }
      );
    }

    try {
      // A CHECK da tabela admite só três estados coerentes para a contestação.
      // O estado "pendente" exige motivo, descrição e data preenchidos, e
      // resultado, justificativa e data de análise nulos — tudo na mesma
      // instrução, por isso o UPDATE grava o conjunto inteiro.
      await pool.execute(
        `UPDATE solicitacao
            SET motivo_contestacao_cliente = ?,
                descricao_contestacao_cliente = ?,
                data_contestacao_cliente = NOW(),
                status_contestacao = 'pendente'
          WHERE id = ?
            AND status = 'confirmado'
            AND data_confirmacao_conclusao_cliente IS NULL
            AND status_contestacao IS NULL`,
        [motivoContestacao, descricao, idSolicitacao]
      );

      // RN069 — a solicitação permanece em "confirmado", a confirmação
      // automática fica suspensa e o repasse não se torna elegível.
      return NextResponse.json({ statusContestacao: 'pendente' });
    } catch (erroContestacao) {
      console.error('[solicitacoes contestar]', erroContestacao);
      return NextResponse.json(
        { erro: 'Não foi possível registrar a contestação.' },
        { status: 500 }
      );
    }
  }

  // ---------------- UC 020: confirmar conclusão ----------------
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
