import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { calcularAntecedenciaMinimaDias } from '@/lib/configuracao';

// Listas de domínio usadas pelos formulários. São dados públicos do
// catálogo, então não exigem login — a busca do cliente vai reaproveitar
// esta mesma rota.

export async function GET() {
  try {
    const [categorias] = await pool.query(
      'SELECT id, nome FROM categoria ORDER BY nome'
    );
    const [cobrancas] = await pool.query(
      'SELECT id, descricao FROM cobranca ORDER BY id'
    );
    const antecedenciaMinimaDias = await calcularAntecedenciaMinimaDias();

    return NextResponse.json({ categorias, cobrancas, antecedenciaMinimaDias });
  } catch (erro) {
    console.error('[opcoes]', erro);
    return NextResponse.json({ erro: 'Não foi possível carregar as opções.' }, { status: 500 });
  }
}