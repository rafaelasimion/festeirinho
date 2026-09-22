import { randomUUID } from 'crypto';
import { mkdir, writeFile, unlink } from 'fs/promises';
import path from 'path';

// Armazenamento de imagens enviadas pelos usuários.
//
// Os arquivos ficam na pasta /uploads, na raiz do projeto — FORA de /public.
// O Next.js só serve o que estava em /public no momento do build; um arquivo
// enviado depois não apareceria em produção. Por isso as imagens são
// entregues por uma rota própria, /api/imagens/[arquivo].
//
// A pasta /uploads não vai para o repositório (.gitignore): é dado de
// usuário, não código.

export const PASTA_UPLOADS = path.join(process.cwd(), 'uploads');

// Limite técnico, para um envio não esgotar o disco. Não é regra de negócio
// documentada; se for mantido, o lugar dele é o documento de RNF.
export const TAMANHO_MAXIMO = 5 * 1024 * 1024;

// O tipo do arquivo é decidido pelos primeiros bytes do conteúdo — a
// "assinatura" de cada formato —, e NÃO pelo nome nem pelo tipo que o
// navegador declara. Os dois vêm do usuário e podem mentir: um script
// renomeado para foto.jpg passaria por uma checagem de extensão.
function detectarFormato(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'webp';
  return null;
}

export const TIPOS_MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

// Nome gerado: UUID + extensão do formato detectado. O nome original do
// arquivo nunca é usado — ele poderia conter "../" e escrever fora da pasta.
export const PADRAO_NOME_ARQUIVO = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export async function salvarImagem(arquivo) {
  if (!arquivo || typeof arquivo.arrayBuffer !== 'function') {
    return { erro: 'Selecione uma imagem.' };
  }
  if (arquivo.size === 0) {
    return { erro: 'O arquivo está vazio.' };
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return { erro: 'A imagem deve ter no máximo 5 MB.' };
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const formato = detectarFormato(bytes);
  if (!formato) {
    return { erro: 'Formato não aceito. Envie JPG, PNG ou WEBP.' };
  }

  const nomeArquivo = `${randomUUID()}.${formato}`;
  await mkdir(PASTA_UPLOADS, { recursive: true });
  await writeFile(path.join(PASTA_UPLOADS, nomeArquivo), bytes);

  return { nomeArquivo, url: `/api/imagens/${nomeArquivo}` };
}

export async function removerImagem(url) {
  const nomeArquivo = String(url ?? '').split('/').pop();
  if (!PADRAO_NOME_ARQUIVO.test(nomeArquivo)) return;
  try {
    await unlink(path.join(PASTA_UPLOADS, nomeArquivo));
  } catch {
    // Arquivo já ausente: não há o que remover.
  }
}
