import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterAdministradorLogado } from '@/lib/sessao-admin';

// UC 024 (verificar fornecedor) e UC 025 (moderar serviço).
//
// Uma rota só para os dois: a ação é a mesma — aprovar ou rejeitar uma
// verificação — e muda apenas a tabela. Duas rotas idênticas seriam duas
// cópias da mesma regra para divergirem depois.

const TABELAS = {
  fornecedor: 'fornecedor',
  servico: 'servico',
};

export async function PATCH(request) {
  const { erro } = await obterAdministradorLogado();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const tipo = String(corpo.tipo ?? '');
  const id = Number(corpo.id);
  const acao = String(corpo.acao ?? '');
  const motivoRejeicao = String(corpo.motivoRejeicao ?? '').trim();

  const tabela = TABELAS[tipo];
  if (!tabela) {
    return NextResponse.json({ erro: 'Tipo inválido.' }, { status: 400 });
  }
  if (!Number.isInteger(id)) {
    return NextResponse.json({ erro: 'Registro inválido.' }, { status: 400 });
  }
  if (acao !== 'aprovar' && acao !== 'rejeitar') {
    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 });
  }

  // UC 024/025, 5a.1 — a rejeição exige motivo, que é devolvido ao fornecedor.
  // A CHECK do banco também exige, mas aqui a mensagem é compreensível.
  if (acao === 'rejeitar' && motivoRejeicao.length < 10) {
    return NextResponse.json(
      { erro: 'Descreva o motivo da rejeição em ao menos 10 caracteres.' },
      { status: 400 }
    );
  }

  try {
    if (acao === 'aprovar') {
      // data_verificacao só existe em fornecedor.
      const sql = tabela === 'fornecedor'
        ? `UPDATE fornecedor
              SET status_verificacao = 'aprovado',
                  motivo_rejeicao = NULL,
                  data_verificacao = NOW()
            WHERE id = ?`
        : `UPDATE servico
              SET status_verificacao = 'aprovado',
                  motivo_rejeicao = NULL
            WHERE id = ?`;

      const [resultado] = await pool.execute(sql, [id]);
      if (resultado.affectedRows === 0) {
        return NextResponse.json({ erro: 'Registro não encontrado.' }, { status: 404 });
      }
      return NextResponse.json({ statusVerificacao: 'aprovado' });
    }

    const sql = tabela === 'fornecedor'
      ? `UPDATE fornecedor
            SET status_verificacao = 'rejeitado',
                motivo_rejeicao = ?,
                data_verificacao = NOW()
          WHERE id = ?`
      : `UPDATE servico
            SET status_verificacao = 'rejeitado',
                motivo_rejeicao = ?
          WHERE id = ?`;

    const [resultado] = await pool.execute(sql, [motivoRejeicao, id]);
    if (resultado.affectedRows === 0) {
      return NextResponse.json({ erro: 'Registro não encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ statusVerificacao: 'rejeitado' });
  } catch (erro) {
    console.error('[admin/verificacao]', erro);
    return NextResponse.json(
      { erro: 'Não foi possível registrar a análise.' },
      { status: 500 }
    );
  }
}
