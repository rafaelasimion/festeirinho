import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterAdministradorLogado } from '@/lib/sessao-admin';
import { registrarCancelamento } from '@/lib/cancelamento-servidor';
import { notificar, partesDaSolicitacao } from '@/lib/notificacao-servidor';
import {
  apagarFotosDaContestacao,
  removerArquivosContestacao,
} from '@/lib/fotos-contestacao-servidor';

// UC 043 / RF070 — análise da contestação de conclusão pelo administrador.
//
// RN069 — as fotos anexadas pelas partes (RF069-B) são apagadas na MESMA
// transação que grava a decisão, nos dois desfechos. Elas só existiam para
// esta análise; decidida a contestação, a finalidade acabou (LGPD, art. 6º,
// III). Os arquivos saem do disco depois do commit.

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
      // Uma instrução virou duas — a decisão e a remoção das fotos —, então
      // agora há transação: as duas vivem ou morrem juntas (RNF007).
      const conexao = await pool.getConnection();
      let fotosApagadas = [];
      try {
        await conexao.beginTransaction();

        // UC 043, etapa 5 — a data da análise VIRA a data de confirmação da
        // conclusão. É esse marco que inicia a carência do repasse (RN056) e
        // habilita a avaliação (RN006).
        const [retorno] = await conexao.execute(
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

        // Outra aba do painel decidiu primeiro: nada a avisar.
        if (retorno.affectedRows === 0) {
          await conexao.rollback();
          return NextResponse.json(
            { erro: 'Esta contestação não está pendente de análise.' },
            { status: 409 }
          );
        }

        fotosApagadas = await apagarFotosDaContestacao(conexao, idSolicitacao);
        await conexao.commit();
      } catch (erroDecisao) {
        await conexao.rollback();
        throw erroDecisao;
      } finally {
        conexao.release();
      }

      await removerArquivosContestacao(fotosApagadas);

      // UC 043 — as duas partes recebem a decisão e a justificativa.
      const partes = await partesDaSolicitacao(idSolicitacao);
      if (partes) {
        await notificar({
          idUsuario: partes.cliente,
          tipo: 'solicitacao',
          titulo: 'Contestação julgada improcedente',
          mensagem: `Sobre ${partes.servico}: ${justificativa}`,
          idSolicitacao,
        });
        await notificar({
          idUsuario: partes.fornecedor,
          tipo: 'solicitacao',
          titulo: 'Contestação resolvida a seu favor',
          mensagem: `A contestação de ${partes.servico} foi julgada improcedente. `
            + 'O serviço consta como concluído e o repasse entra em carência.',
          idSolicitacao,
        });
      }

      return NextResponse.json({ resultado: 'improcedente', status: 'concluido' });
    }

    // UC 043, etapa 6 — procedente: cancelamento com origem "sistema",
    // reembolso integral, sem multa e sem repasse ao fornecedor. Passa pelo
    // mesmo motor que atende o pedido das partes e a ausência de registro.
    //
    // A decisão da contestação é gravada DENTRO da transação do
    // cancelamento (RNF007). Antes eram duas transações em sequência: se a
    // segunda falhasse, a solicitação ficava cancelada com a contestação
    // "pendente" para sempre — reaparecendo no painel sem poder ser
    // decidida, porque já havia cancelamento registrado.
    //
    // As fotos saem dentro da mesma transação (RN069). Os endereços ficam
    // guardados aqui e os arquivos só são apagados se o cancelamento
    // terminar bem: com rollback, as linhas voltam e os arquivos têm de
    // continuar lá.
    let fotosApagadas = [];
    const cancelamento = await registrarCancelamento({
      idSolicitacao,
      solicitadoPor: 'sistema',
      motivo: 'Contestação de conclusão julgada procedente pela administração.',
      complemento: async (conexao) => {
        const [retorno] = await conexao.execute(
          `UPDATE solicitacao
              SET status_contestacao = 'analisada',
                  resultado_contestacao = 'procedente',
                  justificativa_contestacao = ?,
                  data_analise_contestacao = NOW()
            WHERE id = ? AND status_contestacao = 'pendente'`,
          [justificativa, idSolicitacao]
        );
        // Outra aba do painel decidiu primeiro: desfaz o cancelamento junto.
        if (retorno.affectedRows === 0) {
          throw new Error('contestação já analisada');
        }
        fotosApagadas = await apagarFotosDaContestacao(conexao, idSolicitacao);
      },
    });

    if (cancelamento.erro) {
      return NextResponse.json({ erro: cancelamento.erro }, { status: cancelamento.status });
    }

    await removerArquivosContestacao(fotosApagadas);

    // O cancelamento já avisou as duas partes do desfecho financeiro; aqui
    // vai a decisão em si, que é outra informação.
    const partes = await partesDaSolicitacao(idSolicitacao);
    if (partes) {
      await notificar({
        idUsuario: partes.cliente,
        tipo: 'solicitacao',
        titulo: 'Contestação acolhida',
        mensagem: `Sobre ${partes.servico}: ${justificativa}`,
        idSolicitacao,
      });
      await notificar({
        idUsuario: partes.fornecedor,
        tipo: 'solicitacao',
        titulo: 'Contestação julgada procedente',
        mensagem: `A contestação de ${partes.servico} foi acolhida: ${justificativa}`,
        idSolicitacao,
      });
    }

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
