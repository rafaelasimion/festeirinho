import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';

// UC 016 / RN022 — chat vinculado à solicitação.
//   GET   lista as mensagens e marca como lidas as recebidas
//   POST  envia uma mensagem
//
// RN019 — o remetente precisa ser o cliente ou o fornecedor DAQUELA
// solicitação. A regra atravessa três tabelas, então o banco não consegue
// garanti-la com uma CHECK: é a aplicação que responde por ela, e é por
// isso que toda operação aqui começa carregando os dois participantes.

const TAMANHO_MAXIMO = 2000;

async function participantes(idSolicitacao) {
  const [linhas] = await pool.execute(
    `SELECT so.id, so.status, so.data_registro_conclusao_fornecedor,
            c.id_usuario AS id_cliente,
            f.id_usuario AS id_fornecedor,
            uc.nome AS nome_cliente,
            f.nome_exibicao AS nome_fornecedor
       FROM solicitacao so
       JOIN cliente c    ON c.id = so.id_cliente
       JOIN usuario uc   ON uc.id = c.id_usuario
       JOIN servico s    ON s.id = so.id_servico
       JOIN fornecedor f ON f.id = s.id_fornecedor
      WHERE so.id = ?
      LIMIT 1`,
    [idSolicitacao]
  );
  return linhas[0] ?? null;
}

// RN022 — o canal abre com a aprovação do fornecedor (RN023) e fecha no
// registro da conclusão. Fora dessa janela o histórico continua visível,
// mas não se escreve mais nele.
function chatAberto(solicitacao) {
  return ['aguardando_pagamento', 'confirmado'].includes(solicitacao.status)
    && solicitacao.data_registro_conclusao_fornecedor === null;
}

async function contexto(params) {
  const sessao = await lerSessao();
  if (!sessao) {
    return { erro: NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 }) };
  }

  const { id } = await params;
  const idSolicitacao = Number(id);
  if (!Number.isInteger(idSolicitacao)) {
    return { erro: NextResponse.json({ erro: 'Solicitação inválida.' }, { status: 400 }) };
  }

  const solicitacao = await participantes(idSolicitacao);
  if (!solicitacao) {
    return { erro: NextResponse.json({ erro: 'Solicitação não encontrada.' }, { status: 404 }) };
  }

  // RN019 — quem não é parte da conversa recebe "não encontrada", e não
  // "acesso negado": confirmar a existência da solicitação alheia já seria
  // informação a mais.
  if (sessao.id !== solicitacao.id_cliente && sessao.id !== solicitacao.id_fornecedor) {
    return { erro: NextResponse.json({ erro: 'Solicitação não encontrada.' }, { status: 404 }) };
  }

  return { sessao, idSolicitacao, solicitacao };
}

export async function GET(request, { params }) {
  const { erro, sessao, idSolicitacao, solicitacao } = await contexto(params);
  if (erro) return erro;

  try {
    // UC 016, etapa 6 — abrir a conversa marca como lidas as mensagens
    // recebidas. Só as do OUTRO participante: as próprias já nascem lidas
    // para quem as escreveu.
    await pool.execute(
      `UPDATE mensagem SET lida = TRUE
        WHERE id_solicitacao = ? AND id_usuario <> ? AND lida = FALSE`,
      [idSolicitacao, sessao.id]
    );

    const [mensagens] = await pool.execute(
      `SELECT id, id_usuario, conteudo, data_hora, lida
         FROM mensagem WHERE id_solicitacao = ? ORDER BY id`,
      [idSolicitacao]
    );

    return NextResponse.json({
      aberto: chatAberto(solicitacao),
      idUsuarioAtual: sessao.id,
      // Quem é quem, para a tela rotular cada lado sem adivinhar.
      nomeCliente: solicitacao.nome_cliente,
      nomeFornecedor: solicitacao.nome_fornecedor,
      mensagens: mensagens.map((m) => ({
        ...m,
        data_hora: m.data_hora.toISOString(),
        lida: Boolean(m.lida),
      })),
    });
  } catch (erroLeitura) {
    console.error('[mensagens GET]', erroLeitura);
    return NextResponse.json({ erro: 'Não foi possível carregar as mensagens.' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { erro, sessao, idSolicitacao, solicitacao } = await contexto(params);
  if (erro) return erro;

  if (!chatAberto(solicitacao)) {
    return NextResponse.json(
      { erro: 'Este canal está encerrado. Ele fica disponível da aprovação até o registro da conclusão.' },
      { status: 409 }
    );
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const conteudo = String(corpo.conteudo ?? '').trim();
  if (conteudo === '') {
    return NextResponse.json({ erro: 'Escreva a mensagem.' }, { status: 400 });
  }
  if (conteudo.length > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { erro: `A mensagem deve ter no máximo ${TAMANHO_MAXIMO} caracteres.` },
      { status: 400 }
    );
  }

  try {
    // RN015 — uma mensagem, um remetente. O remetente vem da SESSÃO, nunca
    // do corpo da requisição: aceitá-lo do cliente permitiria escrever em
    // nome do outro participante.
    const [resultado] = await pool.execute(
      'INSERT INTO mensagem (id_solicitacao, id_usuario, conteudo) VALUES (?, ?, ?)',
      [idSolicitacao, sessao.id, conteudo]
    );

    return NextResponse.json({ id: resultado.insertId }, { status: 201 });
  } catch (erroEnvio) {
    console.error('[mensagens POST]', erroEnvio);
    return NextResponse.json({ erro: 'Não foi possível enviar a mensagem.' }, { status: 500 });
  }
}
