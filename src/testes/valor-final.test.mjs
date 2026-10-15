import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularValorFinal, lerDuracao, chatAberto } from '@/lib/solicitacao';

// RF027 / RN029 — o valor final é calculado pelo sistema a partir do preço
// base e do tipo de cobrança, sem negociação.

describe('RN029 · valor final da solicitação', () => {
  it('cobrança por hora: preço base × duração', () => {
    assert.equal(calcularValorFinal({ precoBase: 250, cobranca: 'hora', duracao: 4 }), 1000);
  });

  it('cobrança por hora aceita meia hora', () => {
    assert.equal(calcularValorFinal({ precoBase: 120, cobranca: 'hora', duracao: 2.5 }), 300);
  });

  it('cobrança por pessoa: preço base × número de convidados', () => {
    assert.equal(
      calcularValorFinal({ precoBase: 45.9, cobranca: 'pessoa', numeroConvidados: 30 }),
      1377
    );
  });

  it('cobrança fixa: o próprio preço base, sem multiplicador', () => {
    assert.equal(
      calcularValorFinal({ precoBase: 800, cobranca: 'fixo', duracao: 6, numeroConvidados: 90 }),
      800
    );
  });

  it('meio centavo arredonda para cima (arredondamento comercial)', () => {
    // 99,99 × 2,5 = 249,975 → 249,98
    assert.equal(calcularValorFinal({ precoBase: 99.99, cobranca: 'hora', duracao: 2.5 }), 249.98);
    // 0,15 × 1,5 = 0,225 → 0,23. Em ponto flutuante, 0.15 * 1.5 dá 0.22499999999999998.
    assert.equal(calcularValorFinal({ precoBase: 0.15, cobranca: 'hora', duracao: 1.5 }), 0.23);
  });

  it('o resultado nunca tem mais que dois centavos de casa decimal', () => {
    for (let centavos = 1; centavos <= 5000; centavos += 7) {
      for (const duracao of [0.5, 1, 1.5, 2.5, 3.5, 7.5]) {
        const valor = calcularValorFinal({ precoBase: centavos / 100, cobranca: 'hora', duracao });
        assert.equal(Math.round(valor * 100) / 100, valor, `${centavos / 100} × ${duracao}`);
      }
    }
  });

  it('tipo de cobrança desconhecido não vira um multiplicador por engano', () => {
    assert.equal(calcularValorFinal({ precoBase: 100, cobranca: 'diaria', duracao: 2 }), null);
  });
});

// RF017 — a duração é informada em meias horas.
describe('RF017 · duração estimada do evento', () => {
  it('aceita horas inteiras e meias horas, com vírgula ou ponto', () => {
    assert.equal(lerDuracao('4'), 4);
    assert.equal(lerDuracao('2,5'), 2.5);
    assert.equal(lerDuracao('2.5'), 2.5);
  });

  it('recusa frações que não são meia hora', () => {
    assert.equal(lerDuracao('2,3'), null);
    assert.equal(lerDuracao('1,25'), null);
  });

  it('recusa texto que não é número', () => {
    assert.equal(lerDuracao('quatro'), null);
    assert.equal(lerDuracao(''), null);
    assert.equal(lerDuracao('-2'), null);
  });
});

// RF026 / RN022 — o chat vai da aprovação do fornecedor até o registro da
// conclusão.
describe('RN022 · janela do chat', () => {
  it('fechado enquanto a solicitação aguarda a análise do fornecedor', () => {
    assert.equal(chatAberto({ status: 'aguardando_analise', conclusaoRegistrada: false }), false);
  });

  it('aberto depois da aprovação, aguardando pagamento ou confirmada', () => {
    assert.equal(chatAberto({ status: 'aguardando_pagamento', conclusaoRegistrada: false }), true);
    assert.equal(chatAberto({ status: 'confirmado', conclusaoRegistrada: false }), true);
  });

  it('fecha quando o fornecedor registra a conclusão', () => {
    assert.equal(chatAberto({ status: 'confirmado', conclusaoRegistrada: true }), false);
  });

  it('fechado nos status terminais', () => {
    for (const status of ['concluido', 'recusado', 'cancelado', 'expirado']) {
      assert.equal(chatAberto({ status, conclusaoRegistrada: false }), false, status);
    }
  });
});
