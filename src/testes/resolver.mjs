import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// Tradutor de caminhos para os testes (ver registrar.mjs).
//
// '@/lib/solicitacao' vira o arquivo src/lib/solicitacao.js. O formato
// 'module' é dito explicitamente porque o package.json do projeto não
// declara "type": "module": sem isso, versões do Node anteriores à 22
// tentariam ler o import/export dos módulos como CommonJS e falhariam.

const PASTA_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function resolve(especificador, contexto, proximo) {
  if (especificador.startsWith('@/')) {
    const relativo = especificador.slice(2);
    const comExtensao = /\.(m?js|jsx)$/.test(relativo) ? relativo : `${relativo}.js`;
    return {
      url: pathToFileURL(path.join(PASTA_SRC, comExtensao)).href,
      format: 'module',
      shortCircuit: true,
    };
  }
  const resolvido = await proximo(especificador, contexto);
  // Os próprios módulos do src, alcançados por caminho relativo, também são
  // ES modules.
  if (resolvido.url.startsWith(pathToFileURL(PASTA_SRC).href) && resolvido.url.endsWith('.js')) {
    return { ...resolvido, format: 'module' };
  }
  return resolvido;
}
