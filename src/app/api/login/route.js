import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';
import { criarSessao } from '@/lib/sessao';

// UC 003 — Autenticação.
// Cenário principal: valida credenciais, verifica status, autentica.
// Alternativos: 5a credencial inválida, 6a suspenso, 6b excluído, 6c inativo.

export async function POST(request) {
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const identificador = String(corpo.identificador ?? '').trim();
  const senha = String(corpo.senha ?? '');

  // UC 003, 5a.1 — mensagem genérica, sem revelar se a conta existe.
  const CREDENCIAL_INVALIDA = NextResponse.json(
    { erro: 'E-mail, nome de usuário ou senha incorretos.' },
    { status: 401 }
  );

  if (identificador === '' || senha === '') return CREDENCIAL_INVALIDA;

  try {
    const [usuarios] = await pool.execute(
      `SELECT id, tipo_usuario, nome, senha_hash
         FROM usuario
        WHERE email = ? OR nome_usuario = ?
        LIMIT 1`,
      [identificador.toLowerCase(), identificador]
    );

    if (usuarios.length === 0) return CREDENCIAL_INVALIDA;

    const usuario = usuarios[0];

    // Compara o hash da senha digitada com o hash guardado.
    // A senha original nunca é recuperada de volta.
    const senhaConfere = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaConfere) return CREDENCIAL_INVALIDA;

    // ---------- UC 003, passo 6: verificação do status ----------
    const ehCliente = usuario.tipo_usuario === 'cliente';

    const [perfis] = await pool.execute(
      ehCliente
        ? `SELECT status_cliente AS status, motivo_suspensao, data_suspensao,
                  status_solicitacao_revisao, data_solicitacao_revisao,
                  resultado_solicitacao_revisao
             FROM cliente WHERE id_usuario = ? LIMIT 1`
        : `SELECT status_fornecedor AS status, motivo_suspensao, data_suspensao,
                  status_solicitacao_revisao, data_solicitacao_revisao,
                  resultado_solicitacao_revisao
             FROM fornecedor WHERE id_usuario = ? LIMIT 1`,
      [usuario.id]
    );

    if (perfis.length === 0) {
      console.error('[login] usuário sem perfil correspondente', usuario.id);
      return NextResponse.json({ erro: 'Não foi possível entrar.' }, { status: 500 });
    }

    const perfil = perfis[0];

    // 6b — conta excluída: bloqueio definitivo, sem exibir dados da conta
    // e sem oferecer revisão (RN044).
    if (perfil.status === 'excluido') {
      return NextResponse.json(
        {
          codigo: 'CONTA_EXCLUIDA',
          mensagem: 'Esta conta foi excluída em caráter definitivo.',
        },
        { status: 403 }
      );
    }

    // 6a — conta suspensa: bloqueia e devolve o motivo, a data e a
    // situação da solicitação de revisão (6a.2, 6a.3, 6a.4).
    if (perfil.status === 'suspenso') {
      let revisao;
      if (perfil.status_solicitacao_revisao === null) {
        revisao = { situacao: 'nenhuma' };
      } else if (perfil.status_solicitacao_revisao === 'pendente') {
        revisao = { situacao: 'pendente', dataEnvio: perfil.data_solicitacao_revisao };
      } else {
        revisao = {
          situacao: 'analisada',
          dataEnvio: perfil.data_solicitacao_revisao,
          resultado: perfil.resultado_solicitacao_revisao,
        };
      }

      return NextResponse.json(
        {
          codigo: 'CONTA_SUSPENSA',
          motivo: perfil.motivo_suspensao,
          dataSuspensao: perfil.data_suspensao,
          revisao,
        },
        { status: 403 }
      );
    }

    // 6c — conta inativa volta automaticamente para ativa antes de concluir.
    if (perfil.status === 'inativo') {
      await pool.execute(
        ehCliente
          ? `UPDATE cliente SET status_cliente = 'ativo' WHERE id_usuario = ?`
          : `UPDATE fornecedor SET status_fornecedor = 'ativo' WHERE id_usuario = ?`,
        [usuario.id]
      );
    }

    // ---------- passo 7: autentica ----------
    // Base para a inativação automática por inatividade (RN043, RN047).
    await pool.execute(
      'UPDATE usuario SET data_ultimo_login = NOW() WHERE id = ?',
      [usuario.id]
    );

    await criarSessao({ id: usuario.id, tipoUsuario: usuario.tipo_usuario });

    return NextResponse.json({
      nome: usuario.nome,
      tipoUsuario: usuario.tipo_usuario,
      destino: '/minha-conta',
    });
  } catch (erro) {
    console.error('[login]', erro);
    return NextResponse.json({ erro: 'Não foi possível entrar.' }, { status: 500 });
  }
}
