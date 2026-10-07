import { pool } from '@/lib/db';
import { obterConfiguracoes } from '@/lib/configuracao';
import { registrarCancelamento } from '@/lib/cancelamento-servidor';
import { notificar, partesDaSolicitacao } from '@/lib/notificacao-servidor';

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
// Esta rotina é chamada pelas DUAS listas de solicitação, a do cliente e a do
// fornecedor, que podem estar abertas ao mesmo tempo. Sem transação e com o
// UPDATE sem nenhuma das condições do SELECT, as duas execuções confirmavam a
// mesma solicitação e a segunda regravava data_confirmacao_conclusao_cliente
// — que é o marco de onde a carência do repasse conta (RN056), então o
// repasse atrasava um dia e saíam duas notificações do mesmo fato.
//
// Pior: se uma contestação fosse registrada entre o SELECT e o UPDATE, o
// UPDATE sem guarda violaria a chk_solicitacao_contestacao_pendente e, sem
// try/catch, derrubaria a renderização da página.
//
// O FOR UPDATE serializa as duas execuções; a guarda no UPDATE repete as
// condições que tornam a linha elegível.
export async function confirmarConclusoesVencidas() {
  const configuracoes = await obterConfiguracoes();
  const conexao = await pool.getConnection();
  let ids = [];

  try {
    await conexao.beginTransaction();

    // Os ids são levantados ANTES da atualização: depois dela, as linhas não
    // se distinguem mais das que já estavam concluídas, e não haveria como
    // saber quem notificar (RN065).
    const [vencidas] = await conexao.execute(
      `SELECT id FROM solicitacao
        WHERE status = 'confirmado'
          AND data_registro_conclusao_fornecedor IS NOT NULL
          AND data_confirmacao_conclusao_cliente IS NULL
          AND status_contestacao IS NULL
          AND DATE_ADD(data_registro_conclusao_fornecedor, INTERVAL ? HOUR) < NOW()
        FOR UPDATE`,
      [configuracoes.prazo_confirmacao_conclusao_horas]
    );

    ids = vencidas.map((linha) => linha.id);

    if (ids.length > 0) {
      await conexao.query(
        `UPDATE solicitacao
            SET data_confirmacao_conclusao_cliente = NOW(),
                status = 'concluido'
          WHERE id IN (?)
            AND status = 'confirmado'
            AND data_confirmacao_conclusao_cliente IS NULL
            AND status_contestacao IS NULL`,
        [ids]
      );
    }

    await conexao.commit();
  } catch (erro) {
    await conexao.rollback();
    console.error('[confirmarConclusoesVencidas]', erro);
    return;
  } finally {
    conexao.release();
  }

  if (ids.length === 0) return;

  for (const idSolicitacao of ids) {
    const partes = await partesDaSolicitacao(idSolicitacao);
    if (!partes) continue;
    await notificar({
      idUsuario: partes.fornecedor,
      tipo: 'solicitacao',
      titulo: 'Conclusão confirmada automaticamente',
      mensagem: `O prazo do cliente se esgotou e ${partes.servico} foi dado como concluído.`,
      idSolicitacao,
    });
    await notificar({
      idUsuario: partes.cliente,
      tipo: 'solicitacao',
      titulo: 'Serviço concluído',
      mensagem: `${partes.servico} foi confirmado automaticamente por falta de resposta no prazo.`,
      idSolicitacao,
    });
  }
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
