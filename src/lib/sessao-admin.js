import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// RF071 — sessão administrativa, separada da sessão de usuário.
//
// Cookie com nome diferente e conteúdo diferente: uma sessão de cliente ou
// fornecedor nunca abre o painel, e uma sessão de administrador nunca serve
// para contratar. São dois mundos que não se cruzam.

const NOME_COOKIE = 'sessao_admin';
const DURACAO_HORAS = 8; // jornada de trabalho, não sete dias como a do usuário
const chave = new TextEncoder().encode(process.env.JWT_SECRET);

export async function criarSessaoAdmin(idAdministrador) {
  const token = await new SignJWT({ idAdministrador, escopo: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_HORAS}h`)
    .sign(chave);

  const cookieStore = await cookies();
  cookieStore.set(NOME_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DURACAO_HORAS * 60 * 60,
  });
}

export async function lerSessaoAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(NOME_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, chave);
    if (payload.escopo !== 'admin') return null;
    return { id: Number(payload.idAdministrador) };
  } catch {
    return null;
  }
}

export async function encerrarSessaoAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(NOME_COOKIE);
}

// Usado pelas rotas de API administrativas. Consulta o status no banco a cada
// requisição: um administrador desativado agora perde o acesso na requisição
// seguinte, mesmo com o cookie ainda válido no navegador.
export async function obterAdministradorLogado() {
  const sessao = await lerSessaoAdmin();
  if (!sessao) {
    return { erro: NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 }) };
  }

  const [linhas] = await pool.execute(
    `SELECT id, nome, status_administrador
       FROM administrador WHERE id = ? LIMIT 1`,
    [sessao.id]
  );

  if (linhas.length === 0 || linhas[0].status_administrador !== 'ativo') {
    return { erro: NextResponse.json({ erro: 'Acesso negado.' }, { status: 403 }) };
  }

  return { administrador: linhas[0] };
}

// Usado pelas páginas administrativas. Devolve o administrador ou null.
export async function administradorAtivo() {
  const sessao = await lerSessaoAdmin();
  if (!sessao) return null;

  const [linhas] = await pool.execute(
    `SELECT id, nome, status_administrador
       FROM administrador WHERE id = ? LIMIT 1`,
    [sessao.id]
  );

  if (linhas.length === 0 || linhas[0].status_administrador !== 'ativo') return null;
  return linhas[0];
}
