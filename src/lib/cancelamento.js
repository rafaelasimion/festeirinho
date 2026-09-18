// Cálculo do cancelamento — funções puras, sem banco.
//
// Ficam separadas do módulo de servidor porque a TELA também precisa delas:
// o cliente vê quanto vai receber de volta antes de confirmar (UC 022), e o
// número que ele vê é calculado pela mesma função que o servidor usa para
// gravar. Um módulo que importa o banco não pode ser carregado por componente
// de tela.

export const ROTULO_STATUS_CANCELAMENTO = {
  em_analise: 'Em análise',
  processando: 'Processando reembolso',
  concluido: 'Concluído',
};

export const ROTULO_ORIGEM_CANCELAMENTO = {
  cliente: 'Cancelado pelo cliente',
  fornecedor: 'Cancelado pelo fornecedor',
  sistema: 'Cancelado automaticamente pelo sistema',
};

// RN050 — a faixa vem da antecedência em relação ao evento, e os percentuais
// são os CONGELADOS no pagamento (RN027), não os atuais da configuração:
// quem contratou ontem cancela sob as regras de ontem.
export function calcularFaixa(dataEvento, pagamento) {
  const horasRestantes = (new Date(dataEvento) - new Date()) / 3600000;

  if (horasRestantes >= 24 * 7) {
    return {
      percentual: Number(pagamento.perc_multa_faixa_mais_7d),
      rotulo: '7 dias ou mais antes do evento',
    };
  }
  if (horasRestantes >= 48) {
    return {
      percentual: Number(pagamento.perc_multa_faixa_7d_48h),
      rotulo: 'entre 7 dias e 48 horas antes do evento',
    };
  }
  if (horasRestantes >= 24) {
    return {
      percentual: Number(pagamento.perc_multa_faixa_48h_24h),
      rotulo: 'entre 48 e 24 horas antes do evento',
    };
  }
  return {
    percentual: Number(pagamento.perc_multa_faixa_24h),
    rotulo: 'menos de 24 horas antes do evento',
  };
}

// Calcula sem gravar nada. `pagamento` pode ser null quando a solicitação
// ainda está aguardando pagamento.
export function calcularValores({ solicitadoPor, dataEvento, pagamento }) {
  const pago = pagamento?.status === 'pago';

  // RN026 — pagamento não efetivado: não há o que reembolsar nem o que reter.
  if (!pago) {
    return {
      valorMulta: 0,
      valorReembolso: 0,
      percentual: 0,
      rotulo: null,
      pago: false,
    };
  }

  const valorBruto = Number(pagamento.valor_bruto);

  // RN051 — cancelamento por fornecedor ou pelo sistema: reembolso integral,
  // sem multa, qualquer que seja a antecedência.
  if (solicitadoPor !== 'cliente') {
    return {
      valorMulta: 0,
      valorReembolso: valorBruto,
      percentual: 0,
      rotulo: 'reembolso integral, sem multa',
      pago: true,
    };
  }

  const { percentual, rotulo } = calcularFaixa(dataEvento, pagamento);
  const valorMulta = Math.round(valorBruto * percentual) / 100;
  const valorReembolso = Math.round((valorBruto - valorMulta) * 100) / 100;

  return { valorMulta, valorReembolso, percentual, rotulo, pago: true };
}

// RN041 — o cancelamento a pedido das partes só vale para solicitações
// "aguardando pagamento" ou "confirmado", e apenas antes do evento.
// Devolve a mensagem do impedimento, ou null quando pode cancelar.
export function impedimentoParaCancelar({ status, dataEvento, temCancelamento }) {
  if (temCancelamento) {
    return 'Esta solicitação já possui um cancelamento registrado.';
  }
  if (!['aguardando_pagamento', 'confirmado'].includes(status)) {
    return 'Esta solicitação não está em um status que admita cancelamento.';
  }
  if (new Date(dataEvento) <= new Date()) {
    return 'O evento já ocorreu: a solicitação segue pelo fluxo de conclusão.';
  }
  return null;
}
