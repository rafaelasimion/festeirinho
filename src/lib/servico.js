import { pool } from '@/lib/db';
import { calcularAntecedenciaMinimaDias } from '@/lib/configuracao';
import { lerInteiro, lerDecimal } from '@/lib/validacao';

// Regras de validação do serviço, compartilhadas entre criação e edição.
// Ficam aqui, e não num route.js, porque arquivo de rota deve exportar
// apenas os métodos HTTP.

export async function validarServico(corpo) {
  const nome = String(corpo.nome ?? '').trim();
  const descricao = String(corpo.descricao ?? '').trim();
  // DECIMAL(10,2) na coluna: duas casas, nem mais.
  const precoBase = lerDecimal(corpo.precoBase, { casas: 2 });
  const idCategoria = Number(corpo.idCategoria);
  const idCobranca = Number(corpo.idCobranca);
  const diasAntecedencia = lerInteiro(corpo.diasAntecedencia);

  // capacidade_max NULL significa "sem limite" (RN017).
  const semLimite =
    corpo.capacidadeMax === null ||
    corpo.capacidadeMax === undefined ||
    corpo.capacidadeMax === '';
  const capacidadeMax = semLimite ? null : lerInteiro(corpo.capacidadeMax);

  const erros = {};
  if (nome.length < 3 || nome.length > 150) erros.nome = 'Informe o nome do serviço.';
  if (descricao.length < 20) erros.descricao = 'Descreva o serviço em ao menos 20 caracteres.';
  if (precoBase === null)
    erros.precoBase = String(corpo.precoBase ?? '').trim() === ''
      ? 'Informe o preço base.'
      : 'Informe o preço com no máximo duas casas decimais (ex.: 89,90).';
  else if (precoBase <= 0)
    erros.precoBase = 'Informe um preço maior que zero.';
  if (precoBase > 99999999.99) erros.precoBase = 'Preço acima do limite permitido.';
  if (!Number.isInteger(idCategoria)) erros.idCategoria = 'Selecione a categoria.';
  if (!Number.isInteger(idCobranca)) erros.idCobranca = 'Selecione a forma de cobrança.';
  if (!semLimite && (capacidadeMax === null || capacidadeMax <= 0))
    erros.capacidadeMax = 'Informe uma capacidade inteira maior que zero, ou deixe em branco.';

  // RN046 — o piso da antecedência é calculado a partir da configuração.
  const antecedenciaMinima = await calcularAntecedenciaMinimaDias();
  // Duas mensagens, porque são dois erros: "4,5" não é inferior ao mínimo de
  // 4 dias — o que falha nele é ser fracionário, e a mensagem antiga dizia a
  // coisa errada. Mesmas frases da tela.
  if (diasAntecedencia === null) {
    erros.diasAntecedencia = String(corpo.diasAntecedencia ?? '').trim() === ''
      ? 'Informe a antecedência mínima em dias.'
      : 'A antecedência precisa ser um número inteiro de dias.';
  } else if (diasAntecedencia < antecedenciaMinima) {
    erros.diasAntecedencia = `A antecedência mínima permitida é de ${antecedenciaMinima} dias.`;
  }

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