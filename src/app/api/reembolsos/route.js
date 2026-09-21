import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterClienteLogado } from '@/lib/autorizacao';
import { validarDadosRecebimento } from '@/lib/recebimento';

// UC 036 / RN061 — dados de recebimento do reembolso, quando o pagamento
// original foi por boleto. Pix e cartão são estornados pelo próprio gateway
// e não passam por aqui.

async function carregarContexto(idCancelamento, idCliente) {
  // O cancelamento precisa ser de uma solicitação DESTE cliente.
  const [linhas] = await pool.execute(
    `SELECT ca.id, ca.status, ca.valor_reembolso,
            p.forma_pagamento,
            cl.cpf AS cpf_cliente,
            d.id AS id_dados, d.status_validacao
       FROM cancelamento ca
       JOIN solicitacao so ON so.id = ca.id_solicitacao
       JOIN cliente cl     ON cl.id = so.id_cliente
       LEFT JOIN pagamento p ON p.id_solicitacao = so.id
       LEFT JOIN dados_recebimento d ON d.id_cancelamento = ca.id
      WHERE ca.id = ? AND so.id_cliente = ?
      LIMIT 1`,
    [idCancelamento, idCliente]
  );
  return linhas[0] ?? null;
}

// UC 036, pré-condição — cancelamento "em análise", com reembolso a
// processar, de solicitação paga por boleto.
function impedimento(contexto) {
  if (contexto.status !== 'em_analise') {
    return 'Este reembolso não está aguardando dados de recebimento.';
  }
  if (Number(contexto.valor_reembolso) <= 0) {
    return 'Este cancelamento não tem reembolso a processar.';
  }
  if (contexto.forma_pagamento !== 'boleto') {
    return 'O reembolso deste pagamento é feito automaticamente pelo meio original.';
  }
  return null;
}

async function lerCorpo(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// ---------------- informar os dados ----------------
export async function POST(request) {
  const { erro, cliente } = await obterClienteLogado();
  if (erro) return erro;

  const corpo = await lerCorpo(request);
  if (!corpo) return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });

  const idCancelamento = Number(corpo.idCancelamento);
  if (!Number.isInteger(idCancelamento)) {
    return NextResponse.json({ erro: 'Cancelamento inválido.' }, { status: 400 });
  }

  const contexto = await carregarContexto(idCancelamento, cliente.id);
  if (!contexto) {
    return NextResponse.json({ erro: 'Cancelamento não encontrado.' }, { status: 404 });
  }

  const bloqueio = impedimento(contexto);
  if (bloqueio) return NextResponse.json({ erro: bloqueio }, { status: 409 });

  if (contexto.id_dados) {
    return NextResponse.json(
      { erro: 'Os dados deste reembolso já foram informados.' },
      { status: 409 }
    );
  }

  const { erros, dados } = validarDadosRecebimento(corpo.dados);
  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  // RN061 — os dados precisam pertencer ao titular da solicitação: no
  // reembolso, é o próprio cliente.
  if (dados.cpfCnpjTitular !== contexto.cpf_cliente) {
    return NextResponse.json(
      { erros: { cpfCnpjTitular: 'O titular precisa ser você (mesmo CPF da sua conta).' } },
      { status: 400 }
    );
  }

  try {
    await pool.execute(
      `INSERT INTO dados_recebimento
         (id_cancelamento, tipo_recebimento, chave_pix, tipo_chave_pix,
          banco, tipo_conta, agencia, numero_conta,
          cpf_cnpj_titular, nome_titular)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        idCancelamento, dados.tipoRecebimento, dados.chavePix, dados.tipoChavePix,
        dados.banco, dados.tipoConta, dados.agencia, dados.numeroConta,
        dados.cpfCnpjTitular, dados.nomeTitular,
      ]
    );
    return NextResponse.json({ statusValidacao: 'pendente' }, { status: 201 });
  } catch (erroInsercao) {
    // A UNIQUE uk_dados_recebimento_cancelamento é a última linha de defesa
    // contra dois envios simultâneos.
    if (erroInsercao.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { erro: 'Os dados deste reembolso já foram informados.' },
        { status: 409 }
      );
    }
    console.error('[reembolsos POST]', erroInsercao);
    return NextResponse.json({ erro: 'Não foi possível enviar os dados.' }, { status: 500 });
  }
}

// ---------------- reenviar após rejeição ----------------
export async function PUT(request) {
  const { erro, cliente } = await obterClienteLogado();
  if (erro) return erro;

  const corpo = await lerCorpo(request);
  if (!corpo) return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });

  const idCancelamento = Number(corpo.idCancelamento);
  if (!Number.isInteger(idCancelamento)) {
    return NextResponse.json({ erro: 'Cancelamento inválido.' }, { status: 400 });
  }

  const contexto = await carregarContexto(idCancelamento, cliente.id);
  if (!contexto) {
    return NextResponse.json({ erro: 'Cancelamento não encontrado.' }, { status: 404 });
  }

  const bloqueio = impedimento(contexto);
  if (bloqueio) return NextResponse.json({ erro: bloqueio }, { status: 409 });

  if (contexto.status_validacao !== 'rejeitado') {
    return NextResponse.json(
      { erro: 'Só é possível reenviar dados que foram rejeitados.' },
      { status: 409 }
    );
  }

  const { erros, dados } = validarDadosRecebimento(corpo.dados);
  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  if (dados.cpfCnpjTitular !== contexto.cpf_cliente) {
    return NextResponse.json(
      { erros: { cpfCnpjTitular: 'O titular precisa ser você (mesmo CPF da sua conta).' } },
      { status: 400 }
    );
  }

  try {
    // RN061 — substitui integralmente os dados anteriores; o motivo da
    // rejeição volta a nulo junto com o status "pendente".
    await pool.execute(
      `UPDATE dados_recebimento
          SET tipo_recebimento = ?, chave_pix = ?, tipo_chave_pix = ?,
              banco = ?, tipo_conta = ?, agencia = ?, numero_conta = ?,
              cpf_cnpj_titular = ?, nome_titular = ?,
              status_validacao = 'pendente',
              motivo_rejeicao = NULL,
              data_envio = NOW()
        WHERE id_cancelamento = ?`,
      [
        dados.tipoRecebimento, dados.chavePix, dados.tipoChavePix,
        dados.banco, dados.tipoConta, dados.agencia, dados.numeroConta,
        dados.cpfCnpjTitular, dados.nomeTitular,
        idCancelamento,
      ]
    );
    return NextResponse.json({ statusValidacao: 'pendente' });
  } catch (erroReenvio) {
    console.error('[reembolsos PUT]', erroReenvio);
    return NextResponse.json({ erro: 'Não foi possível reenviar os dados.' }, { status: 500 });
  }
}
