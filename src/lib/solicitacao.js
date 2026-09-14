// RN029 — o valor final não é negociado: é calculado pelo sistema.
//
//   cobrança "hora"   → preço base × duração informada
//   cobrança "pessoa" → preço base × número de convidados
//   cobrança "fixo"   → o próprio preço base, sem multiplicador
//
// O preço base e o tipo de cobrança usados são os vigentes NO MOMENTO DO
// ENVIO. Por isso a solicitação guarda uma cópia do preço (valor_referencia)
// e o valor já calculado (valor_final): mudanças posteriores no serviço não
// alteram solicitações que já saíram.

export function calcularValorFinal({ precoBase, cobranca, duracao, numeroConvidados }) {
  const multiplicador =
    cobranca === 'fixo' ? 1
    : cobranca === 'hora' ? Number(duracao)
    : Number(numeroConvidados);

  const valor = Number(precoBase) * multiplicador;
  if (!Number.isFinite(valor)) return null;
  return Math.round(valor * 100) / 100;
}

export function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// Rótulo da forma de cobrança nos formulários, onde o fornecedor escolhe.
export const ROTULO_COBRANCA = {
  hora: 'Por hora',
  pessoa: 'Por pessoa',
  fixo: 'Valor fixo',
};

// Sufixo exibido ao lado do preço. Valor fixo não recebe sufixo: "R$ 800,00"
// já se explica sozinho.
export const SUFIXO_PRECO = {
  hora: ' por hora',
  pessoa: ' por pessoa',
  fixo: '',
};

// Explicação do cálculo, mostrada ao cliente antes do envio (RF028).
export const EXPLICACAO_COBRANCA = {
  hora: 'Preço por hora multiplicado pela duração informada.',
  pessoa: 'Preço por pessoa multiplicado pelo número de convidados.',
  fixo: 'Valor fixo do serviço, independente da duração e do número de convidados.',
};

export const ROTULO_STATUS_SOLICITACAO = {
  aguardando_analise: 'Aguardando análise',
  aguardando_pagamento: 'Aguardando pagamento',
  confirmado: 'Confirmado',
  concluido: 'Concluído',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  expirado: 'Expirado',
};

// O tom de cada status. Fica ao lado do rótulo para que as duas coisas
// nunca se separem: se um status novo entrar no sistema, o erro aparece
// aqui e não espalhado pelas telas.
export const TOM_STATUS_SOLICITACAO = {
  aguardando_analise: 'atencao',
  aguardando_pagamento: 'atencao',
  confirmado: 'sucesso',
  concluido: 'sucesso',
  recusado: 'perigo',
  cancelado: 'perigo',
  expirado: 'perigo',
};

export const ROTULO_VERIFICACAO = {
  pendente: 'em análise',
  aprovado: 'aprovado',
  rejeitado: 'não aprovado',
};

export const TOM_VERIFICACAO = {
  pendente: 'atencao',
  aprovado: 'roxo',
  rejeitado: 'perigo',
};

export const ROTULO_MOTIVO_RECUSA = {
  agenda_indisponivel: 'Agenda indisponível',
  fora_da_area: 'Fora da área de atendimento',
  inviabilidade: 'Inviabilidade técnica, operacional ou logística',
  outro: 'Outro motivo',
};