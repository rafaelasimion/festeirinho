import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterClienteLogado } from '@/lib/autorizacao';
import { obterConfiguracoes } from '@/lib/configuracao';
import { notificar, partesDaSolicitacao } from '@/lib/notificacao-servidor';

// RF031 — o cliente escolhe a forma de pagamento e confirma a operação.
//
// ---------------------------------------------------------------------
// SIMULAÇÃO DO GATEWAY
// Em produção, quem decide se o pagamento foi aprovado é o gateway, e a
// resposta chega por webhook (RF047). Aqui o resultado vem no corpo da
// requisição, em `resultado`. Todo o resto — prazos, teto da data-limite,
// contador de tentativas, comissão, cancelamento automático — é a regra
// real do sistema. Trocar a simulação por um gateway de verdade significa
// substituir apenas o bloco marcado abaixo.
// ---------------------------------------------------------------------

const FORMAS_ACEITAS = ['pix', 'boleto'];
const LIMITE_TENTATIVAS = 3; // RN048 — fixo de propósito, não parametrizável

export async function PATCH(request, { params }) {
  const { erro, cliente } = await obterClienteLogado();
  if (erro) return erro;

  const { id } = await params;
  const idPagamento = Number(id);
  if (!Number.isInteger(idPagamento)) {
    return NextResponse.json({ erro: 'Pagamento inválido.' }, { status: 400 });
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const formaPagamento = String(corpo.formaPagamento ?? '');
  if (!FORMAS_ACEITAS.includes(formaPagamento)) {
    return NextResponse.json({ erro: 'Selecione uma forma de pagamento.' }, { status: 400 });
  }

  const resultado = String(corpo.resultado ?? 'sucesso');
  if (!['sucesso', 'recusa', 'erro_tecnico'].includes(resultado)) {
    return NextResponse.json({ erro: 'Resultado inválido.' }, { status: 400 });
  }

  // O pagamento precisa ser de uma solicitação DESTE cliente.
  const [linhas] = await pool.execute(
    `SELECT p.id, p.status, p.data_limite, p.numero_tentativas,
            so.id AS id_solicitacao, so.status AS status_solicitacao,
            so.data_hora_evento
       FROM pagamento p
       JOIN solicitacao so ON so.id = p.id_solicitacao
      WHERE p.id = ? AND so.id_cliente = ?
      LIMIT 1`,
    [idPagamento, cliente.id]
  );

  if (linhas.length === 0) {
    return NextResponse.json({ erro: 'Pagamento não encontrado.' }, { status: 404 });
  }

  const pagamento = linhas[0];

  if (pagamento.status !== 'pendente') {
    return NextResponse.json(
      { erro: 'Este pagamento não está mais aberto.' },
      { status: 409 }
    );
  }

  // RN024/RN025 — prazo esgotado cancela a solicitação, sem nova tentativa.
  if (new Date(pagamento.data_limite) < new Date()) {
    const conexao = await pool.getConnection();
    try {
      await conexao.beginTransaction();
      await conexao.execute(
        `UPDATE pagamento SET status = 'expirado' WHERE id = ? AND status = 'pendente'`,
        [idPagamento]
      );
      await conexao.execute(
        `UPDATE solicitacao SET status = 'cancelado'
          WHERE id = ? AND status = 'aguardando_pagamento'`,
        [pagamento.id_solicitacao]
      );
      await conexao.commit();
    } catch (erroTransacao) {
      await conexao.rollback();
      console.error('[pagamentos PATCH expiracao]', erroTransacao);
    } finally {
      conexao.release();
    }

    return NextResponse.json(
      { erro: 'O prazo de pagamento se esgotou e a solicitação foi cancelada.' },
      { status: 409 }
    );
  }

  const configuracoes = await obterConfiguracoes();

  // RN012 — boleto só é ofertado com antecedência mínima em relação ao
  // evento, por causa do prazo de compensação bancária.
  if (formaPagamento === 'boleto') {
    const limiteBoleto = new Date();
    limiteBoleto.setDate(limiteBoleto.getDate() + configuracoes.antecedencia_minima_boleto_dias);
    if (new Date(pagamento.data_hora_evento) < limiteBoleto) {
      return NextResponse.json(
        {
          erro: `Boleto disponível apenas com ao menos ${configuracoes.antecedencia_minima_boleto_dias} dias de antecedência do evento.`,
        },
        { status: 400 }
      );
    }
  }

  if (pagamento.numero_tentativas >= LIMITE_TENTATIVAS) {
    return NextResponse.json(
      { erro: 'Limite de tentativas atingido para esta solicitação.' },
      { status: 409 }
    );
  }

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    // RN024 — a data-limite é regravada conforme a forma escolhida.
    // Pix mantém o prazo contado da geração; boleto assume o vencimento
    // emitido pelo gateway (aqui simulado em 3 dias). Nos dois casos vale
    // o teto: nunca depois das 24h que antecedem o evento.
    if (formaPagamento === 'boleto') {
      await conexao.execute(
        `UPDATE pagamento
            SET data_limite = LEAST(DATE_ADD(NOW(), INTERVAL 3 DAY),
                                    DATE_SUB(?, INTERVAL 24 HOUR))
          WHERE id = ?`,
        [pagamento.data_hora_evento, idPagamento]
      );
    }

    // ---------- início do trecho que um gateway real substituiria ----------
    if (resultado === 'sucesso') {
      const idTransacao = `SIM-${idPagamento}-${Date.now()}`;

      await conexao.execute(
        `UPDATE pagamento
            SET forma_pagamento = ?,
                status = 'pago',
                data_pagamento = NOW(),
                id_transacao_gateway = ?,
                categoria_falha = NULL
          WHERE id = ? AND status = 'pendente'`,
        [formaPagamento, idTransacao, idPagamento]
      );

      // RN023 — pagamento confirmado, a solicitação está fechada.
      await conexao.execute(
        `UPDATE solicitacao SET status = 'confirmado'
          WHERE id = ? AND status = 'aguardando_pagamento'`,
        [pagamento.id_solicitacao]
      );

      // RN065 — os avisos entram na MESMA transação do pagamento: se ela
      // falhar, ninguém recebe notícia de uma contratação que não fechou.
      const partes = await partesDaSolicitacao(pagamento.id_solicitacao, conexao);
      if (partes) {
        await notificar({
          idUsuario: partes.cliente,
          tipo: 'pagamento',
          titulo: 'Pagamento confirmado',
          mensagem: `Sua contratação de ${partes.servico} está confirmada.`,
          idSolicitacao: pagamento.id_solicitacao,
        }, conexao);
        await notificar({
          idUsuario: partes.fornecedor,
          tipo: 'pagamento',
          titulo: 'Pagamento recebido',
          mensagem: `${partes.nome_cliente} pagou ${partes.servico}. A festa está confirmada.`,
          idSolicitacao: pagamento.id_solicitacao,
        }, conexao);
      }

      await conexao.commit();
      return NextResponse.json({ status: 'pago', idTransacao });
    }

    // RN048 — falha técnica não é recusa: não conta tentativa e permite
    // repetir na hora, sem penalizar o cliente.
    if (resultado === 'erro_tecnico') {
      await conexao.execute(
        `UPDATE pagamento
            SET forma_pagamento = ?, categoria_falha = 'erro_tecnico'
          WHERE id = ? AND status = 'pendente'`,
        [formaPagamento, idPagamento]
      );
      await conexao.commit();
      return NextResponse.json(
        {
          status: 'pendente',
          mensagem: 'Falha temporária no processamento. Tente novamente.',
          tentativas: pagamento.numero_tentativas,
        }
      );
    }

    // Recusa efetiva: incrementa o contador.
    const tentativas = pagamento.numero_tentativas + 1;
    const atingiuLimite = tentativas >= LIMITE_TENTATIVAS;

    await conexao.execute(
      `UPDATE pagamento
          SET forma_pagamento = ?,
              numero_tentativas = ?,
              categoria_falha = 'recusa',
              status = ?
        WHERE id = ? AND status = 'pendente'`,
      [formaPagamento, tentativas, atingiuLimite ? 'recusado' : 'pendente', idPagamento]
    );

    // RN048 — na terceira recusa, a solicitação é cancelada automaticamente.
    if (atingiuLimite) {
      await conexao.execute(
        `UPDATE solicitacao SET status = 'cancelado'
          WHERE id = ? AND status = 'aguardando_pagamento'`,
        [pagamento.id_solicitacao]
      );

      // RN048 — o fornecedor perdeu a contratação sem ter feito nada
      // errado; é o mínimo que ele precisa saber para liberar a data.
      const partes = await partesDaSolicitacao(pagamento.id_solicitacao, conexao);
      if (partes) {
        await notificar({
          idUsuario: partes.cliente,
          tipo: 'pagamento',
          titulo: 'Pagamento recusado três vezes',
          mensagem: `A solicitação de ${partes.servico} foi cancelada após o limite `
            + 'de tentativas de pagamento.',
          idSolicitacao: pagamento.id_solicitacao,
        }, conexao);
        await notificar({
          idUsuario: partes.fornecedor,
          tipo: 'pagamento',
          titulo: 'Contratação cancelada por falta de pagamento',
          mensagem: `${partes.servico}: o pagamento não foi concluído e a data está livre.`,
          idSolicitacao: pagamento.id_solicitacao,
        }, conexao);
      }
    }
    // ---------- fim do trecho que um gateway real substituiria ----------

    await conexao.commit();

    return NextResponse.json({
      status: atingiuLimite ? 'recusado' : 'pendente',
      tentativas,
      restantes: LIMITE_TENTATIVAS - tentativas,
      mensagem: atingiuLimite
        ? 'Pagamento recusado pela terceira vez. A solicitação foi cancelada.'
        : 'Pagamento recusado. Você pode tentar novamente.',
    });
  } catch (erro) {
    await conexao.rollback();
    console.error('[pagamentos PATCH]', erro);
    return NextResponse.json(
      { erro: 'Não foi possível processar o pagamento.' },
      { status: 500 }
    );
  } finally {
    conexao.release();
  }
}