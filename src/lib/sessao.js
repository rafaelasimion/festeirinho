import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// A sessão é um token assinado guardado num cookie httpOnly: o JavaScript
// da página não consegue lê-lo, só o servidor. Assinado significa que o
// conteúdo é visível mas não pode ser alterado sem invalidar a assinatura.

const NOME_COOKIE = 'sessao';
const DURACAO_DIAS = 7;
const chave = new TextEncoder().encode(process.env.JWT_SECRET);

export async function criarSessao({ id, tipoUsuario }) {
  const token = await new SignJWT({ id, tipoUsuario })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_DIAS}d`)
    .sign(chave);

  const cookieStore = await cookies();
  cookieStore.set(NOME_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DURACAO_DIAS * 24 * 60 * 60,
  });
}

// Devolve { id, tipoUsuario } se houver sessão válida, ou null.
// Nunca confie em nada além disso: o token diz quem é o usuário,
// não o que ele pode fazer. Permissão se consulta no banco.
export async function lerSessao() {
  const cookieStore = await cookies();
  const token = cookieStore.get(NOME_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, chave);
    return { id: Number(payload.id), tipoUsuario: payload.tipoUsuario };
  } catch {
    return null; // token expirado ou adulterado
  }
}

export async function encerrarSessao() {
  const cookieStore = await cookies();
  cookieStore.delete(NOME_COOKIE);
}
