import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarCPF, validarCNPJ, validarEmail, validarTelefone, validarUF, validarURL,
  validarNomeUsuario, validarDataNascimento, validarMaioridade, lerDecimal, lerInteiro,
} from '@/lib/validacao';

// RF045 — formato e dígito verificador do CPF e do CNPJ.
// Os documentos válidos abaixo tiveram os dígitos conferidos por um cálculo
// feito fora do sistema.
describe('RF045 · CPF', () => {
  it('aceita CPF válido, com ou sem pontuação', () => {
    assert.equal(validarCPF('529.982.247-25'), true);
    assert.equal(validarCPF('52998224725'), true);
    assert.equal(validarCPF('111.444.777-35'), true);
  });

  it('recusa dígito verificador errado', () => {
    assert.equal(validarCPF('529.982.247-24'), false);
    assert.equal(validarCPF('111.444.777-53'), false);
  });

  it('recusa sequências repetidas, que passam na conta mas não são CPF', () => {
    for (const d of '0123456789') assert.equal(validarCPF(d.repeat(11)), false, d.repeat(11));
  });

  it('recusa tamanho errado', () => {
    assert.equal(validarCPF('5299822472'), false);
    assert.equal(validarCPF('529982247250'), false);
    assert.equal(validarCPF(''), false);
  });
});

describe('RF045 · CNPJ (numérico e alfanumérico)', () => {
  it('aceita CNPJ numérico válido', () => {
    assert.equal(validarCNPJ('11.222.333/0001-81'), true);
  });

  it('aceita CNPJ alfanumérico válido (formato da Receita a partir de 2026)', () => {
    assert.equal(validarCNPJ('12.ABC.345/01DE-35'), true);
    assert.equal(validarCNPJ('12abc34501de35'), true);
  });

  it('recusa dígito verificador errado', () => {
    assert.equal(validarCNPJ('11.222.333/0001-82'), false);
    assert.equal(validarCNPJ('12.ABC.345/01DE-53'), false);
  });

  it('recusa letras nos dígitos verificadores e tamanho errado', () => {
    assert.equal(validarCNPJ('12ABC34501DEAB'), false);
    assert.equal(validarCNPJ('1122233300018'), false);
  });
});

// RF001 / RF002 — dados de usuário do cadastro.
describe('RF001 · dados de usuário', () => {
  it('e-mail', () => {
    assert.equal(validarEmail('ana@exemplo.com'), true);
    assert.equal(validarEmail('ana@exemplo'), false);
    assert.equal(validarEmail('ana exemplo.com'), false);
  });

  it('telefone com DDD: 10 ou 11 dígitos', () => {
    assert.equal(validarTelefone('(16) 99999-0001'), true);
    assert.equal(validarTelefone('(16) 3333-0001'), true);
    assert.equal(validarTelefone('99999-0001'), false);
  });

  it('estado: só as 27 siglas', () => {
    assert.equal(validarUF('SP'), true);
    assert.equal(validarUF('sp'), true);
    assert.equal(validarUF('XX'), false);
  });

  it('nome de usuário: 3 a 50 letras, números, ponto ou sublinhado', () => {
    assert.equal(validarNomeUsuario('ana.souza'), true);
    assert.equal(validarNomeUsuario('an'), false);
    assert.equal(validarNomeUsuario('ana souza'), false);
  });

  it('redes sociais: só endereços http ou https', () => {
    assert.equal(validarURL('https://instagram.com/festeirinho'), true);
    assert.equal(validarURL(''), true);
    assert.equal(validarURL('javascript:alert(1)'), false);
    assert.equal(validarURL('ftp://exemplo.com'), false);
  });
});

// RF001 / RF002 — idade mínima de 18 anos completos na data do cadastro.
describe('RF001 · data de nascimento e maioridade', () => {
  const diasAtras = (anos, deslocamentoDias = 0) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - anos);
    d.setDate(d.getDate() + deslocamentoDias);
    const dd = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
  };

  it('18 anos completos hoje: aceito', () => {
    assert.equal(validarMaioridade(diasAtras(18)), true);
  });

  it('faz 18 anos amanhã: recusado', () => {
    assert.equal(validarMaioridade(diasAtras(18, 1)), false);
  });

  it('data no futuro: recusada', () => {
    assert.equal(validarDataNascimento(diasAtras(0, 1)), false);
  });

  it('data que não existe no calendário: recusada', () => {
    // RNF005 — o servidor valida tudo o que recebe. 30/02 e 31/04 não
    // existem; aceitas aqui, chegariam ao MySQL, que recusa a data, e o
    // usuário veria um erro genérico em vez de "data inválida".
    assert.equal(validarDataNascimento('1990-02-30'), false);
    assert.equal(validarDataNascimento('1990-04-31'), false);
    assert.equal(validarDataNascimento('2001-02-29'), false);
  });

  it('29 de fevereiro em ano bissexto: aceito', () => {
    assert.equal(validarDataNascimento('2000-02-29'), true);
  });
});

// RNF005 — números digitados no padrão brasileiro.
describe('RNF005 · leitura de números digitados', () => {
  it('vírgula decimal é lida como decimal, não descartada', () => {
    assert.equal(lerDecimal('89,90'), 89.9);
    assert.equal(lerDecimal('150,50'), 150.5);
  });

  it('mais casas que o permitido: recusado, em vez de arredondado em silêncio', () => {
    assert.equal(lerDecimal('10,555'), null);
    assert.equal(lerDecimal('1.000,00'), null);
  });

  it('inteiro não aceita fração nem sinal', () => {
    assert.equal(lerInteiro('30'), 30);
    assert.equal(lerInteiro('7,5'), null);
    assert.equal(lerInteiro('-3'), null);
  });
});
