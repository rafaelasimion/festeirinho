import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarLuhn, detectarBandeira, validarValidade, validarCVV, ultimosQuatro,
  conferirCartao,
} from '@/lib/cartao';
import { validarDadosRecebimento } from '@/lib/recebimento';
import { marcosDaSolicitacao } from '@/lib/solicitacao';

// RF032 / RN013 — cadastro de cartão: só número válido sai do formulário,
// e do número completo só os quatro últimos dígitos ficam no sistema.
describe('RF032 · cartão de crédito', () => {
  it('número de cartão pela conta de Luhn', () => {
    assert.equal(validarLuhn('4111 1111 1111 1111'), true);
    assert.equal(validarLuhn('5555 5555 5555 4444'), true);
    assert.equal(validarLuhn('4111 1111 1111 1112'), false);
    assert.equal(validarLuhn('4111'), false);
  });

  it('bandeira pelo início do número', () => {
    assert.equal(detectarBandeira('4111111111111111'), 'Visa');
    assert.equal(detectarBandeira('5555555555554444'), 'Mastercard');
    assert.equal(detectarBandeira('2221000000000009'), 'Mastercard');
    assert.equal(detectarBandeira('378282246310005'), 'Amex');
    assert.equal(detectarBandeira('6362970000457013'), 'Elo');
  });

  it('código de segurança: 4 dígitos no Amex, 3 nas demais', () => {
    assert.equal(validarCVV('1234', 'Amex'), true);
    assert.equal(validarCVV('123', 'Amex'), false);
    assert.equal(validarCVV('123', 'Visa'), true);
    assert.equal(validarCVV('1234', 'Visa'), false);
  });

  it('validade: o cartão vale até o fim do mês impresso', () => {
    const hoje = new Date();
    const mmaa = (data) => `${String(data.getMonth() + 1).padStart(2, '0')}/${String(data.getFullYear()).slice(2)}`;
    assert.equal(validarValidade(mmaa(hoje)), true);
    const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    assert.equal(validarValidade(mmaa(mesPassado)), false);
    assert.equal(validarValidade('13/30'), false);
  });

  it('RN013: do número só os quatro últimos dígitos são guardados', () => {
    assert.equal(ultimosQuatro('4111 1111 1111 1234'), '1234');
  });

  // UC 030, 5a / D04 — cada campo errado tem a sua mensagem, a mesma na
  // tela e no servidor.
  it('5a: cada campo errado diz o que está errado (CT-59)', () => {
    const erros = conferirCartao({
      numero: '4111 1111 1111 1112', nomeImpresso: 'Ana Souza',
      validade: '01/20', cvv: '12', apelido: '',
    });
    assert.equal(erros.numero, 'Número de cartão inválido.');
    assert.equal(erros.validade, 'Validade inválida ou vencida.');
    assert.equal(erros.cvv, 'Código de segurança inválido.');
    assert.equal(erros.nomeImpresso, undefined);
  });

  it('5a: formulário vazio pede cada campo, e o apelido é opcional', () => {
    const erros = conferirCartao({ numero: '', nomeImpresso: '', validade: '', cvv: '', apelido: '' });
    assert.deepEqual(Object.keys(erros).sort(), ['cvv', 'nomeImpresso', 'numero', 'validade']);
  });
});

// RN061 — dados de recebimento de saque e de reembolso.
describe('RN061 · dados de recebimento', () => {
  const titular = { nomeTitular: 'Ana Souza', cpfCnpjTitular: '111.444.777-35' };

  it('Pix com chave CPF válida: aceito, chave só com dígitos', () => {
    const { erros, dados } = validarDadosRecebimento({
      ...titular, tipoRecebimento: 'pix', tipoChavePix: 'cpf', chavePix: '111.444.777-35',
    });
    assert.deepEqual(erros, {});
    assert.equal(dados.chavePix, '11144477735');
    assert.equal(dados.banco, null);
  });

  it('Pix com e-mail, telefone ou chave aleatória', () => {
    const casos = [
      ['email', 'Ana@Exemplo.com', 'ana@exemplo.com'],
      ['telefone', '(16) 99999-0001', '16999990001'],
      ['aleatoria', '123E4567-E89B-12D3-A456-426614174000', '123e4567-e89b-12d3-a456-426614174000'],
    ];
    for (const [tipoChavePix, chavePix, gravada] of casos) {
      const { erros, dados } = validarDadosRecebimento({
        ...titular, tipoRecebimento: 'pix', tipoChavePix, chavePix,
      });
      assert.deepEqual(erros, {}, tipoChavePix);
      assert.equal(dados.chavePix, gravada, tipoChavePix);
    }
  });

  it('Pix com chave inválida para o tipo: recusado', () => {
    const { erros } = validarDadosRecebimento({
      ...titular, tipoRecebimento: 'pix', tipoChavePix: 'cpf', chavePix: '111.444.777-00',
    });
    assert.ok(erros.chavePix);
  });

  it('conta bancária completa: aceita, sem campos de Pix', () => {
    const { erros, dados } = validarDadosRecebimento({
      ...titular, tipoRecebimento: 'conta_bancaria', banco: 'Banco do Brasil',
      tipoConta: 'corrente', agencia: '1234-5', numeroConta: '56789-x',
    });
    assert.deepEqual(erros, {});
    assert.equal(dados.agencia, '12345');
    assert.equal(dados.numeroConta, '56789-X');
    assert.equal(dados.chavePix, null);
  });

  it('conta bancária sem agência e sem tipo de conta: recusada', () => {
    const { erros } = validarDadosRecebimento({
      ...titular, tipoRecebimento: 'conta_bancaria', banco: 'Banco do Brasil',
      tipoConta: '', agencia: '', numeroConta: '56789',
    });
    assert.ok(erros.agencia);
    assert.ok(erros.tipoConta);
  });

  it('titular com CNPJ (fornecedor PJ): aceito', () => {
    const { erros, dados } = validarDadosRecebimento({
      nomeTitular: 'Rafa Festas LTDA', cpfCnpjTitular: '11.222.333/0001-81',
      tipoRecebimento: 'pix', tipoChavePix: 'cnpj', chavePix: '11.222.333/0001-81',
    });
    assert.deepEqual(erros, {});
    assert.equal(dados.cpfCnpjTitular, '11222333000181');
  });

  it('documento do titular inválido: recusado', () => {
    const { erros } = validarDadosRecebimento({
      nomeTitular: 'Ana Souza', cpfCnpjTitular: '123',
      tipoRecebimento: 'pix', tipoChavePix: 'email', chavePix: 'ana@exemplo.com',
    });
    assert.ok(erros.cpfCnpjTitular);
  });

  it('forma de recebimento fora das duas opções: recusada', () => {
    const { erros } = validarDadosRecebimento({ ...titular, tipoRecebimento: 'dinheiro' });
    assert.ok(erros.tipoRecebimento);
  });
});

// RF023 / RN025 / RN048 — o pagamento que não acontece aparece no
// histórico da solicitação (CT-65, D05).
describe('RF023 · histórico de pagamento não realizado', () => {
  const base = {
    status: 'cancelado',
    data_solicitacao: '2026-10-14 09:00:00',
    data_resposta_fornecedor: '2026-10-14 10:00:00',
  };
  const titulos = (solicitacao) => marcosDaSolicitacao(solicitacao).map((m) => m.titulo);

  it('prazo esgotado: marco de cancelamento depois da aprovação', () => {
    assert.deepEqual(titulos({
      ...base, status_pagamento: 'expirado', data_fim_pagamento: '2026-10-14 11:05:00',
    }), ['Solicitação enviada', 'Aprovada pelo fornecedor', 'Cancelada: prazo de pagamento esgotado']);
  });

  it('três recusas: marco próprio', () => {
    assert.ok(titulos({
      ...base, status_pagamento: 'recusado', data_fim_pagamento: '2026-10-14 10:30:00',
    }).includes('Cancelada: pagamento recusado'));
  });

  it('cancelamento pelo UC 022 não ganha o marco de pagamento', () => {
    const lista = titulos({
      ...base, status_pagamento: 'cancelado', data_cancelamento: '2026-10-14 10:20:00',
      solicitado_por: 'cliente',
    });
    assert.ok(lista.includes('Cancelamento registrado'));
    assert.ok(!lista.some((t) => t.startsWith('Cancelada:')));
  });
});
