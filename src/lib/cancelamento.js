// Cálculo do cancelamento — funções puras, sem banco.
//
// Ficam separadas do módulo de servidor porque a TELA também precisa delas:
// o cliente vê quanto vai receber de volta antes de confirmar (UC 022), e o
// número que ele vê é calculado pela mesma função que o servidor usa para
// gravar.

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
// são os CONGELADOS no pagamento (RN027), não os atuais da configuração.
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
    return { valorMulta: 0, valorReembolso: 0, percentual: 0, rotulo: null, pago: false };
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

  // Em centavos inteiros, pelo mesmo motivo do calcularValorFinal (RN029): a
  // multa cai exatamente no meio do centavo com frequência, e aí
  // `Math.round(bruto * percentual)` depende de o produto em ponto flutuante
  // ter caído um fio acima ou abaixo do meio. Medido: na faixa de 50% isso
  // acontecia em 3,3% dos valores entre R$ 20 e R$ 5.000, e na de 25% em
  // 1,6% — sempre um centavo, sempre no dinheiro que vai para o fornecedor
  // (RN057) e aparece no comprovante de cancelamento (RN059).
  //
  // Exemplo: R$ 512,05 a 50% dava multa 256,02 e reembolso 256,03, quando a
  // conta decimal dá 256,03 e 256,02 — porque 512.05 * 50 em ponto flutuante
  // é 25602.499999999996, e não 25602,5.
  const brutoCentavos = Math.round(valorBruto * 100);
  const percentualCentesimos = Math.round(percentual * 100);

  const escalado = brutoCentavos * percentualCentesimos;   // escala 10.000
  const resto = escalado % 10000;
  const inteiros = (escalado - resto) / 10000;
  const multaCentavos = resto >= 5000 ? inteiros + 1 : inteiros;

  const valorMulta = multaCentavos / 100;
  const valorReembolso = (brutoCentavos - multaCentavos) / 100;

  return { valorMulta, valorReembolso, percentual, rotulo, pago: true };
}

// Condições que impedem o cancelamento a pedido das partes (UC 022).
// Devolve a mensagem do impedimento, ou null quando pode cancelar.
//
// As quatro travas, na ordem em que fazem sentido explicar:
//   1. já existe cancelamento (RN007)
//   2. status não admite (RN041)
//   3. a conclusão já foi registrada — o serviço foi prestado, e o que
//      resta é confirmar ou contestar, não cancelar
//   4. há contestação em aberto — a solicitação está sob decisão da
//      administração e não pode seguir por outro caminho (RN069)
//
// A terceira e a quarta valem para os DOIS lados: nem cliente nem fornecedor
// cancelam um serviço que já foi executado ou que está em disputa.
export function impedimentoParaCancelar({
  status,
  dataEvento,
  temCancelamento,
  conclusaoRegistrada = false,
  contestacaoPendente = false,
}) {
  if (temCancelamento) {
    return 'Esta solicitação já possui um cancelamento registrado.';
  }
  if (!['aguardando_pagamento', 'confirmado'].includes(status)) {
    return 'Esta solicitação não está em um status que admita cancelamento.';
  }
  if (contestacaoPendente) {
    return 'Há uma contestação em análise: aguarde a decisão da administração.';
  }
  if (conclusaoRegistrada) {
    return 'A conclusão do serviço já foi registrada: a solicitação segue pelo fluxo de conclusão.';
  }
  if (new Date(dataEvento) <= new Date()) {
    return 'O evento já ocorreu: a solicitação segue pelo fluxo de conclusão.';
  }
  return null;
}
