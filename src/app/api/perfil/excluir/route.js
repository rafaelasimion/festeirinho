import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';
import { lerSessao, encerrarSessao } from '@/lib/sessao';
import { impedimentosParaExcluir, excluirConta } from '@/lib/exclusao-servidor';

// UC 007 — exclusão de conta.

export async function POST(request) {
  const sessao = await lerSessao();
  if (!sessao) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const senha = String(corpo.senha ?? '');

  // A senha é exigida na confirmação. O UC 007 pede apenas confirmação; a
  // senha é salvaguarda de implementação, pela mesma razão da troca de
  // senha — e aqui o dano é irreversível.
  const [usuarios] = await pool.execute(
    'SELECT senha_hash FROM usuario WHERE id = ? LIMIT 1',
    [sessao.id]
  );
  if (usuarios.length === 0) {
    return NextResponse.json({ erro: 'Conta não encontrada.' }, { status: 404 });
  }

  const confere = await bcrypt.compare(senha, usuarios[0].senha_hash);
  if (!confere) {
    return NextResponse.json(
      { erros: { senha: 'Senha incorreta.' } },
      { status: 400 }
    );
  }

  // RN044 — a conferência é refeita aqui, e não só na tela: entre abrir a
  // página e confirmar, uma solicitação nova pode ter chegado.
  const impedimentos = await impedimentosParaExcluir(sessao.id, sessao.tipoUsuario);
  if (impedimentos.length > 0) {
    return NextResponse.json({ impedimentos }, { status: 409 });
  }

  const resultado = await excluirConta(sessao.id, sessao.tipoUsuario);
  if (resultado.erro) {
    return NextResponse.json({ erro: resultado.erro }, { status: 500 });
  }

  // UC 007, etapa 6 — encerra a sessão. O cookie é apagado aqui, numa rota;
  // a partir daí o status "excluído" já barraria qualquer requisição.
  await encerrarSessao();

  return NextResponse.json({ excluida: true });
}
