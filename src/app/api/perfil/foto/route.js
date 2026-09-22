import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { obterClienteLogado, obterFornecedorLogado } from '@/lib/autorizacao';
import { salvarImagem, removerImagem } from '@/lib/imagens-servidor';

// RF001 / RF002 / RF004 — foto de perfil do usuário logado.
//   POST    envia ou troca a foto (multipart/form-data, campo "foto")
//   DELETE  remove a foto
//
// A foto é do usuário que está logado; nenhuma rota recebe id de usuário.

async function usuarioLogado() {
  const sessao = await lerSessao();
  if (!sessao) {
    return { erro: NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 }) };
  }

  // Cada papel passa pela própria guarda, que confere o status no banco:
  // conta suspensa não troca foto.
  if (sessao.tipoUsuario === 'fornecedor') {
    const { erro, idUsuario, fornecedor } = await obterFornecedorLogado();
    if (erro) return { erro };
    return { idUsuario, fornecedor };
  }

  const { erro, idUsuario } = await obterClienteLogado();
  if (erro) return { erro };
  return { idUsuario, fornecedor: null };
}

// RN067 — a foto de perfil é dado da vitrine do fornecedor: trocá-la ou
// removê-la devolve o perfil à verificação. O motivo de rejeição anterior é
// preservado. Para o cliente não existe verificação, então nada acontece.
async function devolverParaVerificacao(conexao, fornecedor, idUsuario) {
  if (!fornecedor) return false;
  await conexao.execute(
    `UPDATE fornecedor SET status_verificacao = 'pendente' WHERE id_usuario = ?`,
    [idUsuario]
  );
  return fornecedor.status_verificacao === 'aprovado';
}

export async function POST(request) {
  const { erro, idUsuario, fornecedor } = await usuarioLogado();
  if (erro) return erro;

  let formulario;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const salvo = await salvarImagem(formulario.get('foto'));
  if (salvo.erro) {
    return NextResponse.json({ erro: salvo.erro }, { status: 400 });
  }

  const conexao = await pool.getConnection();
  let urlAnterior = null;
  let voltouParaVerificacao = false;
  try {
    await conexao.beginTransaction();

    const [linhas] = await conexao.execute(
      'SELECT foto_perfil FROM usuario WHERE id = ? LIMIT 1',
      [idUsuario]
    );
    urlAnterior = linhas[0]?.foto_perfil ?? null;

    await conexao.execute(
      'UPDATE usuario SET foto_perfil = ? WHERE id = ?',
      [salvo.url, idUsuario]
    );

    voltouParaVerificacao = await devolverParaVerificacao(conexao, fornecedor, idUsuario);
    await conexao.commit();
  } catch (erroEnvio) {
    await conexao.rollback();
    // A nova imagem já foi gravada; sem o registro no banco ela ficaria órfã.
    await removerImagem(salvo.url);
    console.error('[perfil/foto POST]', erroEnvio);
    return NextResponse.json({ erro: 'Não foi possível salvar a foto.' }, { status: 500 });
  } finally {
    conexao.release();
  }

  // A foto antiga só sai do disco depois que o banco confirmou a troca.
  if (urlAnterior) await removerImagem(urlAnterior);

  return NextResponse.json({ fotoPerfil: salvo.url, voltouParaVerificacao }, { status: 201 });
}

export async function DELETE() {
  const { erro, idUsuario, fornecedor } = await usuarioLogado();
  if (erro) return erro;

  const conexao = await pool.getConnection();
  let urlAnterior = null;
  let voltouParaVerificacao = false;
  try {
    await conexao.beginTransaction();

    const [linhas] = await conexao.execute(
      'SELECT foto_perfil FROM usuario WHERE id = ? LIMIT 1',
      [idUsuario]
    );
    urlAnterior = linhas[0]?.foto_perfil ?? null;

    if (!urlAnterior) {
      await conexao.rollback();
      return NextResponse.json({ erro: 'Não há foto para remover.' }, { status: 409 });
    }

    await conexao.execute('UPDATE usuario SET foto_perfil = NULL WHERE id = ?', [idUsuario]);
    voltouParaVerificacao = await devolverParaVerificacao(conexao, fornecedor, idUsuario);
    await conexao.commit();
  } catch (erroRemocao) {
    await conexao.rollback();
    console.error('[perfil/foto DELETE]', erroRemocao);
    return NextResponse.json({ erro: 'Não foi possível remover a foto.' }, { status: 500 });
  } finally {
    conexao.release();
  }

  await removerImagem(urlAnterior);
  return NextResponse.json({ fotoPerfil: null, voltouParaVerificacao });
}
