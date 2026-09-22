// Parâmetros configuráveis (RN014 / UC 028) — definições e validação, sem
// banco. A tela usa para montar o formulário e conferir antes de enviar; o
// servidor usa exatamente as mesmas regras para gravar.

export const GRUPOS = [
  { id: 'financeiro', titulo: 'Financeiro' },
  { id: 'multas', titulo: 'Multas por cancelamento do cliente' },
  { id: 'prazos', titulo: 'Prazos da contratação' },
  { id: 'contas', titulo: 'Contas e cadastro' },
];

// A unidade faz parte do nome da chave no banco (_horas, _dias). Aqui ela
// vira rótulo para a tela e define a faixa aceitável de cada valor.
export const PARAMETROS = {
  percentual_comissao: {
    grupo: 'financeiro', rotulo: 'Comissão da plataforma', unidade: '%',
    min: 0, max: 99.99, inteiro: false, regra: 'RN027',
  },
  valor_minimo_saque: {
    grupo: 'financeiro', rotulo: 'Valor mínimo de saque', unidade: 'R$',
    min: 0.01, max: 100000, inteiro: false, regra: 'RN060',
  },
  periodo_carencia_repasse_dias: {
    grupo: 'financeiro', rotulo: 'Carência do repasse', unidade: 'dias',
    min: 0, max: 90, inteiro: true, regra: 'RN056',
  },

  multa_cancelamento_faixa_mais_7d: {
    grupo: 'multas', rotulo: '7 dias ou mais antes do evento', unidade: '%',
    min: 0, max: 100, inteiro: false, regra: 'RN050',
  },
  multa_cancelamento_faixa_7d_48h: {
    grupo: 'multas', rotulo: 'Entre 7 dias e 48 horas', unidade: '%',
    min: 0, max: 100, inteiro: false, regra: 'RN050',
  },
  multa_cancelamento_faixa_48h_24h: {
    grupo: 'multas', rotulo: 'Entre 48 e 24 horas', unidade: '%',
    min: 0, max: 100, inteiro: false, regra: 'RN050',
  },
  multa_cancelamento_faixa_24h: {
    grupo: 'multas', rotulo: 'Menos de 24 horas', unidade: '%',
    min: 0, max: 100, inteiro: false, regra: 'RN050',
  },

  prazo_resposta_fornecedor_horas: {
    grupo: 'prazos', rotulo: 'Resposta do fornecedor', unidade: 'horas',
    min: 1, max: 720, inteiro: true, regra: 'RN035',
  },
  prazo_pagamento_horas: {
    grupo: 'prazos', rotulo: 'Pagamento (Pix e cartão)', unidade: 'horas',
    min: 1, max: 720, inteiro: true, regra: 'RN024',
  },
  antecedencia_minima_boleto_dias: {
    grupo: 'prazos', rotulo: 'Antecedência para ofertar boleto', unidade: 'dias',
    min: 1, max: 60, inteiro: true, regra: 'RN012',
  },
  prazo_confirmacao_conclusao_horas: {
    grupo: 'prazos', rotulo: 'Confirmação da conclusão pelo cliente', unidade: 'horas',
    min: 1, max: 720, inteiro: true, regra: 'RN039',
  },
  prazo_registro_conclusao_dias: {
    grupo: 'prazos', rotulo: 'Registro da conclusão pelo fornecedor', unidade: 'dias',
    min: 1, max: 60, inteiro: true, regra: 'RN066',
  },
  prazo_denuncia_fornecedor_dias: {
    grupo: 'prazos', rotulo: 'Denúncia do fornecedor pelo cliente', unidade: 'dias',
    min: 1, max: 365, inteiro: true, regra: 'RN052',
  },

  periodo_inatividade_cliente_dias: {
    grupo: 'contas', rotulo: 'Inatividade do cliente', unidade: 'dias',
    min: 30, max: 3650, inteiro: true, regra: 'RN043',
  },
  periodo_inatividade_fornecedor_dias: {
    grupo: 'contas', rotulo: 'Inatividade do fornecedor', unidade: 'dias',
    min: 30, max: 3650, inteiro: true, regra: 'RN047',
  },
  // A faixa acompanha a chk_fornecedor_raio do banco: um padrão fora dela
  // seria sugerido no cadastro e recusado na gravação.
  raio_atendimento_padrao_km: {
    grupo: 'contas', rotulo: 'Raio de atendimento sugerido', unidade: 'km',
    min: 1, max: 200, inteiro: true, regra: 'RN068',
  },
};

// Faixa e tipo de UM parâmetro. Devolve a mensagem de erro ou null.
export function validarParametro(chave, valor) {
  const definicao = PARAMETROS[chave];
  if (!definicao) return 'Parâmetro desconhecido.';

  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 'Informe um número.';
  if (definicao.inteiro && !Number.isInteger(numero)) {
    return `Informe um número inteiro de ${definicao.unidade}.`;
  }
  if (numero < definicao.min || numero > definicao.max) {
    return `O valor precisa estar entre ${definicao.min} e ${definicao.max} ${definicao.unidade}.`;
  }
  return null;
}

// UC 028, passo 5 — consistência entre parâmetros relacionados. Recebe o
// conjunto completo, já com o valor novo aplicado, e devolve a mensagem da
// inconsistência (fluxo 5a) ou null.
export function validarConsistencia(valores) {
  // RN050 — a multa nunca diminui à medida que o evento se aproxima:
  // cancelar mais tarde não pode custar menos que cancelar mais cedo.
  const faixas = [
    ['multa_cancelamento_faixa_mais_7d', '7 dias ou mais'],
    ['multa_cancelamento_faixa_7d_48h', 'entre 7 dias e 48 horas'],
    ['multa_cancelamento_faixa_48h_24h', 'entre 48 e 24 horas'],
    ['multa_cancelamento_faixa_24h', 'menos de 24 horas'],
  ];
  for (let i = 1; i < faixas.length; i++) {
    const [chaveAnterior, rotuloAnterior] = faixas[i - 1];
    const [chaveAtual, rotuloAtual] = faixas[i];
    if (Number(valores[chaveAtual]) < Number(valores[chaveAnterior])) {
      return `A multa de "${rotuloAtual}" não pode ser menor que a de "${rotuloAnterior}": ` +
        'cancelar mais perto do evento não pode custar menos.';
    }
  }

  // RN027 — a comissão sai do valor bruto; em 100% não sobraria repasse.
  if (Number(valores.percentual_comissao) >= 100) {
    return 'A comissão precisa ser menor que 100%, senão não há repasse ao fornecedor.';
  }

  return null;
}

// RN046 — a antecedência mínima exigível de um serviço cabe o prazo de
// resposta, o prazo de pagamento e as 24h anteriores ao evento.
export function antecedenciaMinimaDias(valores) {
  const horas =
    Number(valores.prazo_resposta_fornecedor_horas) +
    Number(valores.prazo_pagamento_horas) +
    24;
  return Math.ceil(horas / 24);
}

export function formatarValorParametro(chave, valor) {
  const definicao = PARAMETROS[chave];
  const numero = Number(valor);
  if (definicao?.unidade === 'R$') {
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  const texto = definicao?.inteiro
    ? String(Math.round(numero))
    : numero.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return definicao?.unidade === '%' ? `${texto}%` : `${texto} ${definicao?.unidade ?? ''}`.trim();
}
