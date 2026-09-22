import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import { administradorAtivo } from '@/lib/sessao-admin';
import { descreverRecebimento } from '@/lib/recebimento';
import PainelVerificacao from './painel';

export const metadata = {
  title: 'Painel administrativo — Festeirinho',
};

export default async function Admin() {
  const administrador = await administradorAtivo();
  if (!administrador) redirect('/admin/login');

  const [fornecedores] = await pool.query(
    `SELECT f.id, f.tipo_pessoa, f.cpf, f.cnpj, f.razao_social,
            f.nome_exibicao, f.descricao, f.status_verificacao,
            f.motivo_rejeicao, f.status_fornecedor,
            u.nome AS responsavel, u.email, u.telefone, u.cidade, u.estado,
            f.instagram_url, f.whatsapp_url, f.site
       FROM fornecedor f
       JOIN usuario u ON u.id = f.id_usuario
      ORDER BY (f.status_verificacao = 'pendente') DESC, f.id DESC`
  );

  const [servicos] = await pool.query(
    `SELECT s.id, s.nome, s.descricao, s.preco_base, s.capacidade_max,
            s.dias_antecedencia, s.status_verificacao, s.motivo_rejeicao,
            s.status_servico,
            c.nome AS categoria, cb.descricao AS cobranca,
            f.nome_exibicao AS fornecedor
       FROM servico s
       JOIN fornecedor f ON f.id  = s.id_fornecedor
       JOIN categoria c  ON c.id  = s.id_categoria
       JOIN cobranca cb  ON cb.id = s.id_cobranca
      ORDER BY (s.status_verificacao = 'pendente') DESC, s.id DESC`
  );

  // RF012 / RN067 — incluir ou remover foto devolve o serviço à análise.
  // A análise, então, precisa VER as fotos: sem elas, a administração
  // aprovaria justamente o que mudou sem olhar.
  const [fotos] = await pool.query(
    'SELECT id, id_servico, imagem_url, principal FROM foto_servico ORDER BY principal DESC, id'
  );
  const fotosPorServico = {};
  for (const foto of fotos) {
    (fotosPorServico[foto.id_servico] ??= []).push({
      id: foto.id,
      imagem_url: foto.imagem_url,
      principal: Boolean(foto.principal),
    });
  }

  const [contestacoes] = await pool.query(
    `SELECT so.id, so.status,
            so.motivo_contestacao_cliente, so.descricao_contestacao_cliente,
            so.data_contestacao_cliente, so.status_contestacao,
            so.resultado_contestacao, so.justificativa_contestacao,
            so.data_analise_contestacao,
            so.data_hora_evento, so.duracao, so.numero_convidados,
            so.valor_final, so.data_registro_conclusao_fornecedor,
            s.nome AS servico,
            f.nome_exibicao AS fornecedor,
            u.nome AS cliente, u.email AS email_cliente,
            p.status AS status_pagamento, p.forma_pagamento, p.valor_bruto
       FROM solicitacao so
       JOIN servico s    ON s.id = so.id_servico
       JOIN fornecedor f ON f.id = s.id_fornecedor
       JOIN cliente c    ON c.id = so.id_cliente
       JOIN usuario u    ON u.id = c.id_usuario
       LEFT JOIN pagamento p ON p.id_solicitacao = so.id
      WHERE so.status_contestacao IS NOT NULL
      ORDER BY (so.status_contestacao = 'pendente') DESC,
               so.data_contestacao_cliente DESC`
  );

  // UC 038 — dados de recebimento pendentes, dos dois fluxos. Cada linha
  // traz também o documento e o nome da conta na plataforma, para o painel
  // comparar com o titular informado (RN061).
  const [dadosPendentes] = await pool.query(
    `SELECT 'saque' AS origem, d.id, d.tipo_recebimento, d.chave_pix, d.tipo_chave_pix,
            d.banco, d.tipo_conta, d.agencia, d.numero_conta,
            d.cpf_cnpj_titular, d.nome_titular, d.data_envio,
            sq.valor,
            u.nome AS nome_conta,
            IF(f.tipo_pessoa = 'PF', f.cpf, f.cnpj) AS documento_conta
       FROM dados_recebimento d
       JOIN saque sq     ON sq.id = d.id_saque
       JOIN fornecedor f ON f.id  = sq.id_fornecedor
       JOIN usuario u    ON u.id  = f.id_usuario
      WHERE d.status_validacao = 'pendente'

      UNION ALL

     SELECT 'reembolso' AS origem, d.id, d.tipo_recebimento, d.chave_pix, d.tipo_chave_pix,
            d.banco, d.tipo_conta, d.agencia, d.numero_conta,
            d.cpf_cnpj_titular, d.nome_titular, d.data_envio,
            ca.valor_reembolso AS valor,
            u.nome AS nome_conta,
            cl.cpf AS documento_conta
       FROM dados_recebimento d
       JOIN cancelamento ca ON ca.id = d.id_cancelamento
       JOIN solicitacao so  ON so.id = ca.id_solicitacao
       JOIN cliente cl      ON cl.id = so.id_cliente
       JOIN usuario u       ON u.id  = cl.id_usuario
      WHERE d.status_validacao = 'pendente'

      ORDER BY data_envio`
  );

  // Transferências e estornos aguardando o gateway: saques "processando" e
  // cancelamentos "processando" (Pix e cartão entram direto aqui; boleto
  // chega depois da validação dos dados).
  const [processamentos] = await pool.query(
    `SELECT 'saque' AS origem, sq.id, sq.valor, u.nome AS nome_conta,
            d.tipo_recebimento, d.chave_pix, d.tipo_chave_pix,
            d.banco, d.tipo_conta, d.agencia, d.numero_conta
       FROM saque sq
       JOIN fornecedor f ON f.id = sq.id_fornecedor
       JOIN usuario u    ON u.id = f.id_usuario
       LEFT JOIN dados_recebimento d ON d.id_saque = sq.id
      WHERE sq.status = 'processando'

      UNION ALL

     SELECT 'reembolso' AS origem, ca.id, ca.valor_reembolso AS valor, u.nome AS nome_conta,
            d.tipo_recebimento, d.chave_pix, d.tipo_chave_pix,
            d.banco, d.tipo_conta, d.agencia, d.numero_conta
       FROM cancelamento ca
       JOIN solicitacao so ON so.id = ca.id_solicitacao
       JOIN cliente cl     ON cl.id = so.id_cliente
       JOIN usuario u      ON u.id  = cl.id_usuario
       LEFT JOIN dados_recebimento d ON d.id_cancelamento = ca.id
      WHERE ca.status = 'processando'`
  );

  // UC 028 — parâmetros configuráveis, na ordem da carga inicial.
  const [configuracoes] = await pool.query(
    'SELECT chave, descricao, valor, data_alteracao FROM configuracao ORDER BY id'
  );

  const iso = (valor) => (valor ? valor.toISOString() : null);

  return (
    <PainelVerificacao
      nomeAdministrador={administrador.nome}
      fornecedores={fornecedores.map((f) => ({ ...f }))}
      servicos={servicos.map((s) => ({
        ...s,
        preco_base: Number(s.preco_base),
        fotos: fotosPorServico[s.id] ?? [],
      }))}
      contestacoes={contestacoes.map((c) => ({
        ...c,
        data_contestacao_cliente: iso(c.data_contestacao_cliente),
        data_analise_contestacao: iso(c.data_analise_contestacao),
        data_hora_evento: iso(c.data_hora_evento),
        data_registro_conclusao_fornecedor: iso(c.data_registro_conclusao_fornecedor),
        duracao: Number(c.duracao),
        valor_final: Number(c.valor_final),
        valor_bruto: c.valor_bruto === null ? null : Number(c.valor_bruto),
      }))}
      dadosPendentes={dadosPendentes.map((d) => ({
        ...d,
        valor: Number(d.valor),
        data_envio: iso(d.data_envio),
      }))}
      configuracoes={configuracoes.map((c) => ({
        chave: c.chave,
        descricao: c.descricao,
        valor: Number(c.valor),
        data_alteracao: iso(c.data_alteracao),
      }))}
      processamentos={processamentos.map((p) => ({
        origem: p.origem,
        id: p.id,
        valor: Number(p.valor),
        nome_conta: p.nome_conta,
        // Estorno por Pix ou cartão volta pelo próprio gateway, sem dados
        // informados; aí não há destino a descrever.
        destino: p.tipo_recebimento ? descreverRecebimento(p) : 'Estorno pelo meio de pagamento original',
      }))}
    />
  );
}
