import { pool } from '@/lib/db';
import { obterConfiguracoes } from '@/lib/configuracao';

// Módulo de servidor: importa o banco, então nunca pode ser carregado por
// componente de tela.

// RF030/RN027 — o pagamento nasce quando o fornecedor aprova a solicitação.
//
// Três coisas ficam CONGELADAS aqui, e é por isso que essas colunas existem
// na tabela: o percentual de comissão e os quatro percentuais de multa por
// cancelamento. Se a administração mudar qualquer um deles amanhã, quem já
// contratou continua sob as condições anunciadas no dia da contratação.
//
// O cálculo do dinheiro é feito pelo MySQL, em DECIMAL. Em JavaScript, todo
// número é ponto flutuante, e 0.1 + 0.2 não dá exatamente 0.3 — em valores
// monetários isso vira centavo perdido. A CHECK do banco exige
// valor_repassado = valor_bruto - valor_comissao exatamente, então deixar a
// conta com o banco é o que garante que ela feche.
export async function gerarPagamento(conexao, idSolicitacao) {
  const configuracoes = await obterConfiguracoes();
  const percentual = configuracoes.percentual_comissao;
  const prazoHoras = configuracoes.prazo_pagamento_horas;

  // RN024 — a data-limite é o prazo de pagamento contado de agora, mas nunca
  // pode passar das 24h que antecedem o evento. Vale o que vier primeiro,
  // que é exatamente o que LEAST faz.
  await conexao.execute(
    `INSERT INTO pagamento
       (id_solicitacao, valor_bruto, percentual_comissao,
        valor_comissao, valor_repassado,
        perc_multa_faixa_mais_7d, perc_multa_faixa_7d_48h,
        perc_multa_faixa_48h_24h, perc_multa_faixa_24h,
        data_limite)
     SELECT so.id,
            so.valor_final,
            ?,
            ROUND(so.valor_final * ? / 100, 2),
            so.valor_final - ROUND(so.valor_final * ? / 100, 2),
            ?, ?, ?, ?,
            LEAST(DATE_ADD(NOW(), INTERVAL ? HOUR),
                  DATE_SUB(so.data_hora_evento, INTERVAL 24 HOUR))
       FROM solicitacao so
      WHERE so.id = ?`,
    [
      percentual, percentual, percentual,
      configuracoes.multa_cancelamento_faixa_mais_7d,
      configuracoes.multa_cancelamento_faixa_7d_48h,
      configuracoes.multa_cancelamento_faixa_48h_24h,
      configuracoes.multa_cancelamento_faixa_24h,
      prazoHoras,
      idSolicitacao,
    ]
  );
}

// RN025 — pagamento não confirmado até a data-limite cancela a solicitação.
// Mesma estratégia da expiração de solicitações: aplicada quando alguém
// abre a lista, no lugar de uma tarefa agendada que o projeto não tem.
export async function expirarPagamentosVencidos() {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    await conexao.execute(
      `UPDATE pagamento
          SET status = 'expirado'
        WHERE status IN ('pendente', 'processando')
          AND data_limite < NOW()`
    );

    await conexao.execute(
      `UPDATE solicitacao so
         JOIN pagamento p ON p.id_solicitacao = so.id
          SET so.status = 'cancelado'
        WHERE p.status = 'expirado'
          AND so.status = 'aguardando_pagamento'`
    );

    await conexao.commit();
  } catch (erro) {
    await conexao.rollback();
    console.error('[expirarPagamentosVencidos]', erro);
  } finally {
    conexao.release();
  }
}