import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { expirarSolicitacoesVencidas } from '@/lib/solicitacao-servidor';
import { expirarPagamentosVencidos } from '@/lib/pagamento-servidor';
import { confirmarConclusoesVencidas } from '@/lib/conclusao-servidor';
import { obterConfiguracoes } from '@/lib/configuracao';
import ListaMinhasSolicitacoes from './lista';

export default async function MinhasSolicitacoes() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');
  if (sessao.tipoUsuario !== 'cliente') redirect('/minha-conta');

  // Fecha o que venceu antes de mostrar a lista: RN035, RN025 e RF036.
  await expirarSolicitacoesVencidas();
  await expirarPagamentosVencidos();
  await confirmarConclusoesVencidas();

  const configuracoes = await obterConfiguracoes();

  // Os percentuais de multa vêm do pagamento, não da configuração: são os
  // congelados na contratação (RN027), e a tela precisa deles para mostrar
  // ao cliente quanto ele recebe de volta antes de confirmar (RN050).
  const [solicitacoes] = await pool.execute(
    `SELECT so.id, so.data_hora_evento, so.duracao, so.numero_convidados,
            so.valor_final, so.status, so.motivo_recusa,
            so.data_solicitacao, so.data_limite_resposta_fornecedor,
            so.data_registro_conclusao_fornecedor,
            so.data_confirmacao_conclusao_cliente,
            s.nome AS servico, f.nome_exibicao AS fornecedor,
            e.cidade, e.estado,
            p.id AS id_pagamento, p.status AS status_pagamento,
            p.data_limite, p.valor_bruto, p.forma_pagamento,
            p.perc_multa_faixa_mais_7d, p.perc_multa_faixa_7d_48h,
            p.perc_multa_faixa_48h_24h, p.perc_multa_faixa_24h,
            ca.id AS id_cancelamento, ca.solicitado_por, ca.motivo AS motivo_cancelamento,
            ca.valor_reembolso, ca.valor_multa, ca.status AS status_cancelamento
       FROM solicitacao so
       JOIN cliente c     ON c.id  = so.id_cliente
       JOIN servico s     ON s.id  = so.id_servico
       JOIN fornecedor f  ON f.id  = s.id_fornecedor
       JOIN endereco e    ON e.id  = so.id_endereco
       LEFT JOIN pagamento p    ON p.id_solicitacao  = so.id
       LEFT JOIN cancelamento ca ON ca.id_solicitacao = so.id
      WHERE c.id_usuario = ?
      ORDER BY so.data_solicitacao DESC`,
    [sessao.id]
  );

  return (
    <ListaMinhasSolicitacoes
      solicitacoes={serializar(solicitacoes)}
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
    data_limite: iso(linha.data_limite),
    duracao: Number(linha.duracao),
    valor_final: Number(linha.valor_final),
    valor_bruto: numero(linha.valor_bruto),
    valor_reembolso: numero(linha.valor_reembolso),
    valor_multa: numero(linha.valor_multa),
    perc_multa_faixa_mais_7d: numero(linha.perc_multa_faixa_mais_7d),
    perc_multa_faixa_7d_48h: numero(linha.perc_multa_faixa_7d_48h),
    perc_multa_faixa_48h_24h: numero(linha.perc_multa_faixa_48h_24h),
    perc_multa_faixa_24h: numero(linha.perc_multa_faixa_24h),
  }));
}
