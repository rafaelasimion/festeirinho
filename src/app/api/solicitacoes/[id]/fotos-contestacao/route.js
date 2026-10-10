import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { paraSerializar } from '@/lib/datas';
import { LIMITE_FOTOS_CONTESTACAO } from '@/lib/contestacao';
import {
  parteDaContestacao,
  salvarFotoContestacao,
  removerArquivosContestacao,
} from '@/lib/fotos-contestacao-servidor';

// RF069-B / UC 046 — fotos que cada parte anexa à contestação pendente.
//   GET     as fotos de quem pede (cada parte vê só as suas)
//   POST    anexa uma foto (multipart/form-data, campo "foto")
//   DELETE  remove uma foto própria   ?idFoto=...
//
// Só enquanto a contestação estiver pendente: decidida, as fotos já foram
// apagadas junto com a decisão (RN069).

const NAO_PENDENTE = 'A contestação desta solicitação não está pendente: não há mais fotos a anexar.';

export async function GET(request, { params }) {
  const { erro, idSolicitacao, papel, pendente } = await parteDaContestacao(params);
  if (erro) return erro;

  const [fotos] = await pool.execute(
    `SELECT id, imagem_url, data_envio FROM foto_contestacao
      WHERE id_solicitacao = ? AND enviado_por = ?
      ORDER BY id`,
    [idSolicitacao, papel]
  );

  return NextResponse.json({
    pendente,
    limite: LIMITE_FOTOS_CONTESTACAO,
    fotos: fotos.map((f) => ({ ...f, data_envio: paraSerializar(f.data_envio) })),
  });
}

export async function POST(request, { params }) {
  const { erro, idSolicitacao, papel, pendente } = await parteDaContestacao(params);
  if (erro) return erro;

  if (!pendente) {
    return NextResponse.json({ erro: NAO_PENDENTE }, { status: 409 });
  }

  let formulario;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const salvo = await salvarFotoContestacao(formulario.get('foto'));
  if (salvo.erro) {
    return NextResponse.json({ erro: salvo.erro }, { status: 400 });
  }

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    // A linha da solicitação fica travada até o commit. É o que impede a
    // foto de entrar no meio da decisão da administração: a decisão grava a
    // mesma linha, então uma espera a outra. Se a decisão vier primeiro,
    // esta leitura já encontra a contestação analisada e recusa o envio;
    // se o envio vier primeiro, a decisão apaga a foto junto com as outras.
    const [linhas] = await conexao.execute(
      'SELECT status_contestacao FROM solicitacao WHERE id = ? FOR UPDATE',
      [idSolicitacao]
    );
    if (linhas[0]?.status_contestacao !== 'pendente') {
      await conexao.rollback();
      await removerArquivosContestacao([salvo.url]);
      return NextResponse.json({ erro: NAO_PENDENTE }, { status: 409 });
    }

    // Contado com a linha travada: dois envios simultâneos da mesma pessoa
    // esperam um pelo outro e não passam juntos do limite.
    const [contagem] = await conexao.execute(
      `SELECT COUNT(*) AS total FROM foto_contestacao
        WHERE id_solicitacao = ? AND enviado_por = ?`,
      [idSolicitacao, papel]
    );
    if (Number(contagem[0].total) >= LIMITE_FOTOS_CONTESTACAO) {
      await conexao.rollback();
      await removerArquivosContestacao([salvo.url]);
      return NextResponse.json(
        { erro: `Você já anexou ${LIMITE_FOTOS_CONTESTACAO} fotos. Remova uma para enviar outra.` },
        { status: 409 }
      );
    }

    const [resultado] = await conexao.execute(
      `INSERT INTO foto_contestacao (id_solicitacao, enviado_por, imagem_url)
       VALUES (?, ?, ?)`,
      [idSolicitacao, papel, salvo.url]
    );

    await conexao.commit();
    return NextResponse.json(
      { id: resultado.insertId, imagem_url: salvo.url },
      { status: 201 }
    );
  } catch (erroEnvio) {
    await conexao.rollback();
    // O arquivo já foi gravado; sem a linha no banco ele ficaria órfão.
    await removerArquivosContestacao([salvo.url]);
    console.error('[fotos-contestacao POST]', erroEnvio);
    return NextResponse.json({ erro: 'Não foi possível enviar a foto.' }, { status: 500 });
  } finally {
    conexao.release();
  }
}

export async function DELETE(request, { params }) {
  const { erro, idSolicitacao, papel } = await parteDaContestacao(params);
  if (erro) return erro;

  const idFoto = Number(new URL(request.url).searchParams.get('idFoto'));
  if (!Number.isInteger(idFoto)) {
    return NextResponse.json({ erro: 'Foto inválida.' }, { status: 400 });
  }

  const conexao = await pool.getConnection();
  let urlRemovida = null;
  try {
    await conexao.beginTransaction();

    const [linhas] = await conexao.execute(
      'SELECT status_contestacao FROM solicitacao WHERE id = ? FOR UPDATE',
      [idSolicitacao]
    );
    if (linhas[0]?.status_contestacao !== 'pendente') {
      await conexao.rollback();
      return NextResponse.json({ erro: NAO_PENDENTE }, { status: 409 });
    }

    // A foto precisa ser desta solicitação E desta parte: o fornecedor não
    // remove a foto do cliente, nem o contrário.
    const [foto] = await conexao.execute(
      `SELECT imagem_url FROM foto_contestacao
        WHERE id = ? AND id_solicitacao = ? AND enviado_por = ?
        LIMIT 1`,
      [idFoto, idSolicitacao, papel]
    );
    if (foto.length === 0) {
      await conexao.rollback();
      return NextResponse.json({ erro: 'Foto não encontrada.' }, { status: 404 });
    }

    await conexao.execute('DELETE FROM foto_contestacao WHERE id = ?', [idFoto]);
    urlRemovida = foto[0].imagem_url;
    await conexao.commit();
  } catch (erroRemocao) {
    await conexao.rollback();
    console.error('[fotos-contestacao DELETE]', erroRemocao);
    return NextResponse.json({ erro: 'Não foi possível remover a foto.' }, { status: 500 });
  } finally {
    conexao.release();
  }

  // O arquivo só sai do disco depois que o banco confirmou.
  await removerArquivosContestacao([urlRemovida]);
  return NextResponse.json({ removida: idFoto });
}
