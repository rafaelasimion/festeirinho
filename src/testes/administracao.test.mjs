import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarParametro, validarConsistencia, antecedenciaMinimaDias,
} from '@/lib/parametros';
import { MOTIVOS_AVALIACAO, MOTIVOS_FORNECEDOR } from '@/lib/denuncia';
import { MOTIVOS_CONTESTACAO } from '@/lib/contestacao';
import { mudouDadoDaVitrine } from '@/lib/fornecedor';

// RF041 / UC 028 — configuração de parâmetros.
const valoresPadrao = {
  percentual_comissao: 10,
  multa_cancelamento_faixa_mais_7d: 0,
  multa_cancelamento_faixa_7d_48h: 25,
  multa_cancelamento_faixa_48h_24h: 50,
  multa_cancelamento_faixa_24h: 100,
  prazo_resposta_fornecedor_horas: 48,
  prazo_pagamento_horas: 24,
};

describe('UC 028 · parâmetros do sistema', () => {
  it('os valores semeados pelo DDL são consistentes', () => {
    assert.equal(validarConsistencia(valoresPadrao), null);
  });

  it('5a: multa menor perto do evento é recusada', () => {
    const erro = validarConsistencia({ ...valoresPadrao, multa_cancelamento_faixa_48h_24h: 20 });
    assert.match(erro, /não pode ser menor/);
  });

  it('5a: comissão de 100% é recusada, porque não sobraria repasse', () => {
    assert.match(validarConsistencia({ ...valoresPadrao, percentual_comissao: 100 }), /menor que 100%/);
  });

  it('cada parâmetro respeita a sua faixa e o seu tipo', () => {
    assert.equal(validarParametro('percentual_comissao', '12,5'), null);
    assert.notEqual(validarParametro('percentual_comissao', '-1'), null);
    assert.notEqual(validarParametro('prazo_pagamento_horas', '24,5'), null);
    assert.notEqual(validarParametro('periodo_carencia_repasse_dias', '91'), null);
    assert.notEqual(validarParametro('parametro_inexistente', '1'), null);
  });
});

// RN046 — antecedência mínima = resposta do fornecedor + pagamento + 24 h.
describe('RN046 · antecedência mínima de um serviço', () => {
  it('com os prazos padrão (48 h + 24 h + 24 h): 4 dias', () => {
    assert.equal(antecedenciaMinimaDias(valoresPadrao), 4);
  });

  it('arredonda para cima: 49 h + 24 h + 24 h = 97 h → 5 dias', () => {
    assert.equal(antecedenciaMinimaDias({ ...valoresPadrao, prazo_resposta_fornecedor_horas: 49 }), 5);
  });
});

// RN052 / RN069 — os motivos que as telas oferecem precisam ser aceitos
// pelo banco. Os valores abaixo são os ENUMs e os CHECKs do festeirinho-ddl.sql.
describe('RN052 · motivos de denúncia coerentes com o banco', () => {
  const enumDoBanco = [
    'conteudo_inadequado', 'conduta_no_chat', 'servico_nao_prestado', 'servico_divergente',
    'cobranca_fora_da_plataforma', 'informacoes_falsas', 'outro',
  ];

  it('denúncia de avaliação: só "conteúdo inadequado" ou "outro" (chk_denuncia_motivo)', () => {
    assert.deepEqual(MOTIVOS_AVALIACAO.map((m) => m.valor).sort(), ['conteudo_inadequado', 'outro']);
  });

  it('denúncia de fornecedor: os seis motivos do RF067, sem "conteúdo inadequado"', () => {
    const valores = MOTIVOS_FORNECEDOR.map((m) => m.valor);
    assert.equal(valores.length, 6);
    assert.ok(!valores.includes('conteudo_inadequado'));
    for (const v of valores) assert.ok(enumDoBanco.includes(v), v);
  });
});

describe('RN069 · motivos de contestação coerentes com o banco', () => {
  it('os três motivos do RF069, iguais ao ENUM motivo_contestacao_cliente', () => {
    assert.deepEqual(
      MOTIVOS_CONTESTACAO.map((m) => m.valor).sort(),
      ['servico_divergente', 'servico_nao_prestado', 'servico_parcial']
    );
  });
});

// RN067 / RF004 — alterar dado exibido na vitrine devolve o fornecedor à
// verificação; os demais dados, não.
describe('RN067 · nova verificação ao alterar a vitrine', () => {
  const atual = {
    nome_exibicao: 'Bruno Animações', descricao: 'Recreação e personagens',
    instagram_url: 'https://instagram.com/bruno', whatsapp_url: null, site: null,
  };
  const igual = {
    nomeExibicao: 'Bruno Animações', descricao: 'Recreação e personagens',
    instagramUrl: 'https://instagram.com/bruno', whatsappUrl: '', site: '',
  };

  it('nada mudou (vazio e nulo contam como iguais): não volta à verificação', () => {
    assert.equal(mudouDadoDaVitrine(atual, igual), false);
  });

  it('só espaços a mais no fim: não volta à verificação', () => {
    assert.equal(mudouDadoDaVitrine(atual, { ...igual, nomeExibicao: 'Bruno Animações  ' }), false);
  });

  for (const campo of ['nomeExibicao', 'descricao', 'instagramUrl', 'whatsappUrl', 'site']) {
    it(`mudou ${campo}: volta à verificação`, () => {
      assert.equal(mudouDadoDaVitrine(atual, { ...igual, [campo]: 'https://novo.exemplo.com' }), true);
    });
  }
});
