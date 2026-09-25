import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { expirarSolicitacoesVencidas } from '@/lib/solicitacao-servidor';
import { expirarPagamentosVencidos } from '@/lib/pagamento-servidor';
import {
  confirmarConclusoesVencidas,
  cancelarSemRegistroDeConclusao,
} from '@/lib/conclusao-servidor';
import { obterConfiguracoes } from '@/lib/configuracao';
import ListaMinhasSolicitacoes from './lista';

export default async function MinhasSolicitacoes() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');
  if (sessao.tipoUsuario !== 'cliente') redirect('/minha-conta');

  // Fecha o que venceu antes de mostrar a lista: resposta do fornecedor
  // (RN035), pagamento (RN025), confirmação da conclusão (RF036) e registro
  // de conclusão ausente (RN066).
  await expirarSolicitacoesVencidas();
  await expirarPagamentosVencidos();
  await cancelarSemRegistroDeConclusao();
  await confirmarConclusoesVencidas();

  const configuracoes = await obterConfiguracoes();

  const [solicitacoes] = await pool.execute(
    `SELECT so.id, so.data_hora_evento, so.duracao, so.numero_convidados,
            so.valor_final, so.status, so.motivo_recusa,
            so.data_solicitacao, so.data_limite_resposta_fornecedor,
            so.data_registro_conclusao_fornecedor,
            so.data_confirmacao_conclusao_cliente,
            so.motivo_contestacao_cliente, so.descricao_contestacao_cliente,
            so.data_contestacao_cliente, so.status_contestacao,
            so.resultado_contestacao, so.justificativa_contestacao,
            so.data_analise_contestacao,
            s.nome AS servico, f.nome_exibicao AS fornecedor,
            e.cidade, e.estado,
            p.id AS id_pagamento, p.status AS status_pagamento,
            p.data_limite, p.valor_bruto, p.forma_pagamento,
            p.perc_multa_faixa_mais_7d, p.perc_multa_faixa_7d_48h,
            p.perc_multa_faixa_48h_24h, p.perc_multa_faixa_24h,
            ca.id AS id_cancelamento, ca.solicitado_por, ca.motivo AS motivo_cancelamento,
            ca.valor_reembolso, ca.valor_multa, ca.status AS status_cancelamento,
            av.id AS id_avaliacao, av.nota, av.comentario, av.status_avaliacao,
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
       LEFT JOIN pagamento p     ON p.id_solicitacao  = so.id
       LEFT JOIN cancelamento ca ON ca.id_solicitacao = so.id
       LEFT JOIN avaliacao av    ON av.id_solicitacao = so.id
       LEFT JOIN dados_recebimento dr ON dr.id_cancelamento = ca.id
       LEFT JOIN denuncia dn     ON dn.id_solicitacao = so.id
      WHERE c.id_usuario = ?
      ORDER BY so.data_solicitacao DESC`,
    [sessao.id, sessao.id]
  );

  // RN061 — o titular dos dados de reembolso é o próprio cliente.
  const [titulares] = await pool.execute(
    `SELECT u.nome, c.cpf
       FROM cliente c JOIN usuario u ON u.id = c.id_usuario
      WHERE c.id_usuario = ? LIMIT 1`,
    [sessao.id]
  );
  const titular = { nome: titulares[0]?.nome ?? '', documento: titulares[0]?.cpf ?? '' };

  return (
    <ListaMinhasSolicitacoes
      solicitacoes={serializar(solicitacoes)}
      titular={titular}
      prazoConfirmacaoHoras={configuracoes.prazo_confirmacao_conclusao_horas}
    />
  );
}

function serializar(linhas) {
  const iso = (valor) => (valor ? valor.toISOString() : null);
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
