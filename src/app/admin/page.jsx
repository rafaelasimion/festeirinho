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

  return (
    <PainelVerificacao
      nomeAdministrador={administrador.nome}
      fornecedores={fornecedores.map((f) => ({ ...f }))}
      servicos={servicos.map((s) => ({ ...s, preco_base: Number(s.preco_base) }))}
    />
  );
}
