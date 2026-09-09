import { pool } from '@/lib/db';
import { calcularAntecedenciaMinimaDias } from '@/lib/configuracao';

// Regras de validação do serviço, compartilhadas entre criação e edição.
// Ficam aqui, e não num route.js, porque arquivo de rota deve exportar
// apenas os métodos HTTP.

export async function validarServico(corpo) {
  const nome = String(corpo.nome ?? '').trim();
  const descricao = String(corpo.descricao ?? '').trim();
  const precoBase = Number(corpo.precoBase);
  const idCategoria = Number(corpo.idCategoria);
  const idCobranca = Number(corpo.idCobranca);
  const diasAntecedencia = Number(corpo.diasAntecedencia);

  // capacidade_max NULL significa "sem limite" (RN017).
  const semLimite =
    corpo.capacidadeMax === null ||
    corpo.capacidadeMax === undefined ||
    corpo.capacidadeMax === '';
  const capacidadeMax = semLimite ? null : Number(corpo.capacidadeMax);

  const erros = {};
  if (nome.length < 3 || nome.length > 150) erros.nome = 'Informe o nome do serviço.';
  if (descricao.length < 20) erros.descricao = 'Descreva o serviço em ao menos 20 caracteres.';
  if (!Number.isFinite(precoBase) || precoBase <= 0)
    erros.precoBase = 'Informe um preço maior que zero.';
  if (precoBase > 99999999.99) erros.precoBase = 'Preço acima do limite permitido.';
  if (!Number.isInteger(idCategoria)) erros.idCategoria = 'Selecione a categoria.';
  if (!Number.isInteger(idCobranca)) erros.idCobranca = 'Selecione a forma de cobrança.';
  if (!semLimite && (!Number.isInteger(capacidadeMax) || capacidadeMax <= 0))
    erros.capacidadeMax = 'Informe uma capacidade maior que zero ou deixe em branco.';

  // RN046 — o piso da antecedência é calculado a partir da configuração.
  const antecedenciaMinima = await calcularAntecedenciaMinimaDias();
  if (!Number.isInteger(diasAntecedencia) || diasAntecedencia < antecedenciaMinima)
    erros.diasAntecedencia = `A antecedência mínima permitida é de ${antecedenciaMinima} dias.`;

  // As chaves precisam existir. Validar aqui devolve mensagem por campo;
  // sem isso o erro só apareceria como falha de chave estrangeira.
  if (!erros.idCategoria) {
    const [categorias] = await pool.execute(
      'SELECT 1 FROM categoria WHERE id = ? LIMIT 1', [idCategoria]
    );
    if (categorias.length === 0) erros.idCategoria = 'Categoria inexistente.';
  }
  if (!erros.idCobranca) {
    const [cobrancas] = await pool.execute(
      'SELECT 1 FROM cobranca WHERE id = ? LIMIT 1', [idCobranca]
    );
    if (cobrancas.length === 0) erros.idCobranca = 'Forma de cobrança inexistente.';
  }

  return {
    erros,
    dados: {
      nome, descricao, precoBase, idCategoria, idCobranca,
      capacidadeMax, diasAntecedencia,
    },
  };
}