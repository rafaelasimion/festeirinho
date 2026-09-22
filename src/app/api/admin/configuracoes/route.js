import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterAdministradorLogado } from '@/lib/sessao-admin';
import { limparCacheConfiguracoes } from '@/lib/configuracao';
import {
  PARAMETROS,
  validarParametro,
  validarConsistencia,
  antecedenciaMinimaDias,
} from '@/lib/parametros';

// UC 028 — configuração de parâmetros do sistema.

const AFETAM_ANTECEDENCIA = ['prazo_resposta_fornecedor_horas', 'prazo_pagamento_horas'];

export async function PATCH(request) {
  const { erro } = await obterAdministradorLogado();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const chave = String(corpo.chave ?? '');
  const valor = Number(corpo.valor);

  // A chave é conferida contra uma lista fechada. Nunca vai para o SQL sem
  // essa conferência — e mesmo depois dela, entra como parâmetro.
  if (!PARAMETROS[chave]) {
    return NextResponse.json({ erro: 'Parâmetro desconhecido.' }, { status: 400 });
  }

  const erroValor = validarParametro(chave, valor);
  if (erroValor) {
    return NextResponse.json({ erro: erroValor }, { status: 400 });
  }

  try {
    const [linhas] = await pool.query('SELECT chave, valor FROM configuracao');
    const atuais = Object.fromEntries(linhas.map((l) => [l.chave, Number(l.valor)]));
    const propostos = { ...atuais, [chave]: valor };

    // UC 028, passo 5 e fluxo 5a — a alteração não pode deixar os
    // parâmetros relacionados inconsistentes entre si.
    const inconsistencia = validarConsistencia(propostos);
    if (inconsistencia) {
      return NextResponse.json({ erro: inconsistencia }, { status: 409 });
    }

    // RN046 — mudar prazo de resposta ou de pagamento muda a antecedência
    // mínima exigível dos serviços. Os serviços já cadastrados abaixo do
    // novo mínimo não são alterados à revelia do fornecedor: são apenas
    // contados e informados. A regra passa a ser exigida deles na próxima
    // edição (UC 009, fluxo 5b).
    let impacto = null;
    if (AFETAM_ANTECEDENCIA.includes(chave)) {
      const minimoAnterior = antecedenciaMinimaDias(atuais);
      const minimoNovo = antecedenciaMinimaDias(propostos);

      if (minimoNovo !== minimoAnterior) {
        const [contagem] = await pool.execute(
          `SELECT COUNT(*) AS total
             FROM servico
            WHERE status_servico = 'ativo' AND dias_antecedencia < ?`,
          [minimoNovo]
        );
        impacto = {
          minimoAnterior,
          minimoNovo,
          servicosAbaixoDoMinimo: Number(contagem[0].total),
        };
      }
    }

    // UC 028, passo 6 — a data da alteração é gravada pelo próprio banco:
    // a coluna data_alteracao é ON UPDATE CURRENT_TIMESTAMP.
    await pool.execute(
      'UPDATE configuracao SET valor = ? WHERE chave = ?',
      [valor, chave]
    );

    // A mudança passa a valer na requisição seguinte, e não daqui a um
    // minuto, quando o cache venceria sozinho.
    limparCacheConfiguracoes();

    return NextResponse.json({ chave, valor, impacto });
  } catch (erroAlteracao) {
    console.error('[admin/configuracoes]', erroAlteracao);
    return NextResponse.json(
      { erro: 'Não foi possível salvar a alteração.' },
      { status: 500 }
    );
  }
}
