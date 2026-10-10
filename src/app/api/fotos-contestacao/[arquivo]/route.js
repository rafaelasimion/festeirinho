import { readFile } from 'fs/promises';
import path from 'path';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { administradorAtivo } from '@/lib/sessao-admin';
import {
  PASTA_CONTESTACOES, PADRAO_NOME_ARQUIVO, PREFIXO_URL_CONTESTACAO, TIPOS_MIME,
} from '@/lib/imagens-servidor';

// RF069-B / RN069 — entrega de uma foto de contestação.
//
// A gêmea pública, /api/imagens, entrega qualquer arquivo a qualquer um que
// tenha o link — serve para foto de serviço, que está na vitrine. Esta não:
// a foto só sai para
//   - a administração, que é quem julga (RF070); e
//   - quem a enviou.
// E só enquanto a contestação estiver pendente. Fora disso a resposta é
// "não encontrado", para quem tem e para quem não tem acesso: dizer
// "proibido" confirmaria que a foto existe.

const NAO_ENCONTRADA = () => new Response('Não encontrado.', { status: 404 });

export async function GET(request, { params }) {
  const { arquivo } = await params;

  // Mesma barreira da rota pública: o nome precisa ser exatamente um dos
  // que o sistema gera. Nada de "../" chegando perto do disco.
  if (!PADRAO_NOME_ARQUIVO.test(arquivo)) return NAO_ENCONTRADA();

  const [linhas] = await pool.execute(
    `SELECT fc.enviado_por, so.status_contestacao,
            c.id_usuario AS usuario_cliente,
            f.id_usuario AS usuario_fornecedor
       FROM foto_contestacao fc
       JOIN solicitacao so ON so.id = fc.id_solicitacao
       JOIN cliente c      ON c.id  = so.id_cliente
       JOIN servico s      ON s.id  = so.id_servico
       JOIN fornecedor f   ON f.id  = s.id_fornecedor
      WHERE fc.imagem_url = ?
      LIMIT 1`,
    [`${PREFIXO_URL_CONTESTACAO}/${arquivo}`]
  );

  const foto = linhas[0];
  if (!foto || foto.status_contestacao !== 'pendente') return NAO_ENCONTRADA();

  let autorizado = (await administradorAtivo()) !== null;
  if (!autorizado) {
    const sessao = await lerSessao();
    const dono = foto.enviado_por === 'cliente'
      ? foto.usuario_cliente
      : foto.usuario_fornecedor;
    autorizado = sessao !== null && sessao.id === dono;
  }
  if (!autorizado) return NAO_ENCONTRADA();

  try {
    const conteudo = await readFile(path.join(PASTA_CONTESTACOES, arquivo));
    const extensao = arquivo.split('.').pop();

    return new Response(conteudo, {
      headers: {
        'Content-Type': TIPOS_MIME[extensao],
        // O contrário da rota pública, que deixa o navegador guardar a
        // imagem para sempre: aqui nada fica em cache. A foto é apagada
        // com a decisão, e uma cópia esquecida no navegador de um
        // computador compartilhado seria justamente o que a regra evita.
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NAO_ENCONTRADA();
  }
}
