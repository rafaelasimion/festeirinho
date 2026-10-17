// Denúncias (RF067, RN052) — rótulos e motivos, sem banco.
//
// Os motivos são exclusivos por tipo, como exige a chk_denuncia_motivo:
// "conteúdo inadequado" só existe na denúncia de avaliação, e os demais só
// na denúncia de fornecedor. "Outro" serve aos dois.

export const MOTIVOS_AVALIACAO = [
  {
    valor: 'conteudo_inadequado',
    rotulo: 'Conteúdo inadequado',
    detalhe: 'Ofensas, discurso de ódio, dados pessoais de terceiros ou spam.',
  },
  { valor: 'outro', rotulo: 'Outro motivo', detalhe: 'Descreva abaixo o que aconteceu.' },
];

export const MOTIVOS_FORNECEDOR = [
  {
    valor: 'conduta_no_chat',
    rotulo: 'Conduta no chat',
    detalhe: 'Mensagens ofensivas ou desrespeitosas durante o atendimento.',
  },
  {
    valor: 'servico_nao_prestado',
    rotulo: 'Serviço não prestado',
    detalhe: 'O fornecedor não compareceu nem executou o serviço.',
  },
  {
    valor: 'servico_divergente',
    rotulo: 'Serviço divergente do anunciado',
    detalhe: 'O que foi entregue não corresponde ao anúncio.',
  },
  {
    valor: 'cobranca_fora_da_plataforma',
    rotulo: 'Cobrança fora da plataforma',
    detalhe: 'Pedido de pagamento por fora, sem as proteções da contratação.',
  },
  {
    valor: 'informacoes_falsas',
    rotulo: 'Informações falsas no anúncio',
    detalhe: 'Fotos, preços ou descrições que não correspondem à realidade.',
  },
  { valor: 'outro', rotulo: 'Outro motivo', detalhe: 'Descreva abaixo o que aconteceu.' },
];

// RN052 — o marco de onde conta o prazo da denúncia de fornecedor: a
// confirmação da conclusão ou o registro do cancelamento.
//
// O cancelamento automático por falta de pagamento (RN025) não gera registro
// na entidade cancelamento, então sem a terceira linha a solicitação
// cancelada assim ficava com o prazo aberto para sempre. O marco dela é a
// data-limite do pagamento: é o momento da expiração e, na terceira recusa,
// um marco fixo logo depois dela. É também o caso em que a denúncia mais
// faz sentido — o fornecedor que pede o pagamento por fora da plataforma é
// justamente quem deixa o pagamento daqui vencer.
//
// Mora aqui, sem banco, porque a rota de denúncias e a página da
// solicitação precisam da mesma conta: uma decide se aceita, a outra se
// oferece o botão.
export function marcoPrazoDenuncia({
  data_confirmacao_conclusao_cliente: confirmacao,
  data_cancelamento: cancelamento,
  status_pagamento: statusPagamento,
  data_limite: dataLimite,
}) {
  if (confirmacao) return confirmacao;
  if (cancelamento) return cancelamento;
  if (['expirado', 'recusado'].includes(statusPagamento)) return dataLimite ?? null;
  return null;
}

export function motivosDoTipo(tipo) {
  return tipo === 'avaliacao' ? MOTIVOS_AVALIACAO : MOTIVOS_FORNECEDOR;
}

export const ROTULO_MOTIVO = Object.fromEntries(
  [...MOTIVOS_AVALIACAO, ...MOTIVOS_FORNECEDOR].map(({ valor, rotulo }) => [valor, rotulo])
);

export const ROTULO_RESULTADO_DENUNCIA = {
  procedente: 'Procedente',
  improcedente: 'Improcedente',
};

export const TOM_RESULTADO_DENUNCIA = {
  procedente: 'sucesso',
  improcedente: 'neutro',
};
