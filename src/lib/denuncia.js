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
