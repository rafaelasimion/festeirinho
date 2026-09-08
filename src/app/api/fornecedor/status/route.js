import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterFornecedorLogado } from '@/lib/autorizacao';

// Pausar é a ação de saída que o próprio fornecedor controla: ele deixa
// de aparecer para novos clientes sem perder o cadastro, os serviços ou
// o histórico. Suspensão é ação da administração; exclusão de conta é
// outro fluxo (RN044) e não passa por aqui.

export async function PATCH(request) {
  const { erro, idUsuario, fornecedor } = await obterFornecedorLogado();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const acao = String(corpo.acao ?? '');
  if (acao !== 'pausar' && acao !== 'reativar') {
    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 });
  }

  const novoStatus = acao === 'pausar' ? 'pausado' : 'ativo';

  if (fornecedor.status_fornecedor === novoStatus) {
    return NextResponse.json({ statusFornecedor: novoStatus });
  }

  try {
    await pool.execute(
      'UPDATE fornecedor SET status_fornecedor = ? WHERE id_usuario = ?',
      [novoStatus, idUsuario]
    );
    return NextResponse.json({ statusFornecedor: novoStatus });
  } catch (erro) {
    console.error('[fornecedor/status PATCH]', erro);
    return NextResponse.json(
      { erro: 'Não foi possível alterar o status.' },
      { status: 500 }
    );
  }
}
