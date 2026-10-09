// Rótulos e apoio da avaliação (RF037 / UC 021).
// Arquivo sem banco: usado pelas telas do cliente, da vitrine e do painel.

export const NOTAS = [1, 2, 3, 4, 5];

export const ROTULO_NOTA = {
  1: 'Muito ruim',
  2: 'Ruim',
  3: 'Regular',
  4: 'Bom',
  5: 'Excelente',
};

// RN062 — a visibilidade escolhida pelo cliente esconde apenas o COMENTÁRIO.
// A nota continua contando nas estatísticas do serviço e do fornecedor em
// qualquer caso, e é por isso que a média nunca filtra por status.
export const VISIBILIDADES = [
  {
    valor: 'visivel',
    rotulo: 'Pública',
    detalhe: 'Seu comentário aparece na página do serviço.',
  },
  // RN062 — "privada" tira o comentário da vitrine, não do fornecedor
  // avaliado: ele lê o que recebeu na página da solicitação, e é isso que
  // lhe permite denunciar um comentário inadequado (RN052). O texto antigo
  // prometia "visível apenas para a plataforma", o que o sistema não fazia.
  {
    valor: 'oculta',
    rotulo: 'Privada',
    detalhe: 'Só a nota é publicada. O comentário não aparece na vitrine: só o fornecedor e a plataforma o leem.',
  },
];

export function formatarMedia(media) {
  if (media === null || media === undefined) return null;
  return Number(media).toFixed(1);
}

// O comentário é público (RF037), mas o nome completo de quem avaliou não
// precisa ser: primeiro nome e a inicial do sobrenome bastam para dar
// credibilidade sem expor o cliente (RNF018).
//
// Mora aqui, e não dentro de uma página, porque duas telas exibem
// comentários — a do serviço e a vitrine do fornecedor — e a vitrine
// mostrava o nome completo enquanto a página do serviço já abreviava.
//
// O nome pode chegar nulo: a exclusão de conta anula os dados pessoais do
// cliente (RN044-A) e preserva a avaliação (RN044-B). A vitrine fazia
// `nome.slice(...)` sem essa guarda e caía inteira quando um cliente que
// havia comentado excluía a conta.
export function nomeAbreviado(nome) {
  const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'Cliente';
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1][0]}.`;
}
