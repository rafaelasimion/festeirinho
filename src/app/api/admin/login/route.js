import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';
import { criarSessaoAdmin } from '@/lib/sessao-admin';
import {
  chavesDaTentativa,
  segundosDeBloqueio,
  registrarFalha,
  limparFalhasDaConta,
  mensagemDeBloqueio,
} from '@/lib/tentativas';

// UC 044 — autenticação administrativa.
// Alternativos: 5a credencial inválida, 5b excesso de tentativas,
// 6a conta administrativa inativa.

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

  // UC 044, 5b / RNF020 — o painel administrativo é o alvo mais valioso
  // do sistema; o bloqueio aqui usa exatamente o mesmo mecanismo do
  // login comum, com a chave formada pelo e-mail digitado.
  const chaves = chavesDaTentativa(request, email);
  const segundos = segundosDeBloqueio(chaves);
  if (segundos > 0) {
    return NextResponse.json(
      { erro: mensagemDeBloqueio(segundos) },
      { status: 429 }
    );
  }

  // Quando é esta falha que estoura o limite, a resposta já avisa do
  // bloqueio em vez de repetir a mensagem genérica.
  function recusar() {
    registrarFalha(chaves);
    const espera = segundosDeBloqueio(chaves);
    return espera > 0
      ? NextResponse.json({ erro: mensagemDeBloqueio(espera) }, { status: 429 })
      : ACESSO_NEGADO;
  }

  try {
    const [linhas] = await pool.execute(
      `SELECT id, nome, senha_hash, status_administrador
         FROM administrador WHERE email = ? LIMIT 1`,
      [email]
    );

    if (linhas.length === 0) return recusar();

    const administrador = linhas[0];

    const senhaConfere = await bcrypt.compare(senha, administrador.senha_hash);
    if (!senhaConfere) return recusar();

    limparFalhasDaConta(chaves);

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
