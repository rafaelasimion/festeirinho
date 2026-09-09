import { pool } from '@/lib/db';

// RN014 — os parâmetros do negócio ficam na tabela configuracao, não no
// código. Assim a administração ajusta prazos e percentuais sem que
// ninguém precise mexer no sistema.
//
// O cache evita ir ao banco a cada requisição por valores que quase nunca
// mudam. Uma alteração feita pela administração passa a valer em no
// máximo um minuto.

let cache = null;
let carregadoEm = 0;
const DURACAO_CACHE_MS = 60_000;

export async function obterConfiguracoes() {
  if (cache && Date.now() - carregadoEm < DURACAO_CACHE_MS) return cache;

  const [linhas] = await pool.query('SELECT chave, valor FROM configuracao');
  cache = Object.fromEntries(linhas.map((linha) => [linha.chave, Number(linha.valor)]));
  carregadoEm = Date.now();
  return cache;
}

// RN046 — a antecedência mínima que o fornecedor pode exigir para um
// serviço precisa caber três parcelas: o prazo de resposta dele, o prazo
// de pagamento do cliente e as 24h anteriores ao evento, em que nenhum
// pagamento pode mais ser confirmado. A soma vem em horas e é convertida
// em dias arredondando para cima.
// Com os valores padrão (48h + 24h + 24h = 96h), dá 4 dias.
export async function calcularAntecedenciaMinimaDias() {
  const configuracoes = await obterConfiguracoes();
  const horas =
    configuracoes.prazo_resposta_fornecedor_horas +
    configuracoes.prazo_pagamento_horas +
    24;
  return Math.ceil(horas / 24);
}
