import { pool } from '@/lib/db';
import { obterConfiguracoes } from '@/lib/configuracao';

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

  await pool.execute(
    `UPDATE pagamento p
       JOIN solicitacao so ON so.id = p.id_solicitacao
        SET p.status_repasse = 'liberado',
            p.data_repasse = NOW()
      WHERE p.status_repasse = 'pendente'
        AND p.status = 'pago'
        AND so.status = 'concluido'
        AND so.data_confirmacao_conclusao_cliente IS NOT NULL
        AND DATE_ADD(so.data_confirmacao_conclusao_cliente, INTERVAL ? DAY) < NOW()`,
    [configuracoes.periodo_carencia_repasse_dias]
  );
}
