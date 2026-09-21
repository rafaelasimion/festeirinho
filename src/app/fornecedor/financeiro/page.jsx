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
    `SELECT f.id, f.tipo_pessoa, f.cpf, f.cnpj, f.razao_social, u.nome
       FROM fornecedor f
       JOIN usuario u ON u.id = f.id_usuario
      WHERE f.id_usuario = ? LIMIT 1`,
    [sessao.id]
  );
  if (fornecedores.length === 0) redirect('/minha-conta');
  const fornecedor = fornecedores[0];

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
    [fornecedor.id]
  );
  const saldoDisponivel = Number(saldos[0]?.saldo_disponivel ?? 0);

  // As duas origens de repasse: valor do serviço concluído (RN056) e multa
  // retida em cancelamento pelo cliente (RN057).
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
    [configuracoes.periodo_carencia_repasse_dias, fornecedor.id, fornecedor.id]
  );

  // UC 037 — saques do fornecedor, com os dados de recebimento de cada um.
  const [saques] = await pool.execute(
    `SELECT sq.id, sq.valor, sq.data_solicitacao, sq.status, sq.motivo_recusa,
            sq.id_transacao_gateway, sq.data_processamento,
            d.tipo_recebimento, d.chave_pix, d.tipo_chave_pix,
            d.banco, d.tipo_conta, d.agencia, d.numero_conta,
            d.nome_titular, d.status_validacao, d.motivo_rejeicao
       FROM saque sq
       LEFT JOIN dados_recebimento d ON d.id_saque = sq.id
      WHERE sq.id_fornecedor = ?
      ORDER BY sq.data_solicitacao DESC`,
    [fornecedor.id]
  );

  const iso = (valor) => (valor ? valor.toISOString() : null);

  // RN061 — o titular dos dados é o próprio fornecedor. Pré-preencher evita
  // o erro mais comum, que é informar a conta de outra pessoa.
  const titular = fornecedor.tipo_pessoa === 'PF'
    ? { nome: fornecedor.nome, documento: fornecedor.cpf ?? '' }
    : { nome: fornecedor.razao_social ?? fornecedor.nome, documento: fornecedor.cnpj ?? '' };

  return (
    <PainelFinanceiro
      saldoDisponivel={saldoDisponivel}
      diasCarencia={configuracoes.periodo_carencia_repasse_dias}
      valorMinimoSaque={Number(configuracoes.valor_minimo_saque)}
      percentualComissao={Number(configuracoes.percentual_comissao)}
      titular={titular}
      movimentacoes={movimentacoes.map((m) => ({
        ...m,
        valor: Number(m.valor),
        data_repasse: iso(m.data_repasse),
        marco: iso(m.marco),
        previsao: iso(m.previsao),
      }))}
      saques={saques.map((s) => ({
        ...s,
        valor: Number(s.valor),
        data_solicitacao: iso(s.data_solicitacao),
        data_processamento: iso(s.data_processamento),
      }))}
    />
  );
}
