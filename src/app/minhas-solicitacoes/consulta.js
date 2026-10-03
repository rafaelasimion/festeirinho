import { pool } from '@/lib/db';
import { paraSerializar } from '@/lib/datas';
import { expirarSolicitacoesVencidas } from '@/lib/solicitacao-servidor';
import { expirarPagamentosVencidos } from '@/lib/pagamento-servidor';
import {
  confirmarConclusoesVencidas,
  cancelarSemRegistroDeConclusao,
} from '@/lib/conclusao-servidor';

// A consulta das solicitações do cliente, usada por duas telas: a lista
// (/minhas-solicitacoes) e a página de uma solicitação
// (/minhas-solicitacoes/[id]).
//
// Ela mora aqui, e não dentro de uma das duas, porque são exatamente os
// mesmos campos: a página de detalhe mostra tudo que o cartão da lista
// mostrava antes de encolher. Duplicada, bastaria uma das cópias ganhar um
// campo novo para as duas telas passarem a discordar sobre a mesma
// solicitação.

// Fecha o que venceu antes de ler: resposta do fornecedor (RN035),
// pagamento (RN025), confirmação da conclusão (RF036) e registro de
// conclusão ausente (RN066). Vale para as duas telas — entrar pela página
// de uma solicitação não pode mostrar um prazo que já venceu como se
// ainda estivesse de pé.
export async function fecharPendenciasVencidas() {
  await expirarSolicitacoesVencidas();
  await expirarPagamentosVencidos();
  await cancelarSemRegistroDeConclusao();
  await confirmarConclusoesVencidas();
}

// Sem `id`, devolve todas as solicitações do cliente. Com `id`, devolve só
// aquela — e a cláusula do dono continua na consulta, de modo que pedir o
// id de outra pessoa não devolve linha nenhuma. A autorização não é
// verificada depois: ela é a própria consulta.
export async function buscarSolicitacoes(idUsuario, { id = null } = {}) {
  const filtro = id === null ? '' : ' AND so.id = ?';
  const parametros = id === null
    ? [idUsuario, idUsuario]
    : [idUsuario, idUsuario, id];

  const [linhas] = await pool.execute(
    `SELECT so.id, so.data_hora_evento, so.duracao, so.numero_convidados,
            so.valor_final, so.status, so.motivo_recusa,
            so.data_solicitacao, so.data_limite_resposta_fornecedor,
            so.data_registro_conclusao_fornecedor,
            so.data_confirmacao_conclusao_cliente,
            so.motivo_contestacao_cliente, so.descricao_contestacao_cliente,
            so.data_contestacao_cliente, so.status_contestacao,
            so.resultado_contestacao, so.justificativa_contestacao,
            so.data_analise_contestacao,
            -- RF023 — os marcos que faltavam para a linha do tempo. A
            -- coluna data_resposta_fornecedor já existia no modelo, com o
            -- RF023 citado no comentário da DDL; só não estava sendo lida.
            so.data_resposta_fornecedor,
            s.nome AS servico, f.nome_exibicao AS fornecedor,
            -- Os dois ids que o cartão usa para linkar: o nome do serviço
            -- leva à página dele, o do fornecedor à vitrine.
            s.id AS id_servico, f.id AS id_fornecedor,
            -- Miniatura do serviço no cabeçalho do cartão: a foto é o
            -- que identifica a contratação de relance, antes do nome.
            fp.imagem_url AS foto_principal,
            e.cidade, e.estado,
            p.id AS id_pagamento, p.status AS status_pagamento,
            p.data_limite, p.data_pagamento, p.valor_bruto, p.forma_pagamento,
            p.perc_multa_faixa_mais_7d, p.perc_multa_faixa_7d_48h,
            p.perc_multa_faixa_48h_24h, p.perc_multa_faixa_24h,
            ca.id AS id_cancelamento, ca.solicitado_por, ca.motivo AS motivo_cancelamento,
            ca.data_solicitacao AS data_cancelamento,
            ca.valor_reembolso, ca.valor_multa, ca.status AS status_cancelamento,
            av.id AS id_avaliacao, av.nota, av.comentario, av.status_avaliacao,
            av.data_avaliacao,
            dr.id AS id_dados_reembolso, dr.status_validacao AS validacao_reembolso,
            dr.motivo_rejeicao AS motivo_rejeicao_reembolso,
            dr.tipo_recebimento, dr.chave_pix, dr.tipo_chave_pix,
            dr.banco, dr.tipo_conta, dr.agencia, dr.numero_conta,
            -- UC 016 — quantas mensagens do fornecedor este cliente ainda
            -- não leu nesta solicitação.
            (SELECT COUNT(*) FROM mensagem m
              WHERE m.id_solicitacao = so.id
                AND m.id_usuario <> ? AND m.lida = FALSE) AS nao_lidas,
            -- RN052 — uma denúncia por solicitação; se existir, a opção
            -- some e o resultado é exibido.
            dn.id AS id_denuncia, dn.status_denuncia,
            dn.resultado_analise, dn.justificativa_analise
       FROM solicitacao so
       JOIN cliente c     ON c.id  = so.id_cliente
       JOIN servico s     ON s.id  = so.id_servico
       JOIN fornecedor f  ON f.id  = s.id_fornecedor
       JOIN endereco e    ON e.id  = so.id_endereco
       LEFT JOIN foto_servico fp ON fp.id_servico = s.id AND fp.principal = TRUE
       LEFT JOIN pagamento p     ON p.id_solicitacao  = so.id
       LEFT JOIN cancelamento ca ON ca.id_solicitacao = so.id
       LEFT JOIN avaliacao av    ON av.id_solicitacao = so.id
       LEFT JOIN dados_recebimento dr ON dr.id_cancelamento = ca.id
       LEFT JOIN denuncia dn     ON dn.id_solicitacao = so.id
      WHERE c.id_usuario = ?${filtro}
      ORDER BY so.data_solicitacao DESC`,
    parametros
  );

  return serializar(linhas);
}

// RN061 — o titular dos dados de reembolso é o próprio cliente.
export async function buscarTitular(idUsuario) {
  const [titulares] = await pool.execute(
    `SELECT u.nome, c.cpf
       FROM cliente c JOIN usuario u ON u.id = c.id_usuario
      WHERE c.id_usuario = ? LIMIT 1`,
    [idUsuario]
  );
  return { nome: titulares[0]?.nome ?? '', documento: titulares[0]?.cpf ?? '' };
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
    data_contestacao_cliente: iso(linha.data_contestacao_cliente),
    data_analise_contestacao: iso(linha.data_analise_contestacao),
    data_resposta_fornecedor: iso(linha.data_resposta_fornecedor),
    data_pagamento: iso(linha.data_pagamento),
    data_cancelamento: iso(linha.data_cancelamento),
    data_avaliacao: iso(linha.data_avaliacao),
    data_limite: iso(linha.data_limite),
    duracao: Number(linha.duracao),
    valor_final: Number(linha.valor_final),
    valor_bruto: numero(linha.valor_bruto),
    valor_reembolso: numero(linha.valor_reembolso),
    valor_multa: numero(linha.valor_multa),
    nao_lidas: Number(linha.nao_lidas),
    perc_multa_faixa_mais_7d: numero(linha.perc_multa_faixa_mais_7d),
    perc_multa_faixa_7d_48h: numero(linha.perc_multa_faixa_7d_48h),
    perc_multa_faixa_48h_24h: numero(linha.perc_multa_faixa_48h_24h),
    perc_multa_faixa_24h: numero(linha.perc_multa_faixa_24h),
  }));
}

