import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';
import { criarSessaoAdmin } from '@/lib/sessao-admin';

// UC 044 — autenticação administrativa.

export async function POST(request) {
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const email = String(corpo.email ?? '').trim().toLowerCase();
  const senha = String(corpo.senha ?? '');

  // UC 044, 5a.1 e 6a.1 — a mesma mensagem genérica para credencial errada e
  // para conta inativa. Diferenciar as duas revelaria quais e-mails existem.
  const ACESSO_NEGADO = NextResponse.json(
    { erro: 'E-mail ou senha incorretos.' },
    { status: 401 }
  );

  if (email === '' || senha === '') return ACESSO_NEGADO;

  try {
    const [linhas] = await pool.execute(
      `SELECT id, nome, senha_hash, status_administrador
         FROM administrador WHERE email = ? LIMIT 1`,
      [email]
    );

    if (linhas.length === 0) return ACESSO_NEGADO;

    const administrador = linhas[0];

    const senhaConfere = await bcrypt.compare(senha, administrador.senha_hash);
    if (!senhaConfere) return ACESSO_NEGADO;

    if (administrador.status_administrador !== 'ativo') return ACESSO_NEGADO;

    await pool.execute(
      'UPDATE administrador SET data_ultimo_login = NOW() WHERE id = ?',
      [administrador.id]
    );

    await criarSessaoAdmin(administrador.id);

    return NextResponse.json({ nome: administrador.nome });
  } catch (erro) {
    console.error('[admin/login]', erro);
    return NextResponse.json({ erro: 'Não foi possível entrar.' }, { status: 500 });
  }
}
