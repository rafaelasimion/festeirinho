import { readFile } from 'fs/promises';
import path from 'path';
import { PASTA_UPLOADS, PADRAO_NOME_ARQUIVO, TIPOS_MIME } from '@/lib/imagens-servidor';

// Entrega as imagens guardadas em /uploads.
//
// O nome recebido na URL é conferido contra o padrão exato dos nomes que o
// sistema gera (UUID + extensão). Qualquer outra coisa — em especial
// "../../.env.local" — é recusada antes de chegar perto do disco.

export async function GET(request, { params }) {
  const { arquivo } = await params;

  if (!PADRAO_NOME_ARQUIVO.test(arquivo)) {
    return new Response('Não encontrado.', { status: 404 });
  }

  try {
    const conteudo = await readFile(path.join(PASTA_UPLOADS, arquivo));
    const extensao = arquivo.split('.').pop();

    return new Response(conteudo, {
      headers: {
        'Content-Type': TIPOS_MIME[extensao],
        // O nome é único e o arquivo nunca muda depois de gravado: o
        // navegador pode guardar a imagem indefinidamente.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Não encontrado.', { status: 404 });
  }
}
