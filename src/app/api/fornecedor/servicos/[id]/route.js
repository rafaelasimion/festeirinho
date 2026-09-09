import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterFornecedorLogado } from '@/lib/autorizacao';
import { validarServico } from '@/lib/servico';

// A pasta [id] torna o trecho da URL um parâmetro: /api/fornecedor/servicos/7
// chega aqui com params.id = '7'.

// Confere que o serviço existe E pertence a quem está logado. Sem essa
// conferência, trocar o número na URL editaria o serviço de outro
// fornecedor.
async function obterServicoDoFornecedor(idServico, idFornecedor) {
  const [linhas] = await pool.execute(
    `SELECT id, nome, descricao, id_categoria, preco_base,
            status_servico, status_verificacao
       FROM servico
      WHERE id = ? AND id_fornecedor = ?
      LIMIT 1`,
    [idServico, idFornecedor]
  );
  return linhas[0] ?? null;
}

export async function PUT(request, { params }) {
  const { erro, fornecedor } = await obterFornecedorLogado();
  if (erro) return erro;

  const { id } = await params;
  const idServico = Number(id);
  if (!Number.isInteger(idServico)) {
    return NextResponse.json({ erro: 'Serviço inválido.' }, { status: 400 });
  }

  const atual = await obterServicoDoFornecedor(idServico, fornecedor.id);
  if (!atual) {
    return NextResponse.json({ erro: 'Serviço não encontrado.' }, { status: 404 });
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const { erros, dados } = await validarServico(corpo);
  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  // RN067 — mudar nome, descrição, categoria ou preço base devolve o
  // serviço para verificação. E aqui o efeito é mais forte que no perfil
  // do fornecedor: o serviço deixa de ser exibido aos clientes até a nova
  // aprovação, sem versão anterior mantida no ar.
  const mudouDadoRelevante =
    atual.nome !== dados.nome ||
    atual.descricao !== dados.descricao ||
    atual.id_categoria !== dados.idCategoria ||
    Number(atual.preco_base) !== dados.precoBase;

  const novoStatusVerificacao = mudouDadoRelevante ? 'pendente' : atual.status_verificacao;

  try {
    await pool.execute(
      `UPDATE servico
          SET nome = ?, descricao = ?, id_categoria = ?, id_cobranca = ?,
              preco_base = ?, capacidade_max = ?, dias_antecedencia = ?,
              status_verificacao = ?
        WHERE id = ? AND id_fornecedor = ?`,
      [
        dados.nome, dados.descricao, dados.idCategoria, dados.idCobranca,
        dados.precoBase, dados.capacidadeMax, dados.diasAntecedencia,
        novoStatusVerificacao,
        idServico, fornecedor.id,
      ]
    );

    return NextResponse.json({
      statusVerificacao: novoStatusVerificacao,
      voltouParaVerificacao: mudouDadoRelevante && atual.status_verificacao !== 'pendente',
    });
  } catch (erro) {
    console.error('[servicos PUT]', erro);
    return NextResponse.json({ erro: 'Não foi possível salvar o serviço.' }, { status: 500 });
  }
}

// Inativar é a "exclusão" possível: o serviço pode estar amarrado a
// solicitações, avaliações e favoritos por chave estrangeira RESTRICT, e
// apagar a linha quebraria esse histórico. Inativado, ele some da vitrine
// e continua íntegro nos registros antigos.
export async function PATCH(request, { params }) {
  const { erro, fornecedor } = await obterFornecedorLogado();
  if (erro) return erro;

  const { id } = await params;
  const idServico = Number(id);
  if (!Number.isInteger(idServico)) {
    return NextResponse.json({ erro: 'Serviço inválido.' }, { status: 400 });
  }

  const servico = await obterServicoDoFornecedor(idServico, fornecedor.id);
  if (!servico) {
    return NextResponse.json({ erro: 'Serviço não encontrado.' }, { status: 404 });
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const acao = String(corpo.acao ?? '');
  if (acao !== 'inativar' && acao !== 'reativar') {
    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 });
  }

  const novoStatus = acao === 'inativar' ? 'inativo' : 'ativo';

  try {
    await pool.execute(
      'UPDATE servico SET status_servico = ? WHERE id = ? AND id_fornecedor = ?',
      [novoStatus, idServico, fornecedor.id]
    );
    return NextResponse.json({ statusServico: novoStatus });
  } catch (erro) {
    console.error('[servicos PATCH]', erro);
    return NextResponse.json({ erro: 'Não foi possível alterar o serviço.' }, { status: 500 });
  }
}