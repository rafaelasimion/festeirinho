import { pool } from '@/lib/db';
import { obterConfiguracoes } from '@/lib/configuracao';
import { registrarCancelamento } from '@/lib/cancelamento-servidor';

// Módulo de servidor: importa o banco, então nunca pode ser carregado por
// componente de tela.

// RF036 / RN039 — confirmação automática da conclusão.
//
// Registrada a conclusão pelo fornecedor, o cliente tem um prazo para
// confirmar. Esgotado o prazo sem resposta, o sistema confirma no lugar dele.
//
// RN069 — não se aplica quando há contestação registrada e ainda não
// analisada: nesse caso a solicitação permanece em "confirmado" até a decisão
// da administração.
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

// RN066 / UC 019, fluxo 2a — cancelamento automático por ausência de registro.
//
// Passado o prazo desde o término previsto do evento sem que o fornecedor
// registre a conclusão, a solicitação é cancelada com origem "sistema":
// reembolso integral ao cliente, sem multa e sem repasse ao fornecedor.
//
// O cálculo e a gravação ficam no motor de cancelamento, o mesmo que atende o
// pedido das partes e a contestação procedente. Aqui só se identifica quem
// está vencido.
export async function cancelarSemRegistroDeConclusao() {
  const configuracoes = await obterConfiguracoes();

  const [vencidas] = await pool.execute(
    `SELECT so.id
       FROM solicitacao so
      WHERE so.status = 'confirmado'
        AND so.data_registro_conclusao_fornecedor IS NULL
        AND DATE_ADD(
              DATE_ADD(so.data_hora_evento, INTERVAL so.duracao * 60 MINUTE),
              INTERVAL ? DAY) < NOW()
        AND NOT EXISTS (
              SELECT 1 FROM cancelamento c WHERE c.id_solicitacao = so.id)`,
    [configuracoes.prazo_registro_conclusao_dias]
  );

  for (const linha of vencidas) {
    const resultado = await registrarCancelamento({
      idSolicitacao: linha.id,
      solicitadoPor: 'sistema',
      motivo: 'Ausência de registro de conclusão pelo fornecedor dentro do prazo.',
    });
    if (resultado.erro) {
      console.error('[cancelarSemRegistroDeConclusao]', linha.id, resultado.erro);
    }
  }
}
