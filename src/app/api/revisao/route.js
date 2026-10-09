import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';
import {
  chavesDaTentativa,
  segundosDeBloqueio,
  registrarFalha,
  limparFalhasDaConta,
  mensagemDeBloqueio,
} from '@/lib/tentativas';

// UC 006 — solicitação de revisão de suspensão.
//
// O acesso vem da tela de bloqueio exibida no login (UC 003, 6a.2), com a
// conta suspensa e, portanto, SEM sessão. Por isso a rota pede as
// credenciais de novo: é o que garante que quem pede a revisão é o dono da
// conta, e não alguém que descobriu o id dela.
//
// Pedir credenciais faz desta rota uma segunda porta de autenticação, e
// ela precisa da mesma tranca da primeira (RNF020): o mesmo limite de
// tentativas do login, conferido antes do bcrypt, e a mesma resposta
// genérica para tudo que não for "conta suspensa com a senha certa".
// Sem isso, ela servia para adivinhar senhas sem limite — e ainda
// respondia "esta conta não está suspensa" quando a senha de uma conta
// ativa estava certa, confirmando o acerto.

export async function POST(request) {
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const identificador = String(corpo.identificador ?? '').trim();
  const senha = String(corpo.senha ?? '');
  const justificativa = String(corpo.justificativa ?? '').trim();

  if (justificativa.length < 20) {
    return NextResponse.json(
      { erro: 'Descreva sua justificativa em ao menos 20 caracteres.' },
      { status: 400 }
    );
  }
  if (justificativa.length > 1000) {
    return NextResponse.json({ erro: 'Justificativa muito longa.' }, { status: 400 });
  }

  // Mesma mensagem genérica do login (UC 003, 5a.1): a rota não pode virar
  // um jeito de descobrir quais contas existem.
  const CREDENCIAL_INVALIDA = NextResponse.json(
    { erro: 'E-mail, nome de usuário ou senha incorretos.' },
    { status: 401 }
  );

  if (identificador === '' || senha === '') return CREDENCIAL_INVALIDA;

  // RNF020 — o mesmo bloqueio do login (UC 003, 5b), com as mesmas chaves:
  // errar a senha aqui ou lá conta na mesma série.
  const chaves = chavesDaTentativa(request, identificador);
  const segundos = segundosDeBloqueio(chaves);
  if (segundos > 0) {
    return NextResponse.json({ erro: mensagemDeBloqueio(segundos) }, { status: 429 });
  }

  function recusar() {
    registrarFalha(chaves);
    const espera = segundosDeBloqueio(chaves);
    return espera > 0
      ? NextResponse.json({ erro: mensagemDeBloqueio(espera) }, { status: 429 })
      : CREDENCIAL_INVALIDA;
  }

  try {
    const [usuarios] = await pool.execute(
      `SELECT id, tipo_usuario, senha_hash
         FROM usuario
        WHERE email = ? OR nome_usuario = ?
        LIMIT 1`,
      [identificador.toLowerCase(), identificador]
    );
    if (usuarios.length === 0) return recusar();

    const usuario = usuarios[0];
    const senhaConfere = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaConfere) return recusar();

    const ehCliente = usuario.tipo_usuario === 'cliente';
    const tabela = ehCliente ? 'cliente' : 'fornecedor';
    const colunaStatus = ehCliente ? 'status_cliente' : 'status_fornecedor';

    const [perfis] = await pool.execute(
      `SELECT id, ${colunaStatus} AS status, status_solicitacao_revisao,
              data_solicitacao_revisao
         FROM ${tabela} WHERE id_usuario = ? LIMIT 1`,
      [usuario.id]
    );
    if (perfis.length === 0) return CREDENCIAL_INVALIDA;

    const perfil = perfis[0];

    // Pré-condição do UC 006: a conta precisa estar suspensa. Fora dela, a
    // resposta é a mesma da senha errada: dizer "não está suspensa" aqui
    // confirmaria que a senha de uma conta ativa acabou de ser acertada.
    // Quem chega por este caminho legitimamente veio da tela de bloqueio,
    // então nunca vê esta resposta.
    if (perfil.status !== 'suspenso') return CREDENCIAL_INVALIDA;

    // Credencial certa de conta suspensa: a série de erros desta conta
    // deixa de existir, como no login.
    limparFalhasDaConta(chaves);

    // UC 003, fluxos 6a.2 e 6a.4 — uma revisão por suspensão. Analisada e
    // mantida a suspensão, a decisão é final dentro da plataforma: a tela de
    // bloqueio mostra o resultado e o canal de suporte, e não um novo
    // formulário. A tela já seguia essa regra; a rota aceitava um segundo
    // pedido de quem a chamasse direto. Uma suspensão NOVA zera os campos
    // de revisão (api/admin/contas) e devolve o direito a um pedido.
    if (perfil.status_solicitacao_revisao === 'analisada') {
      return NextResponse.json(
        { erro: 'A revisão desta suspensão já foi analisada. Para fatos novos, fale com o suporte.' },
        { status: 409 }
      );
    }

    // UC 006, fluxo 3a — já existe pedido pendente.
    if (perfil.status_solicitacao_revisao === 'pendente') {
      return NextResponse.json(
        {
          erro: 'Já existe uma solicitação de revisão em análise para esta conta.',
          dataEnvio: perfil.data_solicitacao_revisao,
        },
        { status: 409 }
      );
    }

    // A CHECK admite três estados coerentes. O estado "pendente" exige
    // motivo e data preenchidos, com resultado e data de análise nulos —
    // por isso o UPDATE grava o conjunto inteiro, zerando uma análise
    // anterior que porventura exista.
    await pool.execute(
      `UPDATE ${tabela}
          SET motivo_solicitacao_revisao = ?,
              data_solicitacao_revisao = NOW(),
              status_solicitacao_revisao = 'pendente',
              resultado_solicitacao_revisao = NULL,
              data_analise_revisao = NULL
        WHERE id = ?`,
      [justificativa, perfil.id]
    );

    return NextResponse.json({ statusRevisao: 'pendente' }, { status: 201 });
  } catch (erroRevisao) {
    console.error('[revisao POST]', erroRevisao);
    return NextResponse.json(
      { erro: 'Não foi possível registrar a solicitação.' },
      { status: 500 }
    );
  }
}
