import { pool } from '@/lib/db';
import { paraSerializar } from '@/lib/datas';
import { expirarSolicitacoesVencidas } from '@/lib/solicitacao-servidor';
import { expirarPagamentosVencidos } from '@/lib/pagamento-servidor';
import {
  confirmarConclusoesVencidas,
  cancelarSemRegistroDeConclusao,
} from '@/lib/conclusao-servidor';

// A consulta das solicitações recebidas pelo fornecedor, usada pela lista
// (/fornecedor/solicitacoes) e pela página de uma solicitação
// (/fornecedor/solicitacoes/[id]) — mesma razão da gêmea do lado do
// cliente: são os mesmos campos, e duplicadas elas divergiriam.

// Fecha o que venceu antes de ler: RN035, RN025, RN066 e RF036.
export async function fecharPendenciasVencidas() {
  await expirarSolicitacoesVencidas();
  await expirarPagamentosVencidos();
  await cancelarSemRegistroDeConclusao();
  await confirmarConclusoesVencidas();
}

// O fornecedor do usuário da sessão. Devolve null quando a conta não tem
// cadastro de fornecedor — quem chama decide para onde mandar.
export async function idDoFornecedor(idUsuario) {
  const [fornecedores] = await pool.execute(
    'SELECT id FROM fornecedor WHERE id_usuario = ? LIMIT 1',
    [idUsuario]
  );
  return fornecedores[0]?.id ?? null;
}

// Sem `id`, todas as solicitações do fornecedor. Com `id`, só aquela — e a
// cláusula do dono (s.id_fornecedor) continua na consulta, então o id de
// outro fornecedor não devolve linha nenhuma.
export async function buscarSolicitacoes(idUsuario, idFornecedor, { id = null } = {}) {
  const filtro = id === null ? '' : ' AND so.id = ?';
  const parametros = id === null
    ? [idUsuario, idFornecedor]
    : [idUsuario, idFornecedor, id];

  const [linhas] = await pool.execute(
    `SELECT so.id, so.data_hora_evento, so.duracao, so.numero_convidados,
            so.tema, so.nome_aniversariante, so.idade_aniversariante,
            so.observacoes, so.valor_final, so.status, so.motivo_recusa,
            so.data_solicitacao, so.data_limite_resposta_fornecedor,
            so.data_registro_conclusao_fornecedor,
            so.data_confirmacao_conclusao_cliente,
            DATE_ADD(so.data_hora_evento, INTERVAL so.duracao * 60 MINUTE) AS termino_previsto,
            so.motivo_contestacao_cliente, so.descricao_contestacao_cliente,
            so.data_contestacao_cliente, so.status_contestacao,
            so.resultado_contestacao, so.justificativa_contestacao,
            -- RF023 — marcos da linha do tempo. data_analise_contestacao
            -- não estava sendo lida deste lado.
            so.data_analise_contestacao, so.data_resposta_fornecedor,
            s.nome AS servico,
            -- Miniatura do serviço no cabeçalho do cartão.
            fp.imagem_url AS foto_principal,
            u.nome AS cliente,
            tl.descricao AS tipo_local,
            e.rua, e.numero, e.complemento, e.bairro,
            e.cidade, e.estado, e.cep,
            p.status AS status_pagamento, p.valor_bruto,
            p.data_pagamento, p.forma_pagamento,
            ca.id AS id_cancelamento, ca.solicitado_por,
            ca.data_solicitacao AS data_cancelamento,
            ca.motivo AS motivo_cancelamento,
            ca.valor_reembolso, ca.valor_multa,
            ca.status AS status_cancelamento, ca.status_repasse,
            -- UC 016 — mensagens do cliente ainda não lidas nesta solicitação.
            (SELECT COUNT(*) FROM mensagem m
              WHERE m.id_solicitacao = so.id
                AND m.id_usuario <> ? AND m.lida = FALSE) AS nao_lidas,
            -- RF037 — a avaliação recebida, para o fornecedor ler e, se
            -- for o caso, denunciar o comentário (RN052).
            av.id AS id_avaliacao, av.nota, av.comentario,
            av.status_avaliacao, av.origem_ocultacao, av.data_avaliacao,
            dn.id AS id_denuncia, dn.status_denuncia,
            dn.resultado_analise, dn.justificativa_analise
       FROM solicitacao so
       JOIN servico s     ON s.id  = so.id_servico
       LEFT JOIN foto_servico fp ON fp.id_servico = s.id AND fp.principal = TRUE
       JOIN cliente c     ON c.id  = so.id_cliente
       JOIN usuario u     ON u.id  = c.id_usuario
       JOIN endereco e    ON e.id  = so.id_endereco
       JOIN tipo_local tl ON tl.id = so.id_tipo_local
       LEFT JOIN pagamento p     ON p.id_solicitacao  = so.id
       LEFT JOIN cancelamento ca ON ca.id_solicitacao = so.id
       LEFT JOIN avaliacao av    ON av.id_solicitacao = so.id
       LEFT JOIN denuncia dn     ON dn.id_avaliacao = av.id
      WHERE s.id_fornecedor = ?${filtro}
      ORDER BY (so.status = 'aguardando_analise') DESC,
               so.data_solicitacao DESC`,
    parametros
  );

  return serializar(linhas);
}

function serializar(linhas) {
  const iso = paraSerializar;
  const numero = (valor) => (valor === null || valor === undefined ? null : Number(valor));

  return linhas.map((linha) => ({
    ...linha,
    data_hora_evento: iso(linha.data_hora_evento),
    data_solicitacao: iso(linha.data_solicitacao),
    data_limite_resposta_fornecedor: iso(linha.data_limite_resposta_fornecedor),
    data_registro_conclusao_fornecedor: iso(linha.data_registro_conclusao_fornecedor),
    data_confirmacao_conclusao_cliente: iso(linha.data_confirmacao_conclusao_cliente),
    termino_previsto: iso(linha.termino_previsto),
    data_contestacao_cliente: iso(linha.data_contestacao_cliente),
    data_avaliacao: iso(linha.data_avaliacao),
    data_analise_contestacao: iso(linha.data_analise_contestacao),
    data_resposta_fornecedor: iso(linha.data_resposta_fornecedor),
    data_pagamento: iso(linha.data_pagamento),
    data_cancelamento: iso(linha.data_cancelamento),
    duracao: Number(linha.duracao),
    valor_final: Number(linha.valor_final),
    valor_bruto: numero(linha.valor_bruto),
    valor_reembolso: numero(linha.valor_reembolso),
    valor_multa: numero(linha.valor_multa),
    nao_lidas: Number(linha.nao_lidas),
  }));
}

