import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterAdministradorLogado } from '@/lib/sessao-admin';
import { registrarCancelamento } from '@/lib/cancelamento-servidor';

// UC 043 / RF070 — análise da contestação de conclusão pelo administrador.

const RESULTADOS = ['procedente', 'improcedente'];

export async function PATCH(request) {
  const { erro } = await obterAdministradorLogado();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const idSolicitacao = Number(corpo.id);
  const resultado = String(corpo.resultado ?? '');
  const justificativa = String(corpo.justificativa ?? '').trim();

  if (!Number.isInteger(idSolicitacao)) {
    return NextResponse.json({ erro: 'Solicitação inválida.' }, { status: 400 });
  }
  if (!RESULTADOS.includes(resultado)) {
    return NextResponse.json({ erro: 'Selecione o resultado da análise.' }, { status: 400 });
  }
  // UC 043, etapa 3 — justificativa obrigatória. Ela é devolvida às duas
  // partes, então precisa explicar a decisão, não só carimbá-la.
  if (justificativa.length < 20) {
    return NextResponse.json(
      { erro: 'Descreva a justificativa em ao menos 20 caracteres.' },
      { status: 400 }
    );
  }
  if (justificativa.length > 1000) {
    return NextResponse.json({ erro: 'Justificativa muito longa.' }, { status: 400 });
  }

  const [linhas] = await pool.execute(
    'SELECT id, status, status_contestacao FROM solicitacao WHERE id = ? LIMIT 1',
    [idSolicitacao]
  );

  if (linhas.length === 0) {
    return NextResponse.json({ erro: 'Solicitação não encontrada.' }, { status: 404 });
  }
  if (linhas[0].status_contestacao !== 'pendente') {
    return NextResponse.json(
      { erro: 'Esta contestação não está pendente de análise.' },
      { status: 409 }
    );
  }

  try {
    // A CHECK da tabela só admite três estados coerentes para a contestação.
    // O estado "analisada" exige resultado, justificativa e data de análise
    // preenchidos — os três na mesma instrução.
    if (resultado === 'improcedente') {
      // UC 043, etapa 5 — a data da análise VIRA a data de confirmação da
      // conclusão. É esse marco que inicia a carência do repasse (RN056) e
      // habilita a avaliação (RN006).
      await pool.execute(
        `UPDATE solicitacao
            SET status_contestacao = 'analisada',
                resultado_contestacao = 'improcedente',
                justificativa_contestacao = ?,
                data_analise_contestacao = NOW(),
                data_confirmacao_conclusao_cliente = NOW(),
                status = 'concluido'
          WHERE id = ? AND status_contestacao = 'pendente'`,
        [justificativa, idSolicitacao]
      );

      return NextResponse.json({ resultado: 'improcedente', status: 'concluido' });
    }

    // UC 043, etapa 6 — procedente: cancelamento com origem "sistema",
    // reembolso integral, sem multa e sem repasse ao fornecedor. Passa pelo
    // mesmo motor que atende o pedido das partes e a ausência de registro.
    //
    // O cancelamento vem PRIMEIRO de propósito. Se ele falhar, a contestação
    // continua pendente e reaparece no painel para nova tentativa. Na ordem
    // inversa, uma falha deixaria a contestação decidida sem cancelamento e
    // sem nada indicando que ficou algo por fazer.
    const cancelamento = await registrarCancelamento({
      idSolicitacao,
      solicitadoPor: 'sistema',
      motivo: 'Contestação de conclusão julgada procedente pela administração.',
    });

    if (cancelamento.erro) {
      return NextResponse.json({ erro: cancelamento.erro }, { status: cancelamento.status });
    }

    await pool.execute(
      `UPDATE solicitacao
          SET status_contestacao = 'analisada',
              resultado_contestacao = 'procedente',
              justificativa_contestacao = ?,
              data_analise_contestacao = NOW()
        WHERE id = ? AND status_contestacao = 'pendente'`,
      [justificativa, idSolicitacao]
    );

    return NextResponse.json({
      resultado: 'procedente',
      status: 'cancelado',
      aguardandoDadosRecebimento: cancelamento.cancelamento.aguardandoDadosRecebimento,
    });
  } catch (erroAnalise) {
    console.error('[admin/contestacoes]', erroAnalise);
    return NextResponse.json(
      { erro: 'Não foi possível registrar a análise.' },
      { status: 500 }
    );
  }
}
