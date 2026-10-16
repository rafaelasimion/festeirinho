import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterAdministradorLogado } from '@/lib/sessao-admin';
import { notificar } from '@/lib/notificacao-servidor';

// RF068 / UC 026 — análise da denúncia e, quando for o caso, moderação do
// comentário denunciado.
//
// RN045 — a moderação remove CONTEÚDO INADEQUADO, não crítica negativa.
// Uma avaliação ruim porém legítima permanece visível: é justamente o que
// dá valor às avaliações boas. Por isso ocultar é uma decisão separada do
// resultado da denúncia, e não uma consequência automática dele.
//
// UC 041, fluxo 4a — com a denúncia de fornecedor procedente, a
// administração pode suspender o fornecedor (UC 031) no mesmo envio,
// registrando a denúncia como motivo. Pelo mesmo raciocínio da ocultação,
// é uma escolha separada e explícita, nunca uma consequência do resultado
// (RN052). Antes a suspensão só podia ser feita na aba Contas, onde o
// fornecedor nem aparecia de saída (CT-120). As duas escritas vão na mesma
// transação: se a suspensão falhar, a análise também é desfeita, e a tela
// não fica dizendo "procedente" sem a suspensão que foi pedida.

export async function PATCH(request) {
  const { erro } = await obterAdministradorLogado();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const id = Number(corpo.id);
  const resultado = String(corpo.resultado ?? '');
  const justificativa = String(corpo.justificativa ?? '').trim();
  const ocultarComentario = Boolean(corpo.ocultarComentario);
  const motivoOcultacao = String(corpo.motivoOcultacao ?? '').trim();
  const suspenderFornecedor = Boolean(corpo.suspenderFornecedor);
  const motivoSuspensao = String(corpo.motivoSuspensao ?? '').trim();

  if (!Number.isInteger(id)) {
    return NextResponse.json({ erro: 'Denúncia inválida.' }, { status: 400 });
  }
  if (!['procedente', 'improcedente'].includes(resultado)) {
    return NextResponse.json({ erro: 'Selecione o resultado da análise.' }, { status: 400 });
  }
  // A justificativa é devolvida ao denunciante (RF068).
  if (justificativa.length < 20) {
    return NextResponse.json(
      { erro: 'Descreva a justificativa em ao menos 20 caracteres.' },
      { status: 400 }
    );
  }
  if (justificativa.length > 500) {
    return NextResponse.json({ erro: 'Justificativa muito longa.' }, { status: 400 });
  }

  // Carrega a denúncia com quem precisa ser avisado: o denunciante e, na
  // denúncia de avaliação, também o autor do comentário, caso ele seja
  // removido.
  const [linhas] = await pool.execute(
    `SELECT d.id, d.tipo_denuncia, d.status_denuncia, d.id_avaliacao,
            COALESCE(d.id_solicitacao, a.id_solicitacao) AS id_solicitacao,
            a.comentario,
            f.id AS id_fornecedor, f.status_fornecedor,
            f.id_usuario AS usuario_fornecedor,
            c.id_usuario AS usuario_cliente,
            s.nome AS servico
       FROM denuncia d
       LEFT JOIN avaliacao a ON a.id = d.id_avaliacao
       JOIN solicitacao so ON so.id = COALESCE(d.id_solicitacao, a.id_solicitacao)
       JOIN servico s      ON s.id  = so.id_servico
       JOIN fornecedor f   ON f.id  = s.id_fornecedor
       JOIN cliente c      ON c.id  = so.id_cliente
      WHERE d.id = ?
      LIMIT 1`,
    [id]
  );

  if (linhas.length === 0) {
    return NextResponse.json({ erro: 'Denúncia não encontrada.' }, { status: 404 });
  }
  const denuncia = linhas[0];

  if (denuncia.status_denuncia !== 'pendente') {
    return NextResponse.json(
      { erro: 'Esta denúncia já foi analisada.' },
      { status: 409 }
    );
  }

  const ehDeAvaliacao = denuncia.tipo_denuncia === 'avaliacao';

  if (ocultarComentario) {
    if (!ehDeAvaliacao) {
      return NextResponse.json(
        { erro: 'Só denúncia de avaliação permite ocultar comentário.' },
        { status: 400 }
      );
    }
    // UC 026, fluxo 3a — denúncia improcedente é crítica legítima, e crítica
    // legítima não se oculta (RN045). A tela já não oferecia a combinação;
    // a rota passa a recusá-la também.
    if (resultado !== 'procedente') {
      return NextResponse.json(
        { erro: 'Só é possível ocultar o comentário quando a denúncia é procedente.' },
        { status: 400 }
      );
    }
    // A chk_avaliacao_ocultacao exige motivo quando a origem é moderação —
    // ao contrário da ocultação pelo próprio autor, que não tem motivo.
    if (motivoOcultacao.length < 10) {
      return NextResponse.json(
        { erro: 'Descreva em ao menos 10 caracteres o motivo da remoção do comentário.' },
        { status: 400 }
      );
    }
    // Teto da coluna motivo_ocultacao. A justificativa ao lado já tinha o
    // seu; este faltava, e as duas escritas vivem na mesma transação — o
    // estouro desfazia também a análise da denúncia, que voltava a pendente.
    if (motivoOcultacao.length > 500) {
      return NextResponse.json(
        { erro: 'O motivo da remoção não pode passar de 500 caracteres.' },
        { status: 400 }
      );
    }
  }

  if (suspenderFornecedor) {
    if (ehDeAvaliacao) {
      return NextResponse.json(
        { erro: 'A suspensão pela análise vale só para denúncia de fornecedor.' },
        { status: 400 }
      );
    }
    if (resultado !== 'procedente') {
      return NextResponse.json(
        { erro: 'Só é possível suspender o fornecedor quando a denúncia é procedente.' },
        { status: 400 }
      );
    }
    // Mesmas faixas da suspensão pela aba Contas (UC 031).
    if (motivoSuspensao.length < 10) {
      return NextResponse.json(
        { erro: 'Descreva o motivo da suspensão em ao menos 10 caracteres.' },
        { status: 400 }
      );
    }
    if (motivoSuspensao.length > 500) {
      return NextResponse.json(
        { erro: 'O motivo da suspensão não pode passar de 500 caracteres.' },
        { status: 400 }
      );
    }
    if (['suspenso', 'excluido'].includes(denuncia.status_fornecedor)) {
      return NextResponse.json(
        { erro: denuncia.status_fornecedor === 'suspenso'
          ? 'Este fornecedor já está suspenso.'
          : 'A conta deste fornecedor foi excluída.' },
        { status: 409 }
      );
    }
  }

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    // A chk_denuncia_analise exige status, resultado, justificativa e data
    // gravados juntos.
    await conexao.execute(
      `UPDATE denuncia
          SET status_denuncia = 'analisada',
              resultado_analise = ?,
              justificativa_analise = ?,
              data_analise = NOW()
        WHERE id = ? AND status_denuncia = 'pendente'`,
      [resultado, justificativa, id]
    );

    if (ocultarComentario) {
      // RN062 — oculta o TEXTO; a nota continua contando na média do
      // serviço e do fornecedor, como em qualquer outra ocultação.
      await conexao.execute(
        `UPDATE avaliacao
            SET status_avaliacao = 'oculta',
                origem_ocultacao = 'moderacao',
                motivo_ocultacao = ?
          WHERE id = ?`,
        [motivoOcultacao, denuncia.id_avaliacao]
      );
    }

    if (suspenderFornecedor) {
      // UC 031, etapa 5 — o mesmo UPDATE da aba Contas: status, motivo e
      // data juntos (chk_fornecedor_suspensao), e a revisão zerada, porque
      // ela é da suspensão vigente (UC 003, 6a.2). A guarda no WHERE cobre
      // a suspensão feita em outra aba entre a leitura e esta escrita.
      const [retorno] = await conexao.execute(
        `UPDATE fornecedor
            SET status_fornecedor = 'suspenso',
                motivo_suspensao = ?,
                data_suspensao = NOW(),
                motivo_solicitacao_revisao = NULL,
                data_solicitacao_revisao = NULL,
                status_solicitacao_revisao = NULL,
                resultado_solicitacao_revisao = NULL,
                data_analise_revisao = NULL
          WHERE id = ? AND status_fornecedor NOT IN ('suspenso', 'excluido')`,
        [motivoSuspensao, denuncia.id_fornecedor]
      );
      if (retorno.affectedRows === 0) {
        await conexao.rollback();
        return NextResponse.json(
          { erro: 'Este fornecedor já está suspenso.' },
          { status: 409 }
        );
      }
    }

    await conexao.commit();
  } catch (erroAnalise) {
    await conexao.rollback();
    console.error('[admin/denuncias]', erroAnalise);
    return NextResponse.json({ erro: 'Não foi possível registrar a análise.' }, { status: 500 });
  } finally {
    conexao.release();
  }

  // RF068 — o denunciante recebe o resultado. RN052: o denunciado não é
  // avisado de que foi alvo de denúncia.
  const denunciante = ehDeAvaliacao ? denuncia.usuario_fornecedor : denuncia.usuario_cliente;
  await notificar({
    idUsuario: denunciante,
    tipo: ehDeAvaliacao ? 'avaliacao' : 'solicitacao',
    titulo: resultado === 'procedente'
      ? 'Sua denúncia foi julgada procedente'
      : 'Sua denúncia foi julgada improcedente',
    mensagem: `Sobre ${denuncia.servico}: ${justificativa}`,
    idSolicitacao: denuncia.id_solicitacao,
  });

  // RN065 — a moderação de avaliação é avisada a quem escreveu o
  // comentário: é o texto dele que deixou de aparecer.
  if (ocultarComentario) {
    await notificar({
      idUsuario: denuncia.usuario_cliente,
      tipo: 'avaliacao',
      titulo: 'Comentário removido pela moderação',
      mensagem: `Seu comentário sobre ${denuncia.servico} foi removido: ${motivoOcultacao} `
        + 'A nota que você deu continua valendo.',
      idSolicitacao: denuncia.id_solicitacao,
    });
  }

  // UC 031 — o fornecedor suspenso é avisado com o motivo, como na
  // suspensão pela aba Contas; a tela de acesso mostra o mesmo texto e a
  // opção de pedir revisão (UC 006).
  if (suspenderFornecedor) {
    await notificar({
      idUsuario: denuncia.usuario_fornecedor,
      tipo: 'conta',
      titulo: 'Conta suspensa',
      mensagem: `Motivo: ${motivoSuspensao} Você pode solicitar revisão na tela de acesso.`,
    });
  }

  return NextResponse.json({
    resultado,
    comentarioOcultado: ocultarComentario,
    fornecedorSuspenso: suspenderFornecedor,
  });
}
