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
    // A chk_avaliacao_ocultacao exige motivo quando a origem é moderação —
    // ao contrário da ocultação pelo próprio autor, que não tem motivo.
    if (motivoOcultacao.length < 10) {
      return NextResponse.json(
        { erro: 'Descreva em ao menos 10 caracteres o motivo da remoção do comentário.' },
        { status: 400 }
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

  return NextResponse.json({ resultado, comentarioOcultado: ocultarComentario });
}
