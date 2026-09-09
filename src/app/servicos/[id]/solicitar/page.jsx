import { redirect, notFound } from 'next/navigation';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import FormularioSolicitacao from './formulario';

export default async function SolicitarServico({ params }) {
  const { id } = await params;
  const idServico = Number(id);
  if (!Number.isInteger(idServico)) notFound();

  const sessao = await lerSessao();

  // Precisa estar logado para solicitar; e RN030 — fornecedor não contrata.
  if (!sessao) redirect('/login');
  if (sessao.tipoUsuario !== 'cliente') {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="mb-2 text-2xl font-semibold">Solicitação indisponível</h1>
        <p className="text-sm text-gray-600">
          Apenas contas de cliente podem solicitar serviços.
        </p>
      </main>
    );
  }

  const [servicos] = await pool.execute(
    `SELECT s.id, s.nome, s.preco_base, s.capacidade_max, s.dias_antecedencia,
            cb.descricao AS cobranca, f.nome_exibicao
       FROM servico s
       JOIN fornecedor f ON f.id = s.id_fornecedor
       JOIN cobranca cb  ON cb.id = s.id_cobranca
      WHERE s.id = ?
        AND s.status_servico = 'ativo'
        AND s.status_verificacao = 'aprovado'
        AND f.status_fornecedor = 'ativo'
      LIMIT 1`,
    [idServico]
  );

  if (servicos.length === 0) notFound();

  const [tiposLocal] = await pool.query(
    'SELECT id, descricao FROM tipo_local ORDER BY id'
  );

  // O servidor entrega para a tela apenas o que ela precisa mostrar.
  return (
    <FormularioSolicitacao
      servico={{
        id: servicos[0].id,
        nome: servicos[0].nome,
        precoBase: Number(servicos[0].preco_base),
        capacidadeMax: servicos[0].capacidade_max,
        diasAntecedencia: servicos[0].dias_antecedencia,
        cobranca: servicos[0].cobranca,
        fornecedor: servicos[0].nome_exibicao,
      }}
      tiposLocal={tiposLocal}
    />
  );
}