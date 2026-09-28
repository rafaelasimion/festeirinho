import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterFornecedorLogado } from '@/lib/autorizacao';
import { validarURL } from '@/lib/validacao';
import { mudouDadoDaVitrine } from '@/lib/fornecedor';

// RF004 — edição dos dados que o fornecedor exibe na vitrine, a partir da
// própria vitrine.
//
// Existe separado do PUT /api/fornecedor/perfil porque aquele governa a
// conta inteira (nome do responsável, telefone, cidade, documento, raio) e
// exige todos os campos juntos. O painel da vitrine mexe em cinco campos e
// não deveria precisar carregar CPF para trocar a descrição.
//
// A regra da RN067 é a mesma nos dois, e por isso mora em lib/fornecedor.

export async function PATCH(request) {
  const { erro, idUsuario, fornecedor } = await obterFornecedorLogado();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const dados = {
    nomeExibicao: String(corpo.nomeExibicao ?? '').trim(),
    descricao: String(corpo.descricao ?? '').trim(),
    instagramUrl: String(corpo.instagramUrl ?? '').trim(),
    whatsappUrl: String(corpo.whatsappUrl ?? '').trim(),
    site: String(corpo.site ?? '').trim(),
  };

  const erros = {};
  if (dados.nomeExibicao.length < 2 || dados.nomeExibicao.length > 150)
    erros.nomeExibicao = 'Informe o nome que aparece na vitrine.';
  if (dados.descricao.length < 20)
    erros.descricao = 'Descreva seu trabalho em ao menos 20 caracteres.';
  if (!validarURL(dados.instagramUrl)) erros.instagramUrl = 'Endereço inválido.';
  if (!validarURL(dados.whatsappUrl)) erros.whatsappUrl = 'Endereço inválido.';
  if (!validarURL(dados.site)) erros.site = 'Endereço inválido.';

  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  try {
    const [linhas] = await pool.execute(
      `SELECT nome_exibicao, descricao, instagram_url, whatsapp_url, site
         FROM fornecedor WHERE id_usuario = ? LIMIT 1`,
      [idUsuario]
    );

    if (linhas.length === 0) {
      return NextResponse.json({ erro: 'Fornecedor não encontrado.' }, { status: 404 });
    }

    // RN067 — só devolve para verificação quando algo mudou de verdade.
    // Salvar sem alterar nada não pode tirar ninguém do ar.
    const mudou = mudouDadoDaVitrine(linhas[0], dados);
    const novoStatus = mudou ? 'pendente' : fornecedor.status_verificacao;

    await pool.execute(
      `UPDATE fornecedor
          SET nome_exibicao = ?, descricao = ?,
              instagram_url = ?, whatsapp_url = ?, site = ?,
              status_verificacao = ?
        WHERE id_usuario = ?`,
      [
        dados.nomeExibicao, dados.descricao,
        dados.instagramUrl || null, dados.whatsappUrl || null, dados.site || null,
        novoStatus,
        idUsuario,
      ]
    );

    return NextResponse.json({
      statusVerificacao: novoStatus,
      voltouParaVerificacao: mudou && fornecedor.status_verificacao !== 'pendente',
    });
  } catch (falha) {
    console.error('[fornecedor/vitrine PATCH]', falha);
    return NextResponse.json(
      { erro: 'Não foi possível salvar os dados da vitrine.' },
      { status: 500 }
    );
  }
}
