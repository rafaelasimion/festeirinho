import { redirect, notFound } from 'next/navigation';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { obterConfiguracoes } from '@/lib/configuracao';
import { expirarPagamentosVencidos } from '@/lib/pagamento-servidor';
import FormularioPagamento from './formulario';

export default async function Pagamento({ params }) {
  const { id } = await params;
  const idPagamento = Number(id);
  if (!Number.isInteger(idPagamento)) notFound();

  const sessao = await lerSessao();
  if (!sessao) redirect('/login');
  if (sessao.tipoUsuario !== 'cliente') redirect('/minha-conta');

  // RN025 — fecha os vencidos antes de mostrar a tela.
  await expirarPagamentosVencidos();

  const [linhas] = await pool.execute(
    `SELECT p.id, p.valor_bruto, p.status, p.data_limite,
            p.numero_tentativas, p.forma_pagamento, p.data_pagamento,
            p.id_transacao_gateway,
            so.id AS id_solicitacao, so.status AS status_solicitacao,
            so.data_hora_evento, so.numero_convidados, so.duracao,
            s.nome AS servico, f.nome_exibicao AS fornecedor
       FROM pagamento p
       JOIN solicitacao so ON so.id = p.id_solicitacao
       JOIN cliente c      ON c.id  = so.id_cliente
       JOIN servico s      ON s.id  = so.id_servico
       JOIN fornecedor f   ON f.id  = s.id_fornecedor
      WHERE p.id = ? AND c.id_usuario = ?
      LIMIT 1`,
    [idPagamento, sessao.id]
  );

  if (linhas.length === 0) notFound();
  const pagamento = linhas[0];

  const configuracoes = await obterConfiguracoes();

  // RN012 — o boleto só entra na lista de opções se houver antecedência.
  const limiteBoleto = new Date();
  limiteBoleto.setDate(limiteBoleto.getDate() + configuracoes.antecedencia_minima_boleto_dias);
  const boletoDisponivel = new Date(pagamento.data_hora_evento) >= limiteBoleto;

  return (
    <FormularioPagamento
      pagamento={{
        id: pagamento.id,
        valorBruto: Number(pagamento.valor_bruto),
        status: pagamento.status,
        dataLimite: pagamento.data_limite.toISOString(),
        numeroTentativas: pagamento.numero_tentativas,
        formaPagamento: pagamento.forma_pagamento,
        idTransacao: pagamento.id_transacao_gateway,
        statusSolicitacao: pagamento.status_solicitacao,
        servico: pagamento.servico,
        fornecedor: pagamento.fornecedor,
        dataHoraEvento: pagamento.data_hora_evento.toISOString(),
      }}
      boletoDisponivel={boletoDisponivel}
      diasMinimosBoleto={configuracoes.antecedencia_minima_boleto_dias}
    />
  );
}