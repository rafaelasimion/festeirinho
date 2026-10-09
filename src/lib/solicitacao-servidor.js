import { pool } from '@/lib/db';
import { notificar, partesDaSolicitacao } from '@/lib/notificacao-servidor';

// Este arquivo fala com o banco, então só pode ser importado por código de
// servidor. É por isso que ele não vive dentro de solicitacao.js: aquele é
// importado por componentes de tela ('use client'), e uma tela não pode
// carregar o driver do MySQL.

// RN035 — esgotado o prazo sem resposta, a solicitação expira e o cliente é
// notificado (RF021, UC 015 fluxo 1a.2).
//
// O ideal seria uma tarefa agendada rodando de tempos em tempos. Sem ela,
// a expiração é aplicada no momento em que alguém olha a lista: antes de
// mostrar qualquer solicitação, o sistema fecha as que já venceram. O
// efeito para o usuário é o mesmo, e nenhuma solicitação vencida chega a
// ser exibida como se ainda estivesse aberta.
//
// A versão anterior era um UPDATE solto, e por isso ninguém era avisado:
// depois dele, as linhas recém-expiradas não se distinguem das que já
// estavam expiradas de execuções anteriores. Os ids agora são levantados
// ANTES, com a linha travada — mesma técnica de expirarPagamentosVencidos —,
// e as duas listas que chamam esta rotina ao mesmo tempo não avisam duas
// vezes o mesmo fato.
export async function expirarSolicitacoesVencidas() {
  const conexao = await pool.getConnection();
  let vencidas = [];

  try {
    await conexao.beginTransaction();

    const [linhas] = await conexao.execute(
      `SELECT id FROM solicitacao
        WHERE status = 'aguardando_analise'
          AND data_limite_resposta_fornecedor < NOW()
        FOR UPDATE`
    );
    vencidas = linhas.map((linha) => linha.id);

    if (vencidas.length > 0) {
      await conexao.query(
        `UPDATE solicitacao
            SET status = 'expirado',
                data_resposta_fornecedor = NOW()
          WHERE id IN (?) AND status = 'aguardando_analise'`,
        [vencidas]
      );
    }

    await conexao.commit();
  } catch (erro) {
    await conexao.rollback();
    console.error('[expirarSolicitacoesVencidas]', erro);
    return;
  } finally {
    conexao.release();
  }

  // Os avisos saem depois do commit, como na expiração de pagamentos: são
  // independentes entre si, e mandá-los dentro da transação seguraria a
  // trava das linhas por mais tempo que o necessário.
  for (const idSolicitacao of vencidas) {
    const partes = await partesDaSolicitacao(idSolicitacao);
    if (!partes) continue;

    // RF021 / RN035 — quem precisa saber é o cliente: a data que ele
    // reservou não vai acontecer com este fornecedor.
    await notificar({
      idUsuario: partes.cliente,
      tipo: 'solicitacao',
      titulo: 'Solicitação expirada',
      mensagem: `${partes.nome_fornecedor} não respondeu à sua solicitação de `
        + `${partes.servico} dentro do prazo. Você pode solicitar outro serviço.`,
      idSolicitacao,
    });

    // RN065 — para o fornecedor também é mudança de estado relevante: a
    // solicitação saiu da fila dele sem que ele tenha agido.
    await notificar({
      idUsuario: partes.fornecedor,
      tipo: 'solicitacao',
      titulo: 'Prazo de resposta esgotado',
      mensagem: `A solicitação de ${partes.servico} expirou sem resposta.`,
      idSolicitacao,
    });
  }
}
