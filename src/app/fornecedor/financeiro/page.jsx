import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { obterConfiguracoes } from '@/lib/configuracao';
import { confirmarConclusoesVencidas } from '@/lib/conclusao-servidor';
import { liberarRepassesVencidos } from '@/lib/repasse-servidor';
import PainelFinanceiro from './painel';

export const metadata = {
  title: 'Financeiro — Festeirinho',
};

export default async function Financeiro() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');
  if (sessao.tipoUsuario !== 'fornecedor') redirect('/minha-conta');

  const [fornecedores] = await pool.execute(
    'SELECT id FROM fornecedor WHERE id_usuario = ? LIMIT 1',
    [sessao.id]
  );
  if (fornecedores.length === 0) redirect('/minha-conta');
  const idFornecedor = fornecedores[0].id;

  // Fecha o que venceu antes de calcular o saldo: uma conclusão confirmada
  // automaticamente agora pode ser a que destrava um repasse.
  await confirmarConclusoesVencidas();
  await liberarRepassesVencidos();

  const configuracoes = await obterConfiguracoes();

  // O saldo vem da view do banco, que já desconta os saques comprometidos
  // (RN060). Recalcular isso na aplicação seria manter duas versões da
  // mesma conta.
  const [saldos] = await pool.execute(
    'SELECT saldo_disponivel FROM vw_saldo_fornecedor WHERE id_fornecedor = ?',
    [idFornecedor]
  );
  const saldoDisponivel = Number(saldos[0]?.saldo_disponivel ?? 0);

  // As duas origens de repasse, unidas: valor do serviço concluído (RN056)
  // e multa retida em cancelamento pelo cliente (RN057). A multa não tem
  // carência, por isso a previsão dela é a própria data do cancelamento.
  const [movimentacoes] = await pool.execute(
    `SELECT 'conclusao' AS origem,
            p.id                AS id_origem,
            s.nome              AS servico,
            p.valor_repassado   AS valor,
            p.status_repasse,
            p.data_repasse,
            so.data_confirmacao_conclusao_cliente AS marco,
            DATE_ADD(so.data_confirmacao_conclusao_cliente, INTERVAL ? DAY) AS previsao,
            so.id               AS id_solicitacao
       FROM pagamento p
       JOIN solicitacao so ON so.id = p.id_solicitacao
       JOIN servico s      ON s.id  = so.id_servico
      WHERE s.id_fornecedor = ?
        AND p.status = 'pago'
        AND p.status_repasse <> 'cancelado'

      UNION ALL

     SELECT 'multa' AS origem,
            c.id                AS id_origem,
            s.nome              AS servico,
            c.valor_multa       AS valor,
            c.status_repasse,
            c.data_repasse,
            c.data_solicitacao  AS marco,
            c.data_solicitacao  AS previsao,
            so.id               AS id_solicitacao
       FROM cancelamento c
       JOIN solicitacao so ON so.id = c.id_solicitacao
       JOIN servico s      ON s.id  = so.id_servico
      WHERE s.id_fornecedor = ?
        AND c.valor_multa > 0

      ORDER BY marco DESC`,
    [configuracoes.periodo_carencia_repasse_dias, idFornecedor, idFornecedor]
  );

  const iso = (valor) => (valor ? valor.toISOString() : null);

  return (
    <PainelFinanceiro
      saldoDisponivel={saldoDisponivel}
      diasCarencia={configuracoes.periodo_carencia_repasse_dias}
      valorMinimoSaque={Number(configuracoes.valor_minimo_saque)}
      percentualComissao={Number(configuracoes.percentual_comissao)}
      movimentacoes={movimentacoes.map((m) => ({
        ...m,
        valor: Number(m.valor),
        data_repasse: iso(m.data_repasse),
        marco: iso(m.marco),
        previsao: iso(m.previsao),
      }))}
    />
  );
}
