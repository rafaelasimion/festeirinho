import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { expirarSolicitacoesVencidas } from '@/lib/solicitacao-servidor';
import ListaSolicitacoesRecebidas from './lista';

export default async function SolicitacoesRecebidas() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');
  if (sessao.tipoUsuario !== 'fornecedor') redirect('/minha-conta');

  const [fornecedores] = await pool.execute(
    'SELECT id FROM fornecedor WHERE id_usuario = ? LIMIT 1',
    [sessao.id]
  );
  if (fornecedores.length === 0) redirect('/minha-conta');
  const idFornecedor = fornecedores[0].id;

  // RN035 — fecha as vencidas antes de mostrar qualquer coisa.
  await expirarSolicitacoesVencidas();

  const [solicitacoes] = await pool.execute(
    `SELECT so.id, so.data_hora_evento, so.duracao, so.numero_convidados,
            so.tema, so.nome_aniversariante, so.idade_aniversariante,
            so.observacoes, so.valor_final, so.status, so.motivo_recusa,
            so.data_solicitacao, so.data_limite_resposta_fornecedor,
            s.nome AS servico,
            u.nome AS cliente,
            tl.descricao AS tipo_local,
            e.rua, e.numero, e.complemento, e.bairro,
            e.cidade, e.estado, e.cep
       FROM solicitacao so
       JOIN servico s     ON s.id  = so.id_servico
       JOIN cliente c     ON c.id  = so.id_cliente
       JOIN usuario u     ON u.id  = c.id_usuario
       JOIN endereco e    ON e.id  = so.id_endereco
       JOIN tipo_local tl ON tl.id = so.id_tipo_local
      WHERE s.id_fornecedor = ?
      ORDER BY (so.status = 'aguardando_analise') DESC,
               so.data_solicitacao DESC`,
    [idFornecedor]
  );

  return <ListaSolicitacoesRecebidas solicitacoes={serializar(solicitacoes)} />;
}

// Datas vêm do driver como objetos Date e DECIMAL vem como string. Converto
// para tipos simples antes de entregar à tela: só dado serializável
// atravessa a fronteira servidor → cliente.
function serializar(linhas) {
  return linhas.map((linha) => ({
    ...linha,
    data_hora_evento: linha.data_hora_evento.toISOString(),
    data_solicitacao: linha.data_solicitacao.toISOString(),
    data_limite_resposta_fornecedor: linha.data_limite_resposta_fornecedor.toISOString(),
    duracao: Number(linha.duracao),
    valor_final: Number(linha.valor_final),
  }));
}