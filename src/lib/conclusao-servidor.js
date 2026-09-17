import { pool } from '@/lib/db';
import { obterConfiguracoes } from '@/lib/configuracao';

// Módulo de servidor: importa o banco, então nunca pode ser carregado por
// componente de tela.

// RF036 / RN039 — confirmação automática da conclusão.
//
// Registrada a conclusão pelo fornecedor, o cliente tem um prazo para
// confirmar. Esgotado o prazo sem resposta, o sistema confirma no lugar dele,
// gravando a data da mesma forma que na confirmação manual.
//
// RN069 — não se aplica quando há contestação registrada e ainda não
// analisada: nesse caso a solicitação permanece em "confirmado" até a decisão
// da administração. A cláusula do status_contestacao já deixa isso pronto,
// mesmo antes de a contestação existir na aplicação.
export async function confirmarConclusoesVencidas() {
  const configuracoes = await obterConfiguracoes();

  await pool.execute(
    `UPDATE solicitacao
        SET data_confirmacao_conclusao_cliente = NOW(),
            status = 'concluido'
      WHERE status = 'confirmado'
        AND data_registro_conclusao_fornecedor IS NOT NULL
        AND data_confirmacao_conclusao_cliente IS NULL
        AND status_contestacao IS NULL
        AND DATE_ADD(data_registro_conclusao_fornecedor, INTERVAL ? HOUR) < NOW()`,
    [configuracoes.prazo_confirmacao_conclusao_horas]
  );
}
