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
      <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-semibold text-slate-900">Solicitação indisponível</h1>
        <p className="mt-1.5 text-slate-600">
          Apenas contas de cliente podem solicitar serviços.
        </p>
      </main>
    );
  }

  // A foto principal vem por LEFT JOIN: serviço sem foto continua podendo
  // ser solicitado, e a moldura desenha o padrão de festa no lugar.
  const [servicos] = await pool.execute(
    `SELECT s.id, s.nome, s.preco_base, s.capacidade_max, s.dias_antecedencia,
            cb.descricao AS cobranca, f.nome_exibicao,
            fp.imagem_url AS foto_principal
       FROM servico s
       JOIN fornecedor f ON f.id = s.id_fornecedor
       JOIN cobranca cb  ON cb.id = s.id_cobranca
       LEFT JOIN foto_servico fp ON fp.id_servico = s.id AND fp.principal = TRUE
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
        fotoPrincipal: servicos[0].foto_principal,
      }}
      tiposLocal={tiposLocal}
    />
  );
}