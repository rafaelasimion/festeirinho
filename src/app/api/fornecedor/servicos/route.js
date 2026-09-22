import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterFornecedorLogado } from '@/lib/autorizacao';
import { validarServico } from '@/lib/servico';

// RF010 — o fornecedor cadastra e lista os próprios serviços.
// Como no perfil, o dono sai da sessão: nenhuma rota aceita id_fornecedor
// vindo do navegador.

export async function GET() {
  const { erro, fornecedor } = await obterFornecedorLogado();
  if (erro) return erro;

  try {
    const [servicos] = await pool.execute(
      `SELECT s.id, s.nome, s.descricao, s.preco_base, s.capacidade_max,
              s.dias_antecedencia, s.status_servico, s.status_verificacao,
              s.motivo_rejeicao, s.id_categoria, s.id_cobranca,
              c.nome AS categoria, cb.descricao AS cobranca,
              fp.imagem_url AS foto_principal
         FROM servico s
         JOIN categoria c  ON c.id  = s.id_categoria
         JOIN cobranca  cb ON cb.id = s.id_cobranca
         -- RF012: a principal é a miniatura que identifica o serviço na lista.
         LEFT JOIN foto_servico fp ON fp.id_servico = s.id AND fp.principal = TRUE
        WHERE s.id_fornecedor = ?
        ORDER BY s.data_cadastro DESC`,
      [fornecedor.id]
    );

    return NextResponse.json(servicos);
  } catch (erro) {
    console.error('[servicos GET]', erro);
    return NextResponse.json({ erro: 'Não foi possível carregar os serviços.' }, { status: 500 });
  }
}

export async function POST(request) {
  const { erro, fornecedor } = await obterFornecedorLogado();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const { erros, dados } = await validarServico(corpo);
  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  try {
    // status_verificacao nasce 'pendente' por default: o serviço só
    // aparece na vitrine depois de aprovado (RN020).
    const [resultado] = await pool.execute(
      `INSERT INTO servico
         (id_fornecedor, id_categoria, id_cobranca, nome, descricao,
          preco_base, capacidade_max, dias_antecedencia)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fornecedor.id, dados.idCategoria, dados.idCobranca,
        dados.nome, dados.descricao, dados.precoBase,
        dados.capacidadeMax, dados.diasAntecedencia,
      ]
    );

    return NextResponse.json({ id: resultado.insertId }, { status: 201 });
  } catch (erro) {
    console.error('[servicos POST]', erro);
    return NextResponse.json({ erro: 'Não foi possível cadastrar o serviço.' }, { status: 500 });
  }
}
