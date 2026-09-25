import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterAdministradorLogado } from '@/lib/sessao-admin';
import { notificar } from '@/lib/notificacao-servidor';

// UC 027 e correspondente do fornecedor (RF052, RF053) — suspensão e
// reativação de contas.
// UC 035 — análise da solicitação de revisão de suspensão.

// A tabela e a coluna de status vêm de uma lista fechada; o valor recebido
// escolhe uma entrada, nunca é colado no SQL.
const PAPEIS = {
  cliente: { tabela: 'cliente', coluna: 'status_cliente' },
  fornecedor: { tabela: 'fornecedor', coluna: 'status_fornecedor' },
};

const ACOES = ['suspender', 'reativar', 'analisar_revisao'];

// RN065 — avisos de situação da conta ficam registrados mesmo enquanto o
// login está bloqueado: a tela de bloqueio mostra motivo e resultado, e a
// central fica disponível quando a conta volta.
async function usuarioDaConta(papel, id) {
  const [linhas] = await pool.execute(
    `SELECT id_usuario FROM ${papel.tabela} WHERE id = ? LIMIT 1`,
    [id]
  );
  return linhas[0]?.id_usuario ?? null;
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

  const papel = PAPEIS[String(corpo.tipo ?? '')];
  const id = Number(corpo.id);
  const acao = String(corpo.acao ?? '');

  if (!papel) return NextResponse.json({ erro: 'Tipo inválido.' }, { status: 400 });
  if (!Number.isInteger(id)) return NextResponse.json({ erro: 'Conta inválida.' }, { status: 400 });
  if (!ACOES.includes(acao)) return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 });

  const [linhas] = await pool.execute(
    `SELECT ${papel.coluna} AS status, status_solicitacao_revisao
       FROM ${papel.tabela} WHERE id = ? LIMIT 1`,
    [id]
  );
  if (linhas.length === 0) {
    return NextResponse.json({ erro: 'Conta não encontrada.' }, { status: 404 });
  }
  const conta = linhas[0];

  // Conta excluída é definitiva (RN044): não volta por ação administrativa.
  if (conta.status === 'excluido') {
    return NextResponse.json(
      { erro: 'Esta conta foi excluída em caráter definitivo.' },
      { status: 409 }
    );
  }

  try {
    // ---------------- UC 027, etapas 3 a 5 ----------------
    if (acao === 'suspender') {
      const motivo = String(corpo.motivo ?? '').trim();
      if (motivo.length < 10) {
        return NextResponse.json(
          { erro: 'Descreva o motivo da suspensão em ao menos 10 caracteres.' },
          { status: 400 }
        );
      }
      if (conta.status === 'suspenso') {
        return NextResponse.json({ erro: 'Esta conta já está suspensa.' }, { status: 409 });
      }

      // A chk_..._suspensao exige status, motivo e data juntos.
      //
      // Os campos de revisão são zerados porque a revisão é da suspensão
      // VIGENTE (UC 003, 6a.2): uma suspensão nova dá direito a um novo
      // pedido, e a tabela não guarda histórico.
      await pool.execute(
        `UPDATE ${papel.tabela}
            SET ${papel.coluna} = 'suspenso',
                motivo_suspensao = ?,
                data_suspensao = NOW(),
                motivo_solicitacao_revisao = NULL,
                data_solicitacao_revisao = NULL,
                status_solicitacao_revisao = NULL,
                resultado_solicitacao_revisao = NULL,
                data_analise_revisao = NULL
          WHERE id = ?`,
        [motivo, id]
      );

      // UC 027, etapa 5 — "encerrando as sessões ativas". O cookie de sessão
      // continua no navegador da pessoa, mas toda rota confere o status no
      // banco a cada requisição: a partir daqui ela não consegue mais nada.
      const idUsuario = await usuarioDaConta(papel, id);
      if (idUsuario) {
        await notificar({
          idUsuario,
          tipo: 'conta',
          titulo: 'Conta suspensa',
          mensagem: `Motivo: ${motivo} Você pode solicitar revisão na tela de acesso.`,
        });
      }

      return NextResponse.json({ status: 'suspenso' });
    }

    // ---------------- reativação direta ----------------
    if (acao === 'reativar') {
      if (conta.status !== 'suspenso') {
        return NextResponse.json({ erro: 'Esta conta não está suspensa.' }, { status: 409 });
      }
      // Havendo pedido de revisão em aberto, a reativação passa pela análise:
      // o usuário precisa receber uma resposta ao que enviou (UC 035).
      if (conta.status_solicitacao_revisao === 'pendente') {
        return NextResponse.json(
          { erro: 'Há uma solicitação de revisão pendente. Analise-a para reativar a conta.' },
          { status: 409 }
        );
      }

      await pool.execute(
        `UPDATE ${papel.tabela}
            SET ${papel.coluna} = 'ativo',
                motivo_suspensao = NULL,
                data_suspensao = NULL
          WHERE id = ?`,
        [id]
      );
      const idUsuario = await usuarioDaConta(papel, id);
      if (idUsuario) {
        await notificar({
          idUsuario,
          tipo: 'conta',
          titulo: 'Conta reativada',
          mensagem: 'Sua conta voltou a ficar ativa e o acesso está liberado.',
        });
      }

      return NextResponse.json({ status: 'ativo' });
    }

    // ---------------- UC 035 ----------------
    const resultado = String(corpo.resultado ?? '').trim();
    const manterSuspensao = Boolean(corpo.manterSuspensao);

    if (conta.status_solicitacao_revisao !== 'pendente') {
      return NextResponse.json(
        { erro: 'Não há solicitação de revisão pendente nesta conta.' },
        { status: 409 }
      );
    }
    // O texto é exibido ao usuário na tela de bloqueio (UC 003, 6a.4): sem
    // ele, a pessoa fica sabendo que foi analisada, mas não o porquê.
    if (resultado.length < 20) {
      return NextResponse.json(
        { erro: 'Descreva o resultado da análise em ao menos 20 caracteres.' },
        { status: 400 }
      );
    }

    if (manterSuspensao) {
      await pool.execute(
        `UPDATE ${papel.tabela}
            SET status_solicitacao_revisao = 'analisada',
                resultado_solicitacao_revisao = ?,
                data_analise_revisao = NOW()
          WHERE id = ?`,
        [resultado, id]
      );
      const idUsuario = await usuarioDaConta(papel, id);
      if (idUsuario) {
        await notificar({
          idUsuario,
          tipo: 'conta',
          titulo: 'Revisão analisada: suspensão mantida',
          mensagem: resultado,
        });
      }

      return NextResponse.json({ status: 'suspenso', revisao: 'analisada' });
    }

    // Revisão acolhida: a conta volta a "ativo" e o registro da revisão
    // permanece — a CHECK admite revisão analisada em conta ativa.
    await pool.execute(
      `UPDATE ${papel.tabela}
          SET ${papel.coluna} = 'ativo',
              motivo_suspensao = NULL,
              data_suspensao = NULL,
              status_solicitacao_revisao = 'analisada',
              resultado_solicitacao_revisao = ?,
              data_analise_revisao = NOW()
        WHERE id = ?`,
      [resultado, id]
    );
    const idUsuario = await usuarioDaConta(papel, id);
    if (idUsuario) {
      await notificar({
        idUsuario,
        tipo: 'conta',
        titulo: 'Revisão acolhida: conta reativada',
        mensagem: resultado,
      });
    }

    return NextResponse.json({ status: 'ativo', revisao: 'analisada' });
  } catch (erroAcao) {
    console.error('[admin/contas]', erroAcao);
    return NextResponse.json({ erro: 'Não foi possível concluir a operação.' }, { status: 500 });
  }
}
