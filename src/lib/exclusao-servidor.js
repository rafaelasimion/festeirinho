import { pool } from '@/lib/db';
import { removerImagem } from '@/lib/imagens-servidor';

// UC 007 / RN044 / RN044-A / RN044-B — exclusão de conta.
//
// Excluir aqui não é apagar. O histórico de solicitações, pagamentos,
// cancelamentos e avaliações permanece ligado ao id do usuário, por
// integridade referencial e obrigação fiscal (RN044-B); o que desaparece
// são os dados que identificam a pessoa.
//
// RN044-A — os campos são definidos como NULL, e não substituídos por algo
// derivado do id ("usuario_42@removido"). Um valor derivado seria
// pseudonimização reversível, não anonimização, e a LGPD trata as duas de
// formas diferentes (art. 5º, XI).

const ROTULO_FORNECEDOR_REMOVIDO = 'Fornecedor removido';

// RN044 — a exclusão fica bloqueada enquanto houver obrigação em aberto.
// Devolve a lista de impedimentos, em linguagem que o usuário entenda.
export async function impedimentosParaExcluir(idUsuario, tipoUsuario) {
  const ehFornecedor = tipoUsuario === 'fornecedor';
  const impedimentos = [];

  // Contratação em andamento, dos dois lados: sair no meio deixaria a outra
  // parte sem contraparte.
  const [emAndamento] = await pool.execute(
    ehFornecedor
      ? `SELECT COUNT(*) AS total
           FROM solicitacao so
           JOIN servico s    ON s.id = so.id_servico
           JOIN fornecedor f ON f.id = s.id_fornecedor
          WHERE f.id_usuario = ?
            AND so.status IN ('aguardando_pagamento', 'confirmado')`
      : `SELECT COUNT(*) AS total
           FROM solicitacao so
           JOIN cliente c ON c.id = so.id_cliente
          WHERE c.id_usuario = ?
            AND so.status IN ('aguardando_pagamento', 'confirmado')`,
    [idUsuario]
  );
  if (Number(emAndamento[0].total) > 0) {
    impedimentos.push(
      `Você tem ${emAndamento[0].total} contratação(ões) em andamento. `
      + 'Conclua ou cancele antes de excluir a conta.'
    );
  }

  // Reembolso em curso: dinheiro a caminho não pode perder o destinatário.
  const [reembolsos] = await pool.execute(
    ehFornecedor
      ? `SELECT COUNT(*) AS total
           FROM cancelamento ca
           JOIN solicitacao so ON so.id = ca.id_solicitacao
           JOIN servico s      ON s.id = so.id_servico
           JOIN fornecedor f   ON f.id = s.id_fornecedor
          WHERE f.id_usuario = ?
            AND ca.valor_reembolso > 0
            AND ca.status IN ('em_analise', 'processando')`
      : `SELECT COUNT(*) AS total
           FROM cancelamento ca
           JOIN solicitacao so ON so.id = ca.id_solicitacao
           JOIN cliente c      ON c.id = so.id_cliente
          WHERE c.id_usuario = ?
            AND ca.valor_reembolso > 0
            AND ca.status IN ('em_analise', 'processando')`,
    [idUsuario]
  );
  if (Number(reembolsos[0].total) > 0) {
    impedimentos.push('Há reembolso em processamento vinculado à sua conta.');
  }

  // RN044 — saldo e saque em andamento, só para o fornecedor.
  if (ehFornecedor) {
    const [saldos] = await pool.execute(
      `SELECT v.saldo_disponivel
         FROM vw_saldo_fornecedor v
         JOIN fornecedor f ON f.id = v.id_fornecedor
        WHERE f.id_usuario = ?`,
      [idUsuario]
    );
    if (Number(saldos[0]?.saldo_disponivel ?? 0) > 0) {
      impedimentos.push(
        'Você tem saldo disponível. Saque o valor antes de excluir a conta.'
      );
    }

    const [saques] = await pool.execute(
      `SELECT COUNT(*) AS total
         FROM saque sq
         JOIN fornecedor f ON f.id = sq.id_fornecedor
        WHERE f.id_usuario = ?
          AND sq.status IN ('pendente', 'processando')`,
      [idUsuario]
    );
    if (Number(saques[0].total) > 0) {
      impedimentos.push('Há saque em andamento. Aguarde a conclusão da transferência.');
    }
  }

  return impedimentos;
}

export async function excluirConta(idUsuario, tipoUsuario) {
  const ehFornecedor = tipoUsuario === 'fornecedor';
  const conexao = await pool.getConnection();
  let fotoAnterior = null;

  try {
    await conexao.beginTransaction();

    const [usuarios] = await conexao.execute(
      'SELECT foto_perfil FROM usuario WHERE id = ? LIMIT 1',
      [idUsuario]
    );
    fotoAnterior = usuarios[0]?.foto_perfil ?? null;

    // Identificadores diretos do usuário. A senha permanece: ela não
    // identifica ninguém, é NOT NULL, e o acesso já fica bloqueado pelo
    // status "excluído" (UC 003, 6b).
    await conexao.execute(
      `UPDATE usuario
          SET nome = NULL, nome_usuario = NULL, email = NULL, telefone = NULL,
              foto_perfil = NULL, latitude = NULL, longitude = NULL
        WHERE id = ?`,
      [idUsuario]
    );

    if (ehFornecedor) {
      // RN044-A — o nome de exibição recebe rótulo genérico em vez de NULL:
      // ele é obrigatório e aparece no histórico de solicitações e
      // avaliações, que precisa continuar legível.
      //
      // A chk_fornecedor_pf_pj e a chk_fornecedor_nascimento foram escritas
      // verificando só o lado "deve ser NULL" justamente para permitir isto.
      await conexao.execute(
        `UPDATE fornecedor
            SET status_fornecedor = 'excluido',
                nome_exibicao = ?,
                cpf = NULL, cnpj = NULL, razao_social = NULL, data_nascimento = NULL,
                instagram_url = NULL, whatsapp_url = NULL, site = NULL,
                motivo_suspensao = NULL, data_suspensao = NULL,
                motivo_solicitacao_revisao = NULL, data_solicitacao_revisao = NULL,
                status_solicitacao_revisao = NULL,
                resultado_solicitacao_revisao = NULL, data_analise_revisao = NULL
          WHERE id_usuario = ?`,
        [ROTULO_FORNECEDOR_REMOVIDO, idUsuario]
      );
    } else {
      await conexao.execute(
        `UPDATE cliente
            SET status_cliente = 'excluido',
                cpf = NULL, data_nascimento = NULL,
                motivo_suspensao = NULL, data_suspensao = NULL,
                motivo_solicitacao_revisao = NULL, data_solicitacao_revisao = NULL,
                status_solicitacao_revisao = NULL,
                resultado_solicitacao_revisao = NULL, data_analise_revisao = NULL
          WHERE id_usuario = ?`,
        [idUsuario]
      );
    }

    // RN044-A — os dados de recebimento também guardam identificador direto:
    // chave Pix, banco, agência, conta, documento e nome do titular. Fica o
    // suficiente para auditar a operação já concluída: tipo de recebimento,
    // data de envio e status de validação (RN044-B).
    //
    // A chk_dados_recebimento_tipo verifica apenas o lado "deve ser NULL",
    // então anular tudo não a viola.
    const anularRecebimento = `SET d.chave_pix = NULL, d.tipo_chave_pix = NULL,
            d.banco = NULL, d.tipo_conta = NULL, d.agencia = NULL, d.numero_conta = NULL,
            d.cpf_cnpj_titular = NULL, d.nome_titular = NULL, d.motivo_rejeicao = NULL`;

    if (ehFornecedor) {
      await conexao.execute(
        `UPDATE dados_recebimento d
           JOIN saque sq     ON sq.id = d.id_saque
           JOIN fornecedor f ON f.id = sq.id_fornecedor
           ${anularRecebimento}
         WHERE f.id_usuario = ?`,
        [idUsuario]
      );
    } else {
      await conexao.execute(
        `UPDATE dados_recebimento d
           JOIN cancelamento ca ON ca.id = d.id_cancelamento
           JOIN solicitacao so  ON so.id = ca.id_solicitacao
           JOIN cliente c       ON c.id = so.id_cliente
           ${anularRecebimento}
         WHERE c.id_usuario = ?`,
        [idUsuario]
      );
    }

    await conexao.commit();
  } catch (erro) {
    await conexao.rollback();
    console.error('[excluirConta]', erro);
    return { erro: 'Não foi possível excluir a conta.' };
  } finally {
    conexao.release();
  }

  // O arquivo da foto sai do disco depois do commit. Anular a coluna sem
  // apagar o arquivo deixaria a imagem da pessoa acessível por quem
  // soubesse o endereço.
  if (fotoAnterior) await removerImagem(fotoAnterior);

  return { excluida: true };
}
