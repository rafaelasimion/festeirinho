import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterAdministradorLogado } from '@/lib/sessao-admin';
import { notificar } from '@/lib/notificacao-servidor';

// UC 038 — validação dos dados de recebimento (saque e reembolso).
// UC 037, etapas 9–10 e fluxo 9a — transferência do saque.
// UC 022, etapas 7–8 — confirmação do estorno do reembolso.
//
// ---------------------------------------------------------------------
// SIMULAÇÃO DO GATEWAY
// Transferências e estornos são executados por gateway externo, que
// devolve o resultado por webhook (RF047). Aqui a administração informa o
// resultado no lugar do gateway. As transições de status, a devolução do
// valor ao saldo e a liberação da multa são as regras reais.
// ---------------------------------------------------------------------

const ACOES = ['validar_dados', 'concluir_saque', 'concluir_reembolso'];

// Os avisos financeiros não apontam para solicitação (RN065): levam o
// usuário à seção financeira, não a uma contratação.
async function usuarioDoSaque(idSaque) {
  const [linhas] = await pool.execute(
    `SELECT f.id_usuario FROM saque sq
       JOIN fornecedor f ON f.id = sq.id_fornecedor
      WHERE sq.id = ? LIMIT 1`,
    [idSaque]
  );
  return linhas[0]?.id_usuario ?? null;
}

async function usuarioDoCancelamento(idCancelamento) {
  const [linhas] = await pool.execute(
    `SELECT c.id_usuario FROM cancelamento ca
       JOIN solicitacao so ON so.id = ca.id_solicitacao
       JOIN cliente c      ON c.id = so.id_cliente
      WHERE ca.id = ? LIMIT 1`,
    [idCancelamento]
  );
  return linhas[0]?.id_usuario ?? null;
}

export async function PATCH(request) {
  const { erro } = await obterAdministradorLogado();
  if (erro) return erro;

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

  if (acao === 'validar_dados') return validarDados(corpo);
  if (acao === 'concluir_saque') return concluirSaque(corpo);
  return concluirReembolso(corpo);
}

// ---------------- UC 038 ----------------
async function validarDados(corpo) {
  const idDados = Number(corpo.id);
  const resultado = String(corpo.resultado ?? '');
  const motivo = String(corpo.motivo ?? '').trim();

  if (!Number.isInteger(idDados)) {
    return NextResponse.json({ erro: 'Registro inválido.' }, { status: 400 });
  }
  if (!['validado', 'rejeitado'].includes(resultado)) {
    return NextResponse.json({ erro: 'Resultado inválido.' }, { status: 400 });
  }
  // RN061 — o motivo é a única informação que permite ao ator corrigir o
  // dado. Sem ele, a pessoa reenviaria no escuro.
  if (resultado === 'rejeitado' && motivo.length < 10) {
    return NextResponse.json(
      { erro: 'Descreva o motivo da rejeição em ao menos 10 caracteres.' },
      { status: 400 }
    );
  }

  const [linhas] = await pool.execute(
    `SELECT id, id_saque, id_cancelamento, status_validacao
       FROM dados_recebimento WHERE id = ? LIMIT 1`,
    [idDados]
  );

  if (linhas.length === 0) {
    return NextResponse.json({ erro: 'Registro não encontrado.' }, { status: 404 });
  }
  if (linhas[0].status_validacao !== 'pendente') {
    return NextResponse.json({ erro: 'Estes dados não estão pendentes de validação.' }, { status: 409 });
  }

  const { id_saque: idSaque, id_cancelamento: idCancelamento } = linhas[0];

  // RN061 — a rejeição NÃO altera o que a originou: o saque segue
  // "pendente" com o valor reservado, e o cancelamento segue "em análise".
  if (resultado === 'rejeitado') {
    await pool.execute(
      `UPDATE dados_recebimento
          SET status_validacao = 'rejeitado', motivo_rejeicao = ?
        WHERE id = ? AND status_validacao = 'pendente'`,
      [motivo, idDados]
    );
    const idUsuario = idSaque
      ? await usuarioDoSaque(idSaque)
      : await usuarioDoCancelamento(idCancelamento);
    if (idUsuario) {
      await notificar({
        idUsuario,
        tipo: 'financeiro',
        titulo: 'Dados de recebimento rejeitados',
        mensagem: `${motivo} Corrija os dados para que a transferência siga.`,
      });
    }

    return NextResponse.json({ statusValidacao: 'rejeitado' });
  }

  // Validado: os dados liberam o processamento, e as duas escritas vão
  // juntas numa transação.
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    await conexao.execute(
      `UPDATE dados_recebimento SET status_validacao = 'validado'
        WHERE id = ? AND status_validacao = 'pendente'`,
      [idDados]
    );

    if (idSaque) {
      // UC 037, etapa 9 — a transferência é enviada ao gateway, que devolve
      // o identificador da operação.
      await conexao.execute(
        `UPDATE saque
            SET status = 'processando', id_transacao_gateway = ?
          WHERE id = ? AND status = 'pendente'`,
        [`SIM-TED-${idSaque}-${Date.now()}`, idSaque]
      );
    } else {
      // RN053 — com os dados validados, o reembolso segue para o gateway.
      await conexao.execute(
        `UPDATE cancelamento SET status = 'processando'
          WHERE id = ? AND status = 'em_analise'`,
        [idCancelamento]
      );
    }

    await conexao.commit();

    const idUsuario = idSaque
      ? await usuarioDoSaque(idSaque)
      : await usuarioDoCancelamento(idCancelamento);
    if (idUsuario) {
      await notificar({
        idUsuario,
        tipo: 'financeiro',
        titulo: 'Dados de recebimento validados',
        mensagem: idSaque
          ? 'Seu saque foi enviado para transferência.'
          : 'Seu reembolso foi enviado para processamento.',
      });
    }

    return NextResponse.json({ statusValidacao: 'validado' });
  } catch (erroValidacao) {
    await conexao.rollback();
    console.error('[admin/financeiro validar_dados]', erroValidacao);
    return NextResponse.json({ erro: 'Não foi possível validar os dados.' }, { status: 500 });
  } finally {
    conexao.release();
  }
}

// ---------------- UC 037, etapa 10 e fluxo 9a ----------------
async function concluirSaque(corpo) {
  const idSaque = Number(corpo.id);
  const resultado = String(corpo.resultado ?? '');
  const motivo = String(corpo.motivo ?? '').trim();

  if (!Number.isInteger(idSaque)) {
    return NextResponse.json({ erro: 'Saque inválido.' }, { status: 400 });
  }
  if (!['concluido', 'recusado'].includes(resultado)) {
    return NextResponse.json({ erro: 'Resultado inválido.' }, { status: 400 });
  }
  if (resultado === 'recusado' && motivo.length < 10) {
    return NextResponse.json(
      { erro: 'Descreva o motivo da falha em ao menos 10 caracteres.' },
      { status: 400 }
    );
  }

  try {
    // RN060 — na falha, o valor volta ao saldo sem que seja preciso
    // devolver nada: a view do saldo simplesmente deixa de contar saques
    // "recusados". A CHECK chk_saque_recusa exige o motivo junto.
    const [retorno] = resultado === 'concluido'
      ? await pool.execute(
          `UPDATE saque SET status = 'concluido', data_processamento = NOW()
            WHERE id = ? AND status = 'processando'`,
          [idSaque]
        )
      : await pool.execute(
          `UPDATE saque
              SET status = 'recusado', motivo_recusa = ?, data_processamento = NOW()
            WHERE id = ? AND status = 'processando'`,
          [motivo, idSaque]
        );

    if (retorno.affectedRows === 0) {
      return NextResponse.json({ erro: 'Este saque não está em processamento.' }, { status: 409 });
    }
    const idUsuario = await usuarioDoSaque(idSaque);
    if (idUsuario) {
      await notificar(resultado === 'concluido'
        ? {
            idUsuario,
            tipo: 'financeiro',
            titulo: 'Saque concluído',
            mensagem: 'A transferência foi confirmada pelo banco.',
          }
        : {
            idUsuario,
            tipo: 'financeiro',
            titulo: 'Saque recusado',
            mensagem: `${motivo} O valor voltou para o seu saldo disponível.`,
          });
    }

    return NextResponse.json({ status: resultado });
  } catch (erroSaque) {
    console.error('[admin/financeiro concluir_saque]', erroSaque);
    return NextResponse.json({ erro: 'Não foi possível registrar o resultado.' }, { status: 500 });
  }
}

// ---------------- UC 022, etapas 7–8 ----------------
async function concluirReembolso(corpo) {
  const idCancelamento = Number(corpo.id);
  if (!Number.isInteger(idCancelamento)) {
    return NextResponse.json({ erro: 'Cancelamento inválido.' }, { status: 400 });
  }

  try {
    // RN057 / UC 022 etapa 8a — ao concluir, a multa retida (quando houver)
    // é liberada ao fornecedor, sem carência. A CHECK
    // chk_cancelamento_data_repasse exige "liberado" com data preenchida,
    // por isso os dois campos mudam na mesma instrução.
    const [retorno] = await pool.execute(
      `UPDATE cancelamento
          SET status = 'concluido',
              status_repasse = IF(valor_multa > 0, 'liberado', status_repasse),
              data_repasse   = IF(valor_multa > 0, NOW(), data_repasse)
        WHERE id = ? AND status = 'processando'`,
      [idCancelamento]
    );

    if (retorno.affectedRows === 0) {
      return NextResponse.json(
        { erro: 'Este reembolso não está em processamento.' },
        { status: 409 }
      );
    }
    const idUsuario = await usuarioDoCancelamento(idCancelamento);
    if (idUsuario) {
      await notificar({
        idUsuario,
        tipo: 'financeiro',
        titulo: 'Reembolso concluído',
        mensagem: 'O valor do cancelamento foi devolvido.',
      });
    }

    return NextResponse.json({ status: 'concluido' });
  } catch (erroReembolso) {
    console.error('[admin/financeiro concluir_reembolso]', erroReembolso);
    return NextResponse.json({ erro: 'Não foi possível concluir o reembolso.' }, { status: 500 });
  }
}
