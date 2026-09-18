// Rótulos da contestação de conclusão (RF069/RN069).
// Arquivo sem banco: usado pelas telas do cliente e do painel administrativo.

export const MOTIVOS_CONTESTACAO = [
  { valor: 'servico_nao_prestado', rotulo: 'Serviço não prestado',
    detalhe: 'O fornecedor não compareceu ou não executou o serviço.' },
  { valor: 'servico_parcial', rotulo: 'Serviço prestado parcialmente',
    detalhe: 'Parte do que foi contratado não foi entregue.' },
  { valor: 'servico_divergente', rotulo: 'Serviço divergente do contratado',
    detalhe: 'O que foi entregue não corresponde ao que foi contratado.' },
];

export const ROTULO_MOTIVO_CONTESTACAO = Object.fromEntries(
  MOTIVOS_CONTESTACAO.map(({ valor, rotulo }) => [valor, rotulo])
);

export const ROTULO_RESULTADO_CONTESTACAO = {
  procedente: 'Procedente',
  improcedente: 'Improcedente',
};

export const TOM_RESULTADO_CONTESTACAO = {
  procedente: 'sucesso',
  improcedente: 'perigo',
};
