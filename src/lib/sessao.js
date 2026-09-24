import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { pool } from '@/lib/db';

// A sessão é um token assinado guardado num cookie httpOnly: o JavaScript
// da página não consegue lê-lo, só o servidor. Assinado significa que o
// conteúdo é visível mas não pode ser alterado sem invalidar a assinatura.

const NOME_COOKIE = 'sessao';
const DURACAO_DIAS = 7;
const chave = new TextEncoder().encode(process.env.JWT_SECRET);

// UC 003, 6a e 6b — contas nesses status não acessam o sistema. O
// fornecedor "pausado" acessa normalmente: pausar só o esconde da vitrine
// (UC 005). O "inativo" também passa, e o login o reativa (6c).
const STATUS_BLOQUEADOS = ['suspenso', 'excluido'];

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

// Lê e valida apenas o token, sem ir ao banco.
async function lerToken() {
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

// Devolve { id, tipoUsuario } se houver sessão válida DE UMA CONTA ATIVA,
// ou null.
//
// A conferência do status no banco acontece aqui, e não só nas rotas de
// API, porque o token é imutável: ele foi assinado quando a conta estava
// ativa e continua válido depois de uma suspensão (UC 027). Sem esta
// consulta, uma conta suspensa continuaria abrindo as telas com o cookie
// que já tinha — só as ações falhariam.
//
// É o que dá sentido a "encerrando as sessões ativas" do UC 027: não há
// como apagar um cookie do navegador de outra pessoa, mas dá para deixar
// de aceitá-lo na requisição seguinte.
//
// Custa uma consulta por página. Para uma leitura tão pequena, por chave
// primária, o preço é baixo perto de deixar passar quem foi suspenso.
export async function lerSessao() {
  const sessao = await lerToken();
  if (!sessao) return null;

  const tabela = sessao.tipoUsuario === 'fornecedor' ? 'fornecedor' : 'cliente';
  const coluna = sessao.tipoUsuario === 'fornecedor' ? 'status_fornecedor' : 'status_cliente';

  try {
    const [linhas] = await pool.execute(
      `SELECT ${coluna} AS status FROM ${tabela} WHERE id_usuario = ? LIMIT 1`,
      [sessao.id]
    );
    if (linhas.length === 0) return null;
    if (STATUS_BLOQUEADOS.includes(linhas[0].status)) return null;
    return sessao;
  } catch (erro) {
    // Falha de banco não deve virar acesso liberado.
    console.error('[lerSessao]', erro);
    return null;
  }
}

export async function encerrarSessao() {
  const cookieStore = await cookies();
  cookieStore.delete(NOME_COOKIE);
}
