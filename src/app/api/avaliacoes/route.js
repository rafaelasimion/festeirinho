import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterClienteLogado } from '@/lib/autorizacao';
import { notificar, partesDaSolicitacao } from '@/lib/notificacao-servidor';

// UC 021 / RF037 — avaliação do serviço pelo cliente.

const VISIBILIDADES = ['visivel', 'oculta'];

export async function POST(request) {
  const { erro, cliente } = await obterClienteLogado();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const idSolicitacao = Number(corpo.idSolicitacao);
  const nota = Number(corpo.nota);
  const comentario = String(corpo.comentario ?? '').trim();
  const visibilidade = String(corpo.visibilidade ?? 'visivel');

  if (!Number.isInteger(idSolicitacao)) {
    return NextResponse.json({ erro: 'Solicitação inválida.' }, { status: 400 });
  }
  // RF037 — nota inteira de 1 a 5. A CHECK do banco também exige, mas aqui a
  // mensagem é compreensível.
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    return NextResponse.json({ erro: 'Escolha uma nota de 1 a 5.' }, { status: 400 });
  }
  if (!VISIBILIDADES.includes(visibilidade)) {
    return NextResponse.json({ erro: 'Visibilidade inválida.' }, { status: 400 });
  }
  if (comentario.length > 2000) {
    return NextResponse.json({ erro: 'Comentário muito longo.' }, { status: 400 });
  }

  // A solicitação precisa ser DESTE cliente e estar concluída (UC 021,
  // pré-condição).
  const [linhas] = await pool.execute(
    `SELECT so.id, so.status
       FROM solicitacao so
      WHERE so.id = ? AND so.id_cliente = ?
      LIMIT 1`,
    [idSolicitacao, cliente.id]
  );

  if (linhas.length === 0) {
    return NextResponse.json({ erro: 'Solicitação não encontrada.' }, { status: 404 });
  }
  if (linhas[0].status !== 'concluido') {
    return NextResponse.json(
      { erro: 'A avaliação fica disponível após a conclusão confirmada do serviço.' },
      { status: 409 }
    );
  }

  try {
    // RN062 — a visibilidade escolhida pelo cliente esconde apenas o
    // comentário, e nesse caso a origem da ocultação é "usuário". O motivo
    // fica nulo: ele só é exigido quando quem oculta é a moderação (RN045).
    // A CHECK da tabela só admite essas combinações.
    await pool.execute(
      `INSERT INTO avaliacao
         (id_solicitacao, nota, comentario, status_avaliacao, origem_ocultacao)
       VALUES (?, ?, ?, ?, ?)`,
      [
        idSolicitacao,
        nota,
        comentario || null,
        visibilidade,
        visibilidade === 'oculta' ? 'usuario' : null,
      ]
    );

    // RN062/RN065 — o fornecedor é avisado da nota mesmo quando o
    // comentário é privado: a nota conta para a média dele de qualquer jeito.
    const partes = await partesDaSolicitacao(idSolicitacao);
    if (partes) {
      await notificar({
        idUsuario: partes.fornecedor,
        tipo: 'avaliacao',
        titulo: `Nova avaliação: ${nota} de 5`,
        mensagem: `${partes.nome_cliente} avaliou ${partes.servico}`
          + (visibilidade === 'oculta'
            ? ', com comentário privado.'
            : (comentario ? `: "${comentario.slice(0, 200)}"` : '.')),
        idSolicitacao,
      });
    }

    return NextResponse.json({ nota, visibilidade }, { status: 201 });
  } catch (erroAvaliacao) {
    // RN006 — uma avaliação por solicitação, garantida pela UNIQUE. Vale como
    // última linha de defesa: dois envios simultâneos passariam pela
    // conferência da tela e só o banco barraria o segundo.
    if (erroAvaliacao.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { erro: 'Esta solicitação já foi avaliada.' },
        { status: 409 }
      );
    }

    console.error('[avaliacoes POST]', erroAvaliacao);
    return NextResponse.json(
      { erro: 'Não foi possível registrar a avaliação.' },
      { status: 500 }
    );
  }
}
