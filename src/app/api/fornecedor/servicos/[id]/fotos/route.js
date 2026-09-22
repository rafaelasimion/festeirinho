import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterFornecedorLogado } from '@/lib/autorizacao';
import { salvarImagem, removerImagem } from '@/lib/imagens-servidor';

// RF012 — fotos do serviço.
//   GET     lista as fotos
//   POST    envia uma foto (multipart/form-data, campo "foto")
//   PATCH   define a foto principal   { idFoto }
//   DELETE  remove uma foto           ?idFoto=...

// Confere que o serviço existe e é DESTE fornecedor.
async function servicoDoFornecedor(idServico, idFornecedor) {
  const [linhas] = await pool.execute(
    'SELECT id, status_verificacao FROM servico WHERE id = ? AND id_fornecedor = ? LIMIT 1',
    [idServico, idFornecedor]
  );
  return linhas[0] ?? null;
}

async function contexto(params) {
  const { erro, fornecedor } = await obterFornecedorLogado();
  if (erro) return { erro };

  const { id } = await params;
  const idServico = Number(id);
  if (!Number.isInteger(idServico)) {
    return { erro: NextResponse.json({ erro: 'Serviço inválido.' }, { status: 400 }) };
  }

  const servico = await servicoDoFornecedor(idServico, fornecedor.id);
  if (!servico) {
    return { erro: NextResponse.json({ erro: 'Serviço não encontrado.' }, { status: 404 }) };
  }
  return { idServico, servico };
}

// RF012 / RN067 — incluir ou remover foto é alteração de campo relevante: o
// serviço volta à análise e sai da vitrine até a nova aprovação. O motivo de
// uma rejeição anterior é preservado, como no restante da RN067.
async function devolverParaAnalise(conexao, idServico) {
  await conexao.execute(
    `UPDATE servico SET status_verificacao = 'pendente' WHERE id = ?`,
    [idServico]
  );
}

export async function GET(request, { params }) {
  const { erro, idServico } = await contexto(params);
  if (erro) return erro;

  const [fotos] = await pool.execute(
    `SELECT id, imagem_url, principal FROM foto_servico
      WHERE id_servico = ? ORDER BY principal DESC, id`,
    [idServico]
  );
  return NextResponse.json(fotos.map((f) => ({ ...f, principal: Boolean(f.principal) })));
}

export async function POST(request, { params }) {
  const { erro, idServico, servico } = await contexto(params);
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
  try {
    await conexao.beginTransaction();

    // RF012 — havendo foto, exatamente uma é a principal. A primeira
    // enviada assume esse papel sozinha.
    const [existentes] = await conexao.execute(
      'SELECT COUNT(*) AS total FROM foto_servico WHERE id_servico = ?',
      [idServico]
    );
    const primeira = Number(existentes[0].total) === 0;

    const [resultado] = await conexao.execute(
      'INSERT INTO foto_servico (id_servico, imagem_url, principal) VALUES (?, ?, ?)',
      [idServico, salvo.url, primeira]
    );

    await devolverParaAnalise(conexao, idServico);
    await conexao.commit();

    return NextResponse.json({
      id: resultado.insertId,
      imagem_url: salvo.url,
      principal: primeira,
      voltouParaVerificacao: servico.status_verificacao === 'aprovado',
    }, { status: 201 });
  } catch (erroEnvio) {
    await conexao.rollback();
    // O arquivo já foi gravado no disco; sem o registro no banco ele ficaria
    // órfão, então é apagado.
    await removerImagem(salvo.url);
    console.error('[servicos/fotos POST]', erroEnvio);
    return NextResponse.json({ erro: 'Não foi possível enviar a foto.' }, { status: 500 });
  } finally {
    conexao.release();
  }
}

export async function PATCH(request, { params }) {
  const { erro, idServico } = await contexto(params);
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const idFoto = Number(corpo.idFoto);
  if (!Number.isInteger(idFoto)) {
    return NextResponse.json({ erro: 'Foto inválida.' }, { status: 400 });
  }

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [foto] = await conexao.execute(
      'SELECT id FROM foto_servico WHERE id = ? AND id_servico = ? LIMIT 1',
      [idFoto, idServico]
    );
    if (foto.length === 0) {
      await conexao.rollback();
      return NextResponse.json({ erro: 'Foto não encontrada.' }, { status: 404 });
    }

    // RF012 — a nova principal tira a marca da anterior. A ORDEM importa:
    // a uk_foto_principal só admite uma principal por serviço, então é
    // preciso desmarcar a antiga ANTES de marcar a nova. Na ordem inversa,
    // por um instante haveria duas, e o banco recusaria.
    //
    // Trocar a capa não devolve o serviço à análise: nenhuma foto entrou ou
    // saiu, e todas já foram vistas pela administração.
    await conexao.execute(
      'UPDATE foto_servico SET principal = FALSE WHERE id_servico = ? AND principal = TRUE',
      [idServico]
    );
    await conexao.execute(
      'UPDATE foto_servico SET principal = TRUE WHERE id = ?',
      [idFoto]
    );

    await conexao.commit();
    return NextResponse.json({ principal: idFoto });
  } catch (erroPrincipal) {
    await conexao.rollback();
    console.error('[servicos/fotos PATCH]', erroPrincipal);
    return NextResponse.json({ erro: 'Não foi possível definir a foto principal.' }, { status: 500 });
  } finally {
    conexao.release();
  }
}

export async function DELETE(request, { params }) {
  const { erro, idServico, servico } = await contexto(params);
  if (erro) return erro;

  const idFoto = Number(new URL(request.url).searchParams.get('idFoto'));
  if (!Number.isInteger(idFoto)) {
    return NextResponse.json({ erro: 'Foto inválida.' }, { status: 400 });
  }

  const conexao = await pool.getConnection();
  let urlRemovida = null;
  try {
    await conexao.beginTransaction();

    const [foto] = await conexao.execute(
      'SELECT id, imagem_url, principal FROM foto_servico WHERE id = ? AND id_servico = ? LIMIT 1',
      [idFoto, idServico]
    );
    if (foto.length === 0) {
      await conexao.rollback();
      return NextResponse.json({ erro: 'Foto não encontrada.' }, { status: 404 });
    }

    await conexao.execute('DELETE FROM foto_servico WHERE id = ?', [idFoto]);
    urlRemovida = foto[0].imagem_url;

    // RF012 — se a removida era a principal e ainda sobram fotos, a mais
    // antiga assume. Nunca fica um serviço com foto e sem principal.
    if (foto[0].principal) {
      const [restantes] = await conexao.execute(
        'SELECT id FROM foto_servico WHERE id_servico = ? ORDER BY id LIMIT 1',
        [idServico]
      );
      if (restantes.length > 0) {
        await conexao.execute(
          'UPDATE foto_servico SET principal = TRUE WHERE id = ?',
          [restantes[0].id]
        );
      }
    }

    await devolverParaAnalise(conexao, idServico);
    await conexao.commit();
  } catch (erroRemocao) {
    await conexao.rollback();
    console.error('[servicos/fotos DELETE]', erroRemocao);
    return NextResponse.json({ erro: 'Não foi possível remover a foto.' }, { status: 500 });
  } finally {
    conexao.release();
  }

  // O arquivo só é apagado depois que o banco confirmou. Se a transação
  // falhasse, o registro continuaria apontando para uma imagem que existe.
  await removerImagem(urlRemovida);

  return NextResponse.json({
    removida: idFoto,
    voltouParaVerificacao: servico.status_verificacao === 'aprovado',
  });
}
