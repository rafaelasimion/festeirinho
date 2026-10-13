import { pool } from '@/lib/db';
import { consolidar, formatarDocumento, mesAtual } from '@/lib/relatorio-financeiro';

// Módulo de servidor: importa o banco, então nunca pode ser carregado por
// componente de tela.

// RN058 — o relatório do mês reúne os repasses LIBERADOS nele, pela data de
// liberação, e não pela data do evento, do pagamento ou da conclusão.
//
// Por isso um repasse ainda em carência na emissão não aparece: ele entra
// no relatório do mês em que for liberado. É também o motivo de a rotina de
// liberação (repasse-servidor.js) gravar data_repasse uma única vez, sob
// FOR UPDATE — uma regravação à meia-noite do dia 31 mudaria o mês dele.
//
// As duas origens são as mesmas do painel financeiro:
// - conclusão (RN056): valor bruto, comissão congelada no pagamento (RN027)
//   e valor repassado;
// - multa por cancelamento pedido pelo cliente (RN057): repassada inteira,
//   com comissão zero.
export async function buscarRelatorioMensal(idFornecedor, periodo) {
  const [fornecedores] = await pool.execute(
    `SELECT f.nome_exibicao, f.tipo_pessoa, f.cpf, f.cnpj, f.razao_social, u.nome
       FROM fornecedor f
       JOIN usuario u ON u.id = f.id_usuario
      WHERE f.id = ?
      LIMIT 1`,
    [idFornecedor]
  );
  const fornecedor = fornecedores[0];

  const [linhas] = await pool.execute(
    `SELECT 'conclusao'         AS origem,
            so.id               AS id_solicitacao,
            s.nome              AS servico,
            p.data_repasse,
            p.valor_bruto,
            p.percentual_comissao,
            p.valor_comissao,
            p.valor_repassado   AS valor_liquido
       FROM pagamento p
       JOIN solicitacao so ON so.id = p.id_solicitacao
       JOIN servico s      ON s.id  = so.id_servico
      WHERE s.id_fornecedor = ?
        AND p.status_repasse = 'liberado'
        AND p.data_repasse >= ?
        AND p.data_repasse <  ?

      UNION ALL

     SELECT 'multa'             AS origem,
            so.id               AS id_solicitacao,
            s.nome              AS servico,
            c.data_repasse,
            c.valor_multa       AS valor_bruto,
            0                   AS percentual_comissao,
            0                   AS valor_comissao,
            c.valor_multa       AS valor_liquido
       FROM cancelamento c
       JOIN solicitacao so ON so.id = c.id_solicitacao
       JOIN servico s      ON s.id  = so.id_servico
      WHERE s.id_fornecedor = ?
        AND c.status_repasse = 'liberado'
        AND c.data_repasse >= ?
        AND c.data_repasse <  ?

      ORDER BY data_repasse, id_solicitacao`,
    [
      idFornecedor, periodo.inicio, periodo.fim,
      idFornecedor, periodo.inicio, periodo.fim,
    ]
  );

  // O titular é quem recebe os valores: a razão social na PJ, o nome do
  // responsável na PF — o mesmo critério dos dados de recebimento do saque.
  const titular = fornecedor.tipo_pessoa === 'PJ'
    ? (fornecedor.razao_social ?? fornecedor.nome)
    : fornecedor.nome;

  return {
    periodo,
    // Mês em andamento: o relatório vale "até agora", e diz isso.
    parcial: periodo.chave === mesAtual(),
    emitidoEm: new Date(),
    fornecedor: {
      nomeExibicao: fornecedor.nome_exibicao,
      titular,
      documento: formatarDocumento(fornecedor.tipo_pessoa, fornecedor.cpf, fornecedor.cnpj),
    },
    ...consolidar(linhas),
  };
}
