import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { obterClienteLogado, obterFornecedorLogado } from '@/lib/autorizacao';
import { obterConfiguracoes } from '@/lib/configuracao';
import { motivosDoTipo } from '@/lib/denuncia';

// RF067 / RN052 — registro de denúncia.
//
// Uma rota para os dois tipos, porque o PAPEL de quem está logado já define
// qual deles é: o cliente denuncia o fornecedor a partir de uma solicitação;
// o fornecedor denuncia a avaliação que recebeu. Ninguém escolhe o tipo pelo
// corpo da requisição.
//
// RN052 — a denúncia é disciplinar e não tem efeito financeiro: não bloqueia
// repasse, não gera reembolso e não suspende conta. O bloqueio por
// inexecução é efeito exclusivo da contestação (RN069).

export async function POST(request) {
  const sessao = await lerSessao();
  if (!sessao) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const tipo = sessao.tipoUsuario === 'fornecedor' ? 'avaliacao' : 'fornecedor';
  const motivoPadrao = String(corpo.motivoPadrao ?? '');
  const descricao = String(corpo.descricao ?? '').trim();

  if (!motivosDoTipo(tipo).some((m) => m.valor === motivoPadrao)) {
    return NextResponse.json({ erro: 'Selecione o motivo da denúncia.' }, { status: 400 });
  }
  // RN052 — motivo padronizado sempre acompanhado de descrição obrigatória.
  if (descricao.length < 20) {
    return NextResponse.json(
      { erro: 'Descreva o ocorrido em ao menos 20 caracteres.' },
      { status: 400 }
    );
  }
  if (descricao.length > 1000) {
    return NextResponse.json({ erro: 'Descrição muito longa.' }, { status: 400 });
  }

  return tipo === 'avaliacao'
    ? denunciarAvaliacao(Number(corpo.idAvaliacao), motivoPadrao, descricao)
    : denunciarFornecedor(Number(corpo.idSolicitacao), motivoPadrao, descricao);
}

// ---------------- denúncia de fornecedor, pelo cliente ----------------
async function denunciarFornecedor(idSolicitacao, motivoPadrao, descricao) {
  const { erro, cliente } = await obterClienteLogado();
  if (erro) return erro;

  if (!Number.isInteger(idSolicitacao)) {
    return NextResponse.json({ erro: 'Solicitação inválida.' }, { status: 400 });
  }

  // A solicitação precisa ser DESTE cliente.
  const [linhas] = await pool.execute(
    `SELECT so.id, so.status,
            so.data_confirmacao_conclusao_cliente,
            ca.data_solicitacao AS data_cancelamento
       FROM solicitacao so
       LEFT JOIN cancelamento ca ON ca.id_solicitacao = so.id
      WHERE so.id = ? AND so.id_cliente = ?
      LIMIT 1`,
    [idSolicitacao, cliente.id]
  );

  if (linhas.length === 0) {
    return NextResponse.json({ erro: 'Solicitação não encontrada.' }, { status: 404 });
  }
  const solicitacao = linhas[0];

  // RN052 — só em solicitações que chegaram a existir de fato.
  if (!['confirmado', 'concluido', 'cancelado'].includes(solicitacao.status)) {
    return NextResponse.json(
      { erro: 'A denúncia fica disponível a partir da confirmação da contratação.' },
      { status: 409 }
    );
  }

  // RN052 — prazo contado da confirmação da conclusão ou do registro do
  // cancelamento. Em solicitação apenas confirmada não há marco ainda, e
  // por isso o prazo sequer começou a correr.
  const marco = solicitacao.data_confirmacao_conclusao_cliente ?? solicitacao.data_cancelamento;
  if (marco) {
    const configuracoes = await obterConfiguracoes();
    const limite = new Date(marco);
    limite.setDate(limite.getDate() + configuracoes.prazo_denuncia_fornecedor_dias);
    if (limite < new Date()) {
      return NextResponse.json(
        {
          erro: `O prazo de ${configuracoes.prazo_denuncia_fornecedor_dias} dias para `
            + 'denunciar esta contratação já se esgotou.',
        },
        { status: 409 }
      );
    }
  }

  return gravar({
    tipo: 'fornecedor',
    idAvaliacao: null,
    idSolicitacao,
    motivoPadrao,
    descricao,
  });
}

// ---------------- denúncia de avaliação, pelo fornecedor ----------------
async function denunciarAvaliacao(idAvaliacao, motivoPadrao, descricao) {
  const { erro, fornecedor } = await obterFornecedorLogado();
  if (erro) return erro;

  if (!Number.isInteger(idAvaliacao)) {
    return NextResponse.json({ erro: 'Avaliação inválida.' }, { status: 400 });
  }

  // RN052 — quem denuncia é o fornecedor DESTINATÁRIO da avaliação: o dono
  // do serviço avaliado.
  const [linhas] = await pool.execute(
    `SELECT a.id, a.comentario
       FROM avaliacao a
       JOIN solicitacao so ON so.id = a.id_solicitacao
       JOIN servico s      ON s.id  = so.id_servico
      WHERE a.id = ? AND s.id_fornecedor = ?
      LIMIT 1`,
    [idAvaliacao, fornecedor.id]
  );

  if (linhas.length === 0) {
    return NextResponse.json({ erro: 'Avaliação não encontrada.' }, { status: 404 });
  }

  // RN045 — a moderação age sobre o TEXTO. Uma avaliação sem comentário só
  // tem nota, e nota não se oculta.
  if (!linhas[0].comentario) {
    return NextResponse.json(
      { erro: 'Esta avaliação não tem comentário a ser analisado.' },
      { status: 409 }
    );
  }

  return gravar({
    tipo: 'avaliacao',
    idAvaliacao,
    idSolicitacao: null,
    motivoPadrao,
    descricao,
  });
}

async function gravar({ tipo, idAvaliacao, idSolicitacao, motivoPadrao, descricao }) {
  try {
    const [resultado] = await pool.execute(
      `INSERT INTO denuncia
         (tipo_denuncia, id_avaliacao, id_solicitacao, motivo_padrao, motivo)
       VALUES (?, ?, ?, ?, ?)`,
      [tipo, idAvaliacao, idSolicitacao, motivoPadrao, descricao]
    );

    // RN052 — o denunciado NÃO é notificado do registro. Quem recebe aviso
    // é o denunciante, e só quando a análise terminar (RF068).
    return NextResponse.json({ id: resultado.insertId }, { status: 201 });
  } catch (erroGravacao) {
    // RN052 — uma denúncia por alvo, garantida pelas UNIQUE da tabela.
    if (erroGravacao.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { erro: 'Já existe uma denúncia registrada para este item.' },
        { status: 409 }
      );
    }
    console.error('[denuncias POST]', erroGravacao);
    return NextResponse.json(
      { erro: 'Não foi possível registrar a denúncia.' },
      { status: 500 }
    );
  }
}
