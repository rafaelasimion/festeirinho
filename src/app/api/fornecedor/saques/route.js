import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterFornecedorLogado } from '@/lib/autorizacao';
import { obterConfiguracoes } from '@/lib/configuracao';
import { validarDadosRecebimento } from '@/lib/recebimento';

// UC 037 / RN060 — solicitação de saque pelo fornecedor.
// RN061 — dados de recebimento e reenvio após rejeição.

// RN061 — os dados precisam pertencer ao titular da solicitação. Para o
// fornecedor, o documento do titular é o CPF (PF) ou o CNPJ (PJ) da conta.
async function documentoDoFornecedor(conexao, idFornecedor) {
  const [linhas] = await conexao.execute(
    'SELECT tipo_pessoa, cpf, cnpj FROM fornecedor WHERE id = ? LIMIT 1',
    [idFornecedor]
  );
  const f = linhas[0];
  return f?.tipo_pessoa === 'PF' ? f.cpf : f?.cnpj;
}

// ---------------- solicitar saque ----------------
export async function POST(request) {
  const { erro, fornecedor } = await obterFornecedorLogado();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  // Duas casas decimais: DECIMAL(10,2) no banco.
  const valor = Math.round(Number(corpo.valor) * 100) / 100;
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ erros: { valor: 'Informe o valor do saque.' } }, { status: 400 });
  }

  const configuracoes = await obterConfiguracoes();
  const minimo = Number(configuracoes.valor_minimo_saque);

  // UC 037, fluxo 3a — abaixo do mínimo.
  if (valor < minimo) {
    return NextResponse.json(
      { erros: { valor: `O valor mínimo de saque é R$ ${minimo.toFixed(2).replace('.', ',')}.` } },
      { status: 400 }
    );
  }

  const { erros, dados } = validarDadosRecebimento(corpo.dados);
  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    // Trava a linha do fornecedor até o fim da transação.
    //
    // Sem isto, dois pedidos de saque enviados ao mesmo tempo leriam o mesmo
    // saldo, os dois passariam na checagem e o fornecedor sacaria mais do
    // que tem. Com a trava, o segundo pedido espera o primeiro terminar e lê
    // o saldo já descontado. É a forma de o banco garantir a RN060 quando a
    // regra depende de uma soma, e não de uma coluna.
    await conexao.execute(
      'SELECT id FROM fornecedor WHERE id = ? FOR UPDATE',
      [fornecedor.id]
    );

    const documento = await documentoDoFornecedor(conexao, fornecedor.id);
    if (dados.cpfCnpjTitular !== documento) {
      await conexao.rollback();
      return NextResponse.json(
        { erros: { cpfCnpjTitular: 'O titular precisa ser o próprio fornecedor (mesmo CPF ou CNPJ da conta).' } },
        { status: 400 }
      );
    }

    const [saldos] = await conexao.execute(
      'SELECT saldo_disponivel FROM vw_saldo_fornecedor WHERE id_fornecedor = ?',
      [fornecedor.id]
    );
    const saldo = Number(saldos[0]?.saldo_disponivel ?? 0);

    // UC 037, fluxo 3a — acima do saldo.
    if (valor > saldo) {
      await conexao.rollback();
      return NextResponse.json(
        { erros: { valor: `O valor excede o saldo disponível de R$ ${saldo.toFixed(2).replace('.', ',')}.` } },
        { status: 400 }
      );
    }

    // UC 037, etapa 7 — o saque nasce "pendente" e já reserva o valor: a
    // view do saldo desconta saques pendentes, processando e concluídos.
    const [resultado] = await conexao.execute(
      'INSERT INTO saque (id_fornecedor, valor) VALUES (?, ?)',
      [fornecedor.id, valor]
    );

    await conexao.execute(
      `INSERT INTO dados_recebimento
         (id_saque, tipo_recebimento, chave_pix, tipo_chave_pix,
          banco, tipo_conta, agencia, numero_conta,
          cpf_cnpj_titular, nome_titular)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resultado.insertId, dados.tipoRecebimento, dados.chavePix, dados.tipoChavePix,
        dados.banco, dados.tipoConta, dados.agencia, dados.numeroConta,
        dados.cpfCnpjTitular, dados.nomeTitular,
      ]
    );

    await conexao.commit();
    return NextResponse.json({ id: resultado.insertId, valor }, { status: 201 });
  } catch (erroSaque) {
    await conexao.rollback();
    console.error('[fornecedor/saques POST]', erroSaque);
    return NextResponse.json({ erro: 'Não foi possível solicitar o saque.' }, { status: 500 });
  } finally {
    conexao.release();
  }
}

// ---------------- reenviar dados após rejeição ----------------
export async function PUT(request) {
  const { erro, fornecedor } = await obterFornecedorLogado();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const idSaque = Number(corpo.idSaque);
  if (!Number.isInteger(idSaque)) {
    return NextResponse.json({ erro: 'Saque inválido.' }, { status: 400 });
  }

  const { erros, dados } = validarDadosRecebimento(corpo.dados);
  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  const [linhas] = await pool.execute(
    `SELECT sq.status, d.status_validacao
       FROM saque sq
       JOIN dados_recebimento d ON d.id_saque = sq.id
      WHERE sq.id = ? AND sq.id_fornecedor = ?
      LIMIT 1`,
    [idSaque, fornecedor.id]
  );

  if (linhas.length === 0) {
    return NextResponse.json({ erro: 'Saque não encontrado.' }, { status: 404 });
  }
  if (linhas[0].status !== 'pendente' || linhas[0].status_validacao !== 'rejeitado') {
    return NextResponse.json(
      { erro: 'Só é possível reenviar dados que foram rejeitados.' },
      { status: 409 }
    );
  }

  const documento = await documentoDoFornecedor(pool, fornecedor.id);
  if (dados.cpfCnpjTitular !== documento) {
    return NextResponse.json(
      { erros: { cpfCnpjTitular: 'O titular precisa ser o próprio fornecedor (mesmo CPF ou CNPJ da conta).' } },
      { status: 400 }
    );
  }

  try {
    // RN061 — o reenvio substitui integralmente os dados anteriores, sem
    // histórico. O motivo da rejeição volta a nulo junto com o status
    // "pendente": a CHECK chk_dados_recebimento_rejeicao exige os dois
    // juntos. Todos os campos de Pix e de conta são regravados, porque a
    // forma de recebimento pode ter mudado e o lado que não se aplica
    // precisa ficar nulo.
    await pool.execute(
      `UPDATE dados_recebimento
          SET tipo_recebimento = ?, chave_pix = ?, tipo_chave_pix = ?,
              banco = ?, tipo_conta = ?, agencia = ?, numero_conta = ?,
              cpf_cnpj_titular = ?, nome_titular = ?,
              status_validacao = 'pendente',
              motivo_rejeicao = NULL,
              data_envio = NOW()
        WHERE id_saque = ?`,
      [
        dados.tipoRecebimento, dados.chavePix, dados.tipoChavePix,
        dados.banco, dados.tipoConta, dados.agencia, dados.numeroConta,
        dados.cpfCnpjTitular, dados.nomeTitular,
        idSaque,
      ]
    );
    return NextResponse.json({ statusValidacao: 'pendente' });
  } catch (erroReenvio) {
    console.error('[fornecedor/saques PUT]', erroReenvio);
    return NextResponse.json({ erro: 'Não foi possível reenviar os dados.' }, { status: 500 });
  }
}
