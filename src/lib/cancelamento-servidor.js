import { pool } from '@/lib/db';
import { calcularValores, impedimentoParaCancelar } from '@/lib/cancelamento';

// Registro do cancelamento — o caminho único por onde passam os quatro
// cenários que cancelam uma solicitação: pedido do cliente e do fornecedor
// (UC 022), contestação procedente (RN069) e ausência de registro de
// conclusão (RN066).

export async function registrarCancelamento({ idSolicitacao, solicitadoPor, motivo }) {
  const conexao = await pool.getConnection();

  try {
    const [linhas] = await conexao.execute(
      `SELECT so.id, so.status, so.data_hora_evento,
              so.data_registro_conclusao_fornecedor, so.status_contestacao,
              p.id AS id_pagamento, p.status AS status_pagamento,
              p.valor_bruto, p.forma_pagamento,
              p.perc_multa_faixa_mais_7d, p.perc_multa_faixa_7d_48h,
              p.perc_multa_faixa_48h_24h, p.perc_multa_faixa_24h,
              (SELECT COUNT(*) FROM cancelamento c
                WHERE c.id_solicitacao = so.id) AS ja_cancelada
         FROM solicitacao so
         LEFT JOIN pagamento p ON p.id_solicitacao = so.id
        WHERE so.id = ?
        LIMIT 1`,
      [idSolicitacao]
    );

    if (linhas.length === 0) {
      return { erro: 'Solicitação não encontrada.', status: 404 };
    }

    const dados = linhas[0];

    // O cancelamento pelo sistema (RN066, contestação procedente) não passa
    // pelas travas de conclusão e contestação: é justamente ele quem age
    // nesses dois cenários.
    const impedimento = solicitadoPor === 'sistema'
      ? (Number(dados.ja_cancelada) > 0
          ? 'Esta solicitação já possui um cancelamento registrado.'
          : null)
      : impedimentoParaCancelar({
          status: dados.status,
          dataEvento: dados.data_hora_evento,
          temCancelamento: Number(dados.ja_cancelada) > 0,
          conclusaoRegistrada: dados.data_registro_conclusao_fornecedor !== null,
          contestacaoPendente: dados.status_contestacao === 'pendente',
        });

    if (impedimento) return { erro: impedimento, status: 409 };

    const pagamento = dados.id_pagamento ? {
      status: dados.status_pagamento,
      valor_bruto: dados.valor_bruto,
      perc_multa_faixa_mais_7d: dados.perc_multa_faixa_mais_7d,
      perc_multa_faixa_7d_48h: dados.perc_multa_faixa_7d_48h,
      perc_multa_faixa_48h_24h: dados.perc_multa_faixa_48h_24h,
      perc_multa_faixa_24h: dados.perc_multa_faixa_24h,
    } : null;

    const { valorMulta, valorReembolso, percentual, rotulo } = calcularValores({
      solicitadoPor,
      dataEvento: dados.data_hora_evento,
      pagamento,
    });

    // RN053 — transições. Havendo reembolso a processar: Pix e cartão seguem
    // para "processando", porque o estorno é automático no gateway; boleto
    // fica em "em análise" até o cliente informar os dados de recebimento
    // (RN061). Sem reembolso a processar, conclui de imediato.
    const houveReembolso = valorReembolso > 0;
    const formaBoleto = dados.forma_pagamento === 'boleto';
    const statusCancelamento = !houveReembolso
      ? 'concluido'
      : formaBoleto ? 'em_analise' : 'processando';

    // RN057 / UC 022 etapa 8a — a multa retida é do fornecedor, e sem
    // carência. Quando o cancelamento já nasce "concluído" e houve multa, o
    // repasse é liberado no mesmo instante. As CHECKs da tabela exigem essa
    // coerência na mesma instrução.
    let statusRepasse = 'nao_aplicavel';
    let liberarAgora = false;
    if (valorMulta > 0) {
      if (statusCancelamento === 'concluido') {
        statusRepasse = 'liberado';
        liberarAgora = true;
      } else {
        statusRepasse = 'pendente';
      }
    }

    await conexao.beginTransaction();

    const [resultado] = await conexao.execute(
      `INSERT INTO cancelamento
         (id_solicitacao, solicitado_por, motivo,
          valor_reembolso, valor_multa, status, status_repasse, data_repasse)
       VALUES (?, ?, ?, ?, ?, ?, ?, ${liberarAgora ? 'NOW()' : 'NULL'})`,
      [idSolicitacao, solicitadoPor, motivo,
       valorReembolso, valorMulta, statusCancelamento, statusRepasse]
    );

    // RN053 — a solicitação passa a "cancelado" no REGISTRO do cancelamento,
    // não na sua conclusão.
    await conexao.execute(
      `UPDATE solicitacao SET status = 'cancelado' WHERE id = ?`,
      [idSolicitacao]
    );

    // RN040 — sincronização com o pagamento.
    if (dados.id_pagamento) {
      let novoStatusPagamento = null;
      if (['pendente', 'processando', 'recusado'].includes(dados.status_pagamento)) {
        novoStatusPagamento = 'cancelado';
      } else if (dados.status_pagamento === 'pago' && houveReembolso) {
        novoStatusPagamento = 'estornado';
      }
      // Pago sem reembolso (multa de 100%): o pagamento mantém "pago".

      if (novoStatusPagamento) {
        await conexao.execute(
          `UPDATE pagamento SET status = ?, status_repasse = 'cancelado' WHERE id = ?`,
          [novoStatusPagamento, dados.id_pagamento]
        );
      } else {
        await conexao.execute(
          `UPDATE pagamento SET status_repasse = 'cancelado' WHERE id = ?`,
          [dados.id_pagamento]
        );
      }
    }

    await conexao.commit();

    return {
      cancelamento: {
        id: resultado.insertId,
        valorMulta,
        valorReembolso,
        percentual,
        rotulo,
        status: statusCancelamento,
        aguardandoDadosRecebimento: statusCancelamento === 'em_analise',
      },
    };
  } catch (erro) {
    await conexao.rollback();
    console.error('[registrarCancelamento]', erro);
    return { erro: 'Não foi possível registrar o cancelamento.', status: 500 };
  } finally {
    conexao.release();
  }
}
