import { redirect, notFound } from 'next/navigation';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { obterConfiguracoes } from '@/lib/configuracao';
import { expirarPagamentosVencidos } from '@/lib/pagamento-servidor';
import FormularioPagamento from './formulario';
import { paraSerializar } from '@/lib/datas';

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
            s.nome AS servico, f.nome_exibicao AS fornecedor,
            e.cidade, e.estado,
            -- Mesmo resumo do cartão de "Minhas solicitações": quem chega
            -- aqui precisa reconhecer o que está pagando antes de escolher
            -- a forma, e o nome sozinho não faz isso.
            fp.imagem_url AS foto_principal
       FROM pagamento p
       JOIN solicitacao so ON so.id = p.id_solicitacao
       JOIN cliente c      ON c.id  = so.id_cliente
       JOIN servico s      ON s.id  = so.id_servico
       JOIN fornecedor f   ON f.id  = s.id_fornecedor
       JOIN endereco e     ON e.id  = so.id_endereco
       LEFT JOIN foto_servico fp ON fp.id_servico = s.id AND fp.principal = TRUE
      WHERE p.id = ? AND c.id_usuario = ?
      LIMIT 1`,
    [idPagamento, sessao.id]
  );

  if (linhas.length === 0) notFound();
  const pagamento = linhas[0];

  const configuracoes = await obterConfiguracoes();

  // RF032 — os cartões que o cliente já salvou. A tela só oferece a forma
  // "cartão" se houver ao menos um; sem cartão, o caminho é cadastrar.
  const [cartoes] = await pool.execute(
    `SELECT c.id, c.bandeira, c.ultimos_quatro_num, c.apelido
       FROM cartao_credito c
       JOIN cliente cl ON cl.id = c.id_cliente
      WHERE cl.id_usuario = ? AND c.status = 'ativo'
      ORDER BY c.id DESC`,
    [sessao.id]
  );

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
        dataLimite: paraSerializar(pagamento.data_limite),
        numeroTentativas: pagamento.numero_tentativas,
        formaPagamento: pagamento.forma_pagamento,
        idTransacao: pagamento.id_transacao_gateway,
        statusSolicitacao: pagamento.status_solicitacao,
        idSolicitacao: pagamento.id_solicitacao,
        servico: pagamento.servico,
        fornecedor: pagamento.fornecedor,
        dataHoraEvento: paraSerializar(pagamento.data_hora_evento),
        duracao: pagamento.duracao,
        numeroConvidados: pagamento.numero_convidados,
        cidade: pagamento.cidade,
        estado: pagamento.estado,
        fotoPrincipal: pagamento.foto_principal,
      }}
      boletoDisponivel={boletoDisponivel}
      diasMinimosBoleto={configuracoes.antecedencia_minima_boleto_dias}
      cartoes={cartoes}
    />
  );
}