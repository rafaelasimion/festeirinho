import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterClienteLogado } from '@/lib/autorizacao';

// RF015 / RF016 — favoritar serviço e fornecedor.
//
// Favoritar é ação de cliente: o fornecedor navega na vitrine (RN030), mas
// não contrata nem guarda favoritos.
//
//   POST    favorita    { tipo, id }
//   DELETE  desfavorita ?tipo=servico&id=7

const TIPOS = ['servico', 'fornecedor'];

// RN003 — o favorito referencia exatamente um item. A coluna que fica nula
// é decidida aqui, e não por quem chama.
function colunas(tipo, id) {
  return tipo === 'servico'
    ? { idServico: id, idFornecedor: null }
    : { idServico: null, idFornecedor: id };
}

// O alvo precisa existir e estar visível ao cliente: favoritar um serviço
// inativo ou de fornecedor indisponível criaria um item morto na lista.
async function alvoExiste(tipo, id) {
  if (tipo === 'servico') {
    const [linhas] = await pool.execute(
      `SELECT s.id FROM servico s
         JOIN fornecedor f ON f.id = s.id_fornecedor
        WHERE s.id = ?
          AND s.status_servico = 'ativo'
          AND s.status_verificacao = 'aprovado'
          AND f.status_fornecedor = 'ativo'
        LIMIT 1`,
      [id]
    );
    return linhas.length > 0;
  }
  const [linhas] = await pool.execute(
    `SELECT id FROM fornecedor WHERE id = ? AND status_fornecedor = 'ativo' LIMIT 1`,
    [id]
  );
  return linhas.length > 0;
}

export async function POST(request) {
  const { erro, cliente } = await obterClienteLogado();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const tipo = String(corpo.tipo ?? '');
  const id = Number(corpo.id);

  if (!TIPOS.includes(tipo) || !Number.isInteger(id)) {
    return NextResponse.json({ erro: 'Item inválido.' }, { status: 400 });
  }
  if (!(await alvoExiste(tipo, id))) {
    return NextResponse.json({ erro: 'Item não encontrado.' }, { status: 404 });
  }

  const { idServico, idFornecedor } = colunas(tipo, id);

  try {
    await pool.execute(
      `INSERT INTO favorito (id_cliente, tipo_favorito, id_servico, id_fornecedor)
       VALUES (?, ?, ?, ?)`,
      [cliente.id, tipo, idServico, idFornecedor]
    );
    return NextResponse.json({ favorito: true }, { status: 201 });
  } catch (erroGravacao) {
    // RN004 — favoritar duas vezes é a mesma coisa que favoritar uma. Um
    // clique duplo não deve virar erro na cara do usuário.
    if (erroGravacao.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ favorito: true });
    }
    console.error('[favoritos POST]', erroGravacao);
    return NextResponse.json({ erro: 'Não foi possível favoritar.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { erro, cliente } = await obterClienteLogado();
  if (erro) return erro;

  const parametros = new URL(request.url).searchParams;
  const tipo = String(parametros.get('tipo') ?? '');
  const id = Number(parametros.get('id'));

  if (!TIPOS.includes(tipo) || !Number.isInteger(id)) {
    return NextResponse.json({ erro: 'Item inválido.' }, { status: 400 });
  }

  const coluna = tipo === 'servico' ? 'id_servico' : 'id_fornecedor';

  try {
    // O id_cliente no WHERE é o que impede alguém de remover o favorito de
    // outra pessoa trocando o número na requisição.
    await pool.execute(
      `DELETE FROM favorito WHERE id_cliente = ? AND ${coluna} = ?`,
      [cliente.id, id]
    );
    return NextResponse.json({ favorito: false });
  } catch (erroRemocao) {
    console.error('[favoritos DELETE]', erroRemocao);
    return NextResponse.json({ erro: 'Não foi possível desfavoritar.' }, { status: 500 });
  }
}
