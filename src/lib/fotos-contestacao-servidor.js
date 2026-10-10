import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { obterClienteLogado, obterFornecedorLogado } from '@/lib/autorizacao';
import { salvarImagem, removerImagem } from '@/lib/imagens-servidor';

// RF069-B / RN069 — fotos anexadas à contestação da conclusão.
//
// Três coisas tornam estas fotos diferentes das fotos de serviço, e é por
// elas que este módulo existe em vez de reaproveitar a rota de fotos:
//
//   1. Elas não são públicas. Ficam em /uploads/contestacoes e só saem pela
//      rota /api/fotos-contestacao, que confere quem está pedindo.
//   2. Elas têm prazo de validade: existem enquanto a contestação estiver
//      pendente. A decisão da administração (RF070) apaga linhas e
//      arquivos — foto de festa infantil mostra criança, e a finalidade do
//      dado acaba com a decisão (LGPD, art. 6º, III, e art. 14).
//   3. As duas partes enviam, e cada uma só vê as suas. Quem vê as duas
//      pilhas é a administração.

export function salvarFotoContestacao(arquivo) {
  return salvarImagem(arquivo, { contestacao: true });
}

export async function removerArquivosContestacao(urls) {
  for (const url of urls) {
    await removerImagem(url, { contestacao: true });
  }
}

// Apaga as linhas das fotos de uma contestação e devolve os endereços dos
// arquivos. Roda DENTRO da transação que grava a decisão (RNF007): ou as
// duas coisas acontecem, ou nenhuma. Os arquivos só saem do disco depois do
// commit, por quem chamou — se a transação falhasse com o arquivo já
// apagado, sobraria uma linha apontando para o nada.
export async function apagarFotosDaContestacao(conexao, idSolicitacao) {
  const [fotos] = await conexao.execute(
    'SELECT imagem_url FROM foto_contestacao WHERE id_solicitacao = ?',
    [idSolicitacao]
  );
  if (fotos.length > 0) {
    await conexao.execute(
      'DELETE FROM foto_contestacao WHERE id_solicitacao = ?',
      [idSolicitacao]
    );
  }
  return fotos.map((foto) => foto.imagem_url);
}

// Quem está pedindo e qual é o papel dele NESTA solicitação.
//
// Cada papel passa pela própria guarda, que confere o status no banco:
// conta suspensa não envia nem remove foto. Quem não é parte recebe "não
// encontrada", como no chat (RN019) — confirmar que a solicitação de outra
// pessoa existe já seria informação a mais.
export async function parteDaContestacao(params) {
  const sessao = await lerSessao();
  if (!sessao) {
    return { erro: NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 }) };
  }

  const guarda = sessao.tipoUsuario === 'fornecedor'
    ? obterFornecedorLogado
    : obterClienteLogado;
  const { erro } = await guarda();
  if (erro) return { erro };

  const { id } = await params;
  const idSolicitacao = Number(id);
  if (!Number.isInteger(idSolicitacao)) {
    return { erro: NextResponse.json({ erro: 'Solicitação inválida.' }, { status: 400 }) };
  }

  const [linhas] = await pool.execute(
    `SELECT so.status_contestacao,
            c.id_usuario AS usuario_cliente,
            f.id_usuario AS usuario_fornecedor
       FROM solicitacao so
       JOIN cliente c    ON c.id = so.id_cliente
       JOIN servico s    ON s.id = so.id_servico
       JOIN fornecedor f ON f.id = s.id_fornecedor
      WHERE so.id = ?
      LIMIT 1`,
    [idSolicitacao]
  );

  const linha = linhas[0];
  const papel = !linha ? null
    : sessao.id === linha.usuario_cliente ? 'cliente'
      : sessao.id === linha.usuario_fornecedor ? 'fornecedor'
        : null;

  if (!papel) {
    return { erro: NextResponse.json({ erro: 'Solicitação não encontrada.' }, { status: 404 }) };
  }

  return {
    idSolicitacao,
    papel,
    pendente: linha.status_contestacao === 'pendente',
  };
}
