import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import { administradorAtivo } from '@/lib/sessao-admin';
import PainelVerificacao from './painel';

export const metadata = {
  title: 'Painel administrativo — Festeirinho',
};

export default async function Admin() {
  const administrador = await administradorAtivo();
  if (!administrador) redirect('/admin/login');

  // Pendentes primeiro: é o que exige ação. Os já analisados continuam na
  // lista para permitir reverter uma decisão.
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

  // UC 043 — contestações de conclusão. Só entram solicitações que têm
  // contestação registrada, em qualquer estado; as pendentes vêm primeiro.
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

  const iso = (valor) => (valor ? valor.toISOString() : null);

  return (
    <PainelVerificacao
      nomeAdministrador={administrador.nome}
      fornecedores={fornecedores.map((f) => ({ ...f }))}
      servicos={servicos.map((s) => ({ ...s, preco_base: Number(s.preco_base) }))}
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
    />
  );
}
