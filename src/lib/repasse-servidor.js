import { pool } from '@/lib/db';
import { obterConfiguracoes } from '@/lib/configuracao';
import { notificar } from '@/lib/notificacao-servidor';

// Módulo de servidor: importa o banco, então nunca pode ser carregado por
// componente de tela.

// RF054 / RN056 — liberação do repasse após a carência.
//
// O valor devido ao fornecedor (RN027) fica retido por um período
// parametrizável contado da CONFIRMAÇÃO DA CONCLUSÃO — manual ou automática
// (RF036) —, e só então fica disponível para saque. A carência existe para
// cobrir o intervalo em que ainda pode surgir contestação ou disputa.
//
// Só entram solicitações concluídas com pagamento efetivado. Solicitação em
// contestação pendente permanece em "confirmado" (RN069), então fica de fora
// por consequência, sem precisar de cláusula própria.
//
// A CHECK chk_pagamento_data_repasse exige que "liberado" venha sempre com
// data preenchida — por isso os dois campos são gravados juntos.
export async function liberarRepassesVencidos() {
  const configuracoes = await obterConfiguracoes();

  // Levanta antes de atualizar, para saber quem avisar e de quanto.
  const [liberaveis] = await pool.execute(
    `SELECT p.id, p.valor_repassado, f.id_usuario, s.nome AS servico
       FROM pagamento p
       JOIN solicitacao so ON so.id = p.id_solicitacao
       JOIN servico s      ON s.id  = so.id_servico
       JOIN fornecedor f   ON f.id  = s.id_fornecedor
      WHERE p.status_repasse = 'pendente'
        AND p.status = 'pago'
        AND so.status = 'concluido'
        AND so.data_confirmacao_conclusao_cliente IS NOT NULL
        AND DATE_ADD(so.data_confirmacao_conclusao_cliente, INTERVAL ? DAY) < NOW()`,
    [configuracoes.periodo_carencia_repasse_dias]
  );

  if (liberaveis.length === 0) return;

  await pool.query(
    `UPDATE pagamento SET status_repasse = 'liberado', data_repasse = NOW()
      WHERE id IN (?)`,
    [liberaveis.map((linha) => linha.id)]
  );

  for (const repasse of liberaveis) {
    // Tipo "financeiro" não guarda referência de solicitação: leva o
    // fornecedor ao painel financeiro, não a uma contratação (RN065).
    await notificar({
      idUsuario: repasse.id_usuario,
      tipo: 'financeiro',
      titulo: 'Repasse liberado para saque',
      mensagem: `R$ ${Number(repasse.valor_repassado).toFixed(2).replace('.', ',')} de `
        + `${repasse.servico} saíram da carência e já contam no seu saldo.`,
    });
  }
}
