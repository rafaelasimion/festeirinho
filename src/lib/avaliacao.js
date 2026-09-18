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
  {
    valor: 'oculta',
    rotulo: 'Privada',
    detalhe: 'Só a nota é publicada; o comentário fica visível apenas para a plataforma.',
  },
];

export function formatarMedia(media) {
  if (media === null || media === undefined) return null;
  return Number(media).toFixed(1);
}
