import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  chavesDaTentativa, segundosDeBloqueio, registrarFalha, limparFalhasDaConta, mensagemDeBloqueio,
} from '@/lib/tentativas';
import { montarMensagem, montarAssuntoEmail } from '@/lib/suporte';
import { formatarData, formatarDataHora, paraSerializar } from '@/lib/datas';

// RNF020 — limite de tentativas de autenticação.
// Cada teste usa uma conta e uma origem próprias: o registro de tentativas
// é compartilhado pelo processo, como no servidor.
const requisicao = (ip) => ({ headers: new Headers(ip ? { 'x-forwarded-for': ip } : {}) });

describe('RNF020 · tentativas sucessivas de autenticação', () => {
  it('a conta é bloqueada na 5ª falha, e não antes', () => {
    const chaves = chavesDaTentativa(requisicao(), 'conta.um@exemplo.com');
    for (let i = 1; i <= 4; i++) {
      registrarFalha(chaves);
      assert.equal(segundosDeBloqueio(chaves), 0, `falha ${i}`);
    }
    registrarFalha(chaves);
    assert.ok(segundosDeBloqueio(chaves) > 14 * 60, 'bloqueio de cerca de 15 minutos');
  });

  it('o identificador não diferencia maiúsculas nem espaços', () => {
    const a = chavesDaTentativa(requisicao(), ' Conta.Dois@Exemplo.com ');
    const b = chavesDaTentativa(requisicao(), 'conta.dois@exemplo.com');
    assert.deepEqual(a, b);
  });

  it('a origem da requisição é bloqueada na 20ª falha, mesmo variando a conta', () => {
    const ip = '203.0.113.7';
    for (let i = 1; i <= 19; i++) registrarFalha(chavesDaTentativa(requisicao(ip), `alvo${i}@exemplo.com`));
    const nova = chavesDaTentativa(requisicao(ip), 'conta.nova@exemplo.com');
    assert.equal(segundosDeBloqueio(nova), 0);
    registrarFalha(chavesDaTentativa(requisicao(ip), 'alvo20@exemplo.com'));
    assert.ok(segundosDeBloqueio(nova) > 0, 'origem bloqueada para qualquer conta');
  });

  it('login certo limpa as falhas da conta, mas não as da origem', () => {
    const ip = '203.0.113.8';
    const chaves = chavesDaTentativa(requisicao(ip), 'conta.tres@exemplo.com');
    for (let i = 0; i < 4; i++) registrarFalha(chaves);
    limparFalhasDaConta(chaves);
    registrarFalha(chaves);
    assert.equal(segundosDeBloqueio(chaves), 0, 'a contagem da conta recomeçou');
  });

  it('mensagem informa o tempo de espera sem dizer se a conta existe', () => {
    assert.equal(mensagemDeBloqueio(60), 'Muitas tentativas de acesso. Aguarde 1 minuto e tente novamente.');
    assert.equal(mensagemDeBloqueio(14 * 60 + 1), 'Muitas tentativas de acesso. Aguarde 15 minutos e tente novamente.');
    assert.doesNotMatch(mensagemDeBloqueio(60), /conta|senha|usuário/i);
  });
});

// RF063 / RN063 — mensagem do suporte pré-preenchida com o contexto.
describe('RN063 · contato com o suporte', () => {
  it('a partir da tela de pagamento: assunto, usuário e número da solicitação', () => {
    const texto = montarMensagem({
      assunto: 'pagamento',
      usuario: { tipoUsuario: 'cliente', nome: 'Ana Souza', email: 'ana@exemplo.com' },
      contexto: { idSolicitacao: 12, servico: 'Recreação infantil', origem: 'pagamento' },
    });
    assert.match(texto, /^Assunto: Pagamento/);
    assert.match(texto, /Sou cliente no Festeirinho: Ana Souza \(ana@exemplo.com\)/);
    assert.match(texto, /Solicitação nº 12 — Recreação infantil \(aberto pela tela de pagamento\)/);
  });

  it('pelo menu geral, sem contexto: sem número de solicitação (fluxo 2a)', () => {
    const texto = montarMensagem({ assunto: 'outro' });
    assert.doesNotMatch(texto, /Solicitação nº/);
    assert.equal(montarAssuntoEmail({ assunto: 'outro' }), 'Festeirinho — Outro assunto');
  });
});

// RNF014 — datas no formato dia/mês/ano, sem conversão de fuso.
describe('RNF014 · datas', () => {
  it('data e hora do banco exibidas como foram gravadas', () => {
    assert.equal(formatarData('2026-09-28 20:53:00'), '28/09/2026');
    assert.equal(formatarDataHora('2026-09-28 20:53:00'), '28/09/2026, 20:53');
  });

  it('coluna só de data não ganha uma meia-noite inventada', () => {
    assert.equal(formatarDataHora('2026-09-28'), '28/09/2026');
  });

  it('valor enviado ao navegador sai em ISO, sem fuso, para não andar três horas', () => {
    assert.equal(paraSerializar('2026-09-28 20:53:00'), '2026-09-28T20:53:00');
    assert.equal(paraSerializar(null), null);
  });
});
