import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterClienteLogado } from '@/lib/autorizacao';

// RF032-B / UC 029 — remoção de cartão cadastrado.
//
// A remoção é LÓGICA: status vira 'removido' e a linha fica. O
// pagamento aponta para o cartão por chave estrangeira RESTRICT, então
// apagar a linha quebraria o histórico de quem já pagou com ele — e o
// comprovante (UC 034) precisa desse histórico intacto.

export async function DELETE(request, { params }) {
  const { erro, cliente } = await obterClienteLogado();
  if (erro) return erro;

  const { id } = await params;
  const idCartao = Number(id);
  if (!Number.isInteger(idCartao)) {
    return NextResponse.json({ erro: 'Cartão inválido.' }, { status: 400 });
  }

  try {
    // O cartão precisa ser DESTE cliente. Sem esta conferência, trocar o
    // número na URL removeria o cartão de outra pessoa.
    const [cartoes] = await pool.execute(
      `SELECT id FROM cartao_credito
        WHERE id = ? AND id_cliente = ? AND status = 'ativo'
        LIMIT 1`,
      [idCartao, cliente.id]
    );

    if (cartoes.length === 0) {
      return NextResponse.json({ erro: 'Cartão não encontrado.' }, { status: 404 });
    }

    // UC 029, passo 5 e fluxo 5a — a trava. Um cartão preso a um
    // pagamento em andamento não pode sumir do meio do caminho.
    const [emUso] = await pool.execute(
      `SELECT 1 FROM pagamento
        WHERE id_cartao_credito = ? AND status IN ('pendente', 'processando')
        LIMIT 1`,
      [idCartao]
    );

    if (emUso.length > 0) {
      return NextResponse.json(
        {
          erro: 'Este cartão está em uso em um pagamento em andamento e não '
            + 'pode ser removido agora.',
        },
        { status: 409 }
      );
    }

    await pool.execute(
      `UPDATE cartao_credito SET status = 'removido'
        WHERE id = ? AND id_cliente = ?`,
      [idCartao, cliente.id]
    );

    return NextResponse.json({ removido: true });
  } catch (falha) {
    console.error('[cartoes DELETE]', falha.code ?? 'erro desconhecido');
    return NextResponse.json(
      { erro: 'Não foi possível remover o cartão.' },
      { status: 500 }
    );
  }
}
