// RN029 — o valor final não é negociado: é calculado pelo sistema.
//
//   cobrança "hora"   → preço base × duração informada
//   cobrança "pessoa" → preço base × número de convidados
//
// O preço base e o tipo de cobrança usados são os vigentes NO MOMENTO DO
// ENVIO. Por isso a solicitação guarda uma cópia do preço (valor_referencia)
// e o valor já calculado (valor_final): mudanças posteriores no serviço não
// alteram solicitações que já saíram.
//
// Esta função roda nos dois lados — na tela, para mostrar o total antes do
// envio (RF028), e no servidor, que é quem grava. O número que vale é
// sempre o do servidor.

export function calcularValorFinal({ precoBase, cobranca, duracao, numeroConvidados }) {
  const multiplicador = cobranca === 'hora' ? duracao : numeroConvidados;
  const valor = Number(precoBase) * Number(multiplicador);
  if (!Number.isFinite(valor)) return null;
  // DECIMAL(10,2): duas casas, arredondando.
  return Math.round(valor * 100) / 100;
}

export function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export const ROTULO_STATUS_SOLICITACAO = {
  aguardando_analise: 'Aguardando análise do fornecedor',
  aguardando_pagamento: 'Aguardando pagamento',
  confirmado: 'Confirmada',
  concluido: 'Concluída',
  recusado: 'Recusada',
  cancelado: 'Cancelada',
  expirado: 'Expirada por falta de resposta',
};

export const ROTULO_MOTIVO_RECUSA = {
  agenda_indisponivel: 'Agenda indisponível',
  fora_da_area: 'Fora da área de atendimento',
  inviabilidade: 'Inviabilidade técnica, operacional ou logística',
  outro: 'Outro motivo',
};