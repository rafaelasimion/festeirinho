import { pool } from '@/lib/db';

// RF064-B / RN065 — criação de notificações.
//
// Toda regra que diz "o sistema notifica" materializa-se num registro desta
// tabela. Este módulo é o único lugar que escreve nela.
//
// A chk_notificacao_referencia divide os tipos em dois grupos: os que
// apontam para uma solicitação navegável e os que se identificam só pelo
// tipo. A conferência abaixo repete essa divisão para que uma chamada
// errada falhe aqui, com mensagem clara, em vez de estourar no banco.

const TIPOS_COM_SOLICITACAO = ['solicitacao', 'pagamento', 'cancelamento', 'avaliacao'];
const TIPOS_SEM_SOLICITACAO = ['servico', 'conta', 'financeiro'];

// Notificar NUNCA pode derrubar a operação que a originou: é melhor um
// pagamento confirmado sem aviso do que um pagamento desfeito porque o
// aviso falhou. Por isso o erro é registrado no log e engolido.
export async function notificar(
  { idUsuario, tipo, titulo, mensagem, idSolicitacao = null },
  conexao = pool
) {
  try {
    if (!idUsuario) throw new Error('notificar: destinatário ausente');

    const exigeSolicitacao = TIPOS_COM_SOLICITACAO.includes(tipo);
    const proibeSolicitacao = TIPOS_SEM_SOLICITACAO.includes(tipo);

    if (!exigeSolicitacao && !proibeSolicitacao) {
      throw new Error(`notificar: tipo desconhecido "${tipo}"`);
    }
    if (exigeSolicitacao && !idSolicitacao) {
      throw new Error(`notificar: o tipo "${tipo}" exige a solicitação de referência`);
    }
    if (proibeSolicitacao && idSolicitacao) {
      throw new Error(`notificar: o tipo "${tipo}" não aceita solicitação de referência`);
    }

    await conexao.execute(
      `INSERT INTO notificacao (id_usuario, tipo, titulo, mensagem, id_solicitacao)
       VALUES (?, ?, ?, ?, ?)`,
      [idUsuario, tipo, titulo.slice(0, 150), mensagem.slice(0, 1000), idSolicitacao ?? null]
    );
  } catch (erro) {
    console.error('[notificar]', erro);
  }
}

// Vários destinatários de uma vez — o caso mais comum é avisar as duas
// partes de uma solicitação.
export async function notificarVarios(notificacoes, conexao = pool) {
  for (const notificacao of notificacoes) {
    await notificar(notificacao, conexao);
  }
}

// A maioria dos pontos que notificam tem em mãos o id da solicitação, não o
// id do usuário destinatário. Esta função faz a ponte e devolve, de quebra,
// o nome do serviço, que costuma entrar no texto da mensagem.
export async function partesDaSolicitacao(idSolicitacao, conexao = pool) {
  const [linhas] = await conexao.execute(
    `SELECT c.id_usuario AS cliente,
            f.id_usuario AS fornecedor,
            s.nome       AS servico,
            f.nome_exibicao AS nome_fornecedor,
            uc.nome      AS nome_cliente
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

// Usado pelo sino do cabeçalho.
export async function contarNaoLidas(idUsuario) {
  try {
    const [linhas] = await pool.execute(
      'SELECT COUNT(*) AS total FROM notificacao WHERE id_usuario = ? AND lida = FALSE',
      [idUsuario]
    );
    return Number(linhas[0].total);
  } catch (erro) {
    console.error('[contarNaoLidas]', erro);
    return 0;
  }
}
