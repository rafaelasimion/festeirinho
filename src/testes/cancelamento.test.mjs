import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularValores, impedimentoParaCancelar } from '@/lib/cancelamento';

// RF039 / RN050 / RN051 / RN026 — reembolso e multa do cancelamento.
//
// As faixas de antecedência dependem da hora atual, então os eventos são
// marcados em relação a "agora", com folga de algumas horas de cada lado do
// limite da faixa.

const HORA = 3600000;
const daquiA = (horas) => new Date(Date.now() + horas * HORA);

// Percentuais congelados no pagamento, os mesmos que o DDL semeia (RN050).
const pagamentoPago = (valorBruto) => ({
  status: 'pago',
  valor_bruto: valorBruto,
  perc_multa_faixa_mais_7d: '0.00',
  perc_multa_faixa_7d_48h: '25.00',
  perc_multa_faixa_48h_24h: '50.00',
  perc_multa_faixa_24h: '100.00',
});

describe('RN050 · multa por faixa de antecedência (cancelamento pelo cliente)', () => {
  const casos = [
    ['7 dias ou mais antes: 0% de multa', 24 * 10, 0, 1000],
    ['entre 7 dias e 48 horas: 25%', 24 * 4, 250, 750],
    ['entre 48 e 24 horas: 50%', 36, 500, 500],
    ['menos de 24 horas: 100%', 6, 1000, 0],
  ];
  for (const [nome, horas, multa, reembolso] of casos) {
    it(nome, () => {
      const r = calcularValores({
        solicitadoPor: 'cliente', dataEvento: daquiA(horas), pagamento: pagamentoPago(1000),
      });
      assert.equal(r.valorMulta, multa);
      assert.equal(r.valorReembolso, reembolso);
    });
  }

  it('nos limites das faixas, vale a faixa de maior antecedência', () => {
    const limite = (horas) => calcularValores({
      solicitadoPor: 'cliente', dataEvento: daquiA(horas), pagamento: pagamentoPago(1000),
    }).percentual;
    // Um minuto a mais que o limite ainda está na faixa de cima.
    assert.equal(limite(24 * 7 + 1 / 60), 0);
    assert.equal(limite(48 + 1 / 60), 25);
    assert.equal(limite(24 + 1 / 60), 50);
    // Um minuto a menos já cai na de baixo.
    assert.equal(limite(24 * 7 - 1 / 60), 25);
    assert.equal(limite(48 - 1 / 60), 50);
    assert.equal(limite(24 - 1 / 60), 100);
  });

  it('usa os percentuais congelados no pagamento, e não outros', () => {
    const pagamento = { ...pagamentoPago(1000), perc_multa_faixa_7d_48h: '30.00' };
    const r = calcularValores({ solicitadoPor: 'cliente', dataEvento: daquiA(96), pagamento });
    assert.equal(r.valorMulta, 300);
  });

  it('multa e reembolso somam exatamente o valor pago, centavo por centavo', () => {
    for (let centavos = 2000; centavos <= 500000; centavos += 137) {
      const bruto = centavos / 100;
      for (const horas of [96, 36]) {
        const r = calcularValores({
          solicitadoPor: 'cliente', dataEvento: daquiA(horas), pagamento: pagamentoPago(bruto),
        });
        assert.equal(Math.round(r.valorMulta * 100) + Math.round(r.valorReembolso * 100), centavos);
      }
    }
  });

  it('meio centavo de multa arredonda para cima, como na conta decimal', () => {
    // 512,05 × 50% = 256,025 → multa 256,03 e reembolso 256,02.
    // Em ponto flutuante, 512.05 * 50 dá 25602.499999999996.
    const r = calcularValores({
      solicitadoPor: 'cliente', dataEvento: daquiA(36), pagamento: pagamentoPago(512.05),
    });
    assert.equal(r.valorMulta, 256.03);
    assert.equal(r.valorReembolso, 256.02);
  });
});

describe('RN051 · cancelamento pelo fornecedor ou pelo sistema', () => {
  for (const origem of ['fornecedor', 'sistema']) {
    it(`${origem}: reembolso integral, sem multa, mesmo a menos de 24 horas`, () => {
      const r = calcularValores({
        solicitadoPor: origem, dataEvento: daquiA(2), pagamento: pagamentoPago(1000),
      });
      assert.equal(r.valorMulta, 0);
      assert.equal(r.valorReembolso, 1000);
    });
  }
});

describe('RN026 · pagamento ainda não efetivado', () => {
  for (const status of ['pendente', 'processando', 'recusado']) {
    it(`pagamento ${status}: reembolso e multa iguais a zero`, () => {
      const r = calcularValores({
        solicitadoPor: 'cliente', dataEvento: daquiA(6),
        pagamento: { ...pagamentoPago(1000), status },
      });
      assert.equal(r.valorMulta, 0);
      assert.equal(r.valorReembolso, 0);
    });
  }

  it('sem pagamento gerado: reembolso e multa iguais a zero', () => {
    const r = calcularValores({ solicitadoPor: 'cliente', dataEvento: daquiA(6), pagamento: null });
    assert.equal(r.valorMulta, 0);
    assert.equal(r.valorReembolso, 0);
  });
});

describe('UC 022 · quando o cancelamento é permitido', () => {
  const base = {
    status: 'confirmado', dataEvento: daquiA(48), temCancelamento: false,
    conclusaoRegistrada: false, contestacaoPendente: false,
  };

  it('solicitação confirmada, evento futuro: permitido', () => {
    assert.equal(impedimentoParaCancelar(base), null);
  });

  it('aguardando pagamento: permitido (RN041)', () => {
    assert.equal(impedimentoParaCancelar({ ...base, status: 'aguardando_pagamento' }), null);
  });

  it('já existe cancelamento registrado: impedido (RN007)', () => {
    assert.match(impedimentoParaCancelar({ ...base, temCancelamento: true }), /já possui um cancelamento/);
  });

  it('status que não admite cancelamento: impedido (RN041)', () => {
    for (const status of ['aguardando_analise', 'concluido', 'cancelado', 'recusado', 'expirado']) {
      assert.notEqual(impedimentoParaCancelar({ ...base, status }), null, status);
    }
  });

  it('evento já ocorrido: impedido, segue pelo fluxo de conclusão (fluxo 1c)', () => {
    assert.match(impedimentoParaCancelar({ ...base, dataEvento: daquiA(-1) }), /fluxo de conclusão/);
  });

  it('conclusão já registrada: impedido', () => {
    assert.notEqual(impedimentoParaCancelar({ ...base, conclusaoRegistrada: true }), null);
  });

  it('contestação em análise: impedido (RN069)', () => {
    assert.match(impedimentoParaCancelar({ ...base, contestacaoPendente: true }), /contestação/);
  });
});
