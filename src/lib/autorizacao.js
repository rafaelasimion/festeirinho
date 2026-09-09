import { NextResponse } from 'next/server';
import { lerSessao } from '@/lib/sessao';
import { pool } from '@/lib/db';

// Toda rota protegida começa por aqui.
//
// Repare que o status é consultado no banco a CADA requisição, e não lido
// do token. O token diz quem é o usuário; se a administração suspender a
// conta agora, a sessão aberta no navegador dele continuaria válida — é
// esta consulta que barra o acesso no instante seguinte.

export async function obterFornecedorLogado() {
  const sessao = await lerSessao();

  if (!sessao) {
    return { erro: NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 }) };
  }

  if (sessao.tipoUsuario !== 'fornecedor') {
    return { erro: NextResponse.json({ erro: 'Acesso restrito a fornecedores.' }, { status: 403 }) };
  }

  const [linhas] = await pool.execute(
    `SELECT id, tipo_pessoa, status_fornecedor, status_verificacao
       FROM fornecedor
      WHERE id_usuario = ?
      LIMIT 1`,
    [sessao.id]
  );

  if (linhas.length === 0) {
    return { erro: NextResponse.json({ erro: 'Fornecedor não encontrado.' }, { status: 403 }) };
  }

  const fornecedor = linhas[0];

  if (fornecedor.status_fornecedor === 'suspenso' || fornecedor.status_fornecedor === 'excluido') {
    return { erro: NextResponse.json({ erro: 'Conta indisponível.' }, { status: 403 }) };
  }

  return { idUsuario: sessao.id, fornecedor };
}

// RN030 — fornecedor não contrata como fornecedor: quem envia solicitação
// é sempre um cliente.
export async function obterClienteLogado() {
  const sessao = await lerSessao();

  if (!sessao) {
    return { erro: NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 }) };
  }

  if (sessao.tipoUsuario !== 'cliente') {
    return { erro: NextResponse.json({ erro: 'Acesso restrito a clientes.' }, { status: 403 }) };
  }

  const [linhas] = await pool.execute(
    'SELECT id, status_cliente FROM cliente WHERE id_usuario = ? LIMIT 1',
    [sessao.id]
  );

  if (linhas.length === 0) {
    return { erro: NextResponse.json({ erro: 'Cliente não encontrado.' }, { status: 403 }) };
  }

  const cliente = linhas[0];

  if (cliente.status_cliente === 'suspenso' || cliente.status_cliente === 'excluido') {
    return { erro: NextResponse.json({ erro: 'Conta indisponível.' }, { status: 403 }) };
  }

  return { idUsuario: sessao.id, cliente };
}