import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterAdministradorLogado } from '@/lib/sessao-admin';
import { notificar } from '@/lib/notificacao-servidor';

// UC 024 (verificar fornecedor) e UC 025 (moderar serviço).
//
// Uma rota só para os dois: a ação é a mesma — aprovar ou rejeitar uma
// verificação — e muda apenas a tabela. Duas rotas idênticas seriam duas
// cópias da mesma regra para divergirem depois.

const TABELAS = {
  fornecedor: 'fornecedor',
  servico: 'servico',
};

// Quem recebe o aviso é sempre o fornecedor dono do registro analisado.
// No serviço, o nome dele entra na mensagem: o fornecedor pode ter vários,
// e "seu serviço foi aprovado" sem dizer qual não ajuda ninguém.
async function destinatario(tipo, id) {
  if (tipo === 'fornecedor') {
    const [linhas] = await pool.execute(
      'SELECT id_usuario FROM fornecedor WHERE id = ? LIMIT 1',
      [id]
    );
    return linhas[0] ? { idUsuario: linhas[0].id_usuario, nome: null } : null;
  }
  const [linhas] = await pool.execute(
    `SELECT f.id_usuario, s.nome
       FROM servico s JOIN fornecedor f ON f.id = s.id_fornecedor
      WHERE s.id = ? LIMIT 1`,
    [id]
  );
  return linhas[0] ? { idUsuario: linhas[0].id_usuario, nome: linhas[0].nome } : null;
}

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
      // RN065 — verificação de cadastro é assunto de conta; moderação de
      // serviço tem tipo próprio. Nenhum dos dois aponta para solicitação.
      const alvo = await destinatario(tipo, id);
      if (alvo) {
        await notificar(tipo === 'fornecedor'
          ? {
              idUsuario: alvo.idUsuario,
              tipo: 'conta',
              titulo: 'Cadastro aprovado',
              mensagem: 'Seu perfil foi verificado e já aparece para os clientes, '
                + 'com o selo de fornecedor verificado.',
            }
          : {
              idUsuario: alvo.idUsuario,
              tipo: 'servico',
              titulo: 'Serviço aprovado',
              mensagem: `${alvo.nome} foi aprovado e já aparece na vitrine.`,
            });
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
    const alvo = await destinatario(tipo, id);
    if (alvo) {
      await notificar(tipo === 'fornecedor'
        ? {
            idUsuario: alvo.idUsuario,
            tipo: 'conta',
            titulo: 'Cadastro não aprovado',
            mensagem: `Motivo: ${motivoRejeicao} Corrija os dados e o perfil volta `
              + 'automaticamente para análise.',
          }
        : {
            idUsuario: alvo.idUsuario,
            tipo: 'servico',
            titulo: `Serviço não aprovado: ${alvo.nome}`,
            mensagem: `Motivo: ${motivoRejeicao} Edite o serviço e ele volta `
              + 'automaticamente para análise.',
          });
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
