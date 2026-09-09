import Link from 'next/link';
import { pool } from '@/lib/db';
import { formatarPreco } from '@/lib/solicitacao';
import { lerSessao } from '@/lib/sessao';

// Esta página só LÊ e mostra. Por isso ela consulta o banco direto, sem
// passar por uma rota de API: componente de servidor já roda no servidor.
// Rota de API é necessária quando alguém precisa ESCREVER — aí o pedido
// vem do navegador e tem que haver um endereço para recebê-lo.

export default async function Vitrine() {
  const sessao = await lerSessao();
  const podeSolicitar = sessao?.tipoUsuario === 'cliente';

  // RN020 — só aparece o que está ativo e aprovado, de fornecedor ativo.
  const [servicos] = await pool.query(
    `SELECT s.id, s.nome, s.descricao, s.preco_base, s.capacidade_max,
            s.dias_antecedencia,
            c.nome AS categoria, cb.descricao AS cobranca,
            f.nome_exibicao, f.status_verificacao AS verificacao_fornecedor,
            u.cidade, u.estado
       FROM servico s
       JOIN fornecedor f ON f.id = s.id_fornecedor
       JOIN usuario u    ON u.id = f.id_usuario
       JOIN categoria c  ON c.id = s.id_categoria
       JOIN cobranca cb  ON cb.id = s.id_cobranca
      WHERE s.status_servico = 'ativo'
        AND s.status_verificacao = 'aprovado'
        AND f.status_fornecedor = 'ativo'
      ORDER BY s.data_cadastro DESC`
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Serviços disponíveis</h1>

      {servicos.length === 0 ? (
        <p className="text-sm text-gray-600">
          Ainda não há serviços aprovados disponíveis.
        </p>
      ) : (
        <ul className="space-y-4">
          {servicos.map((servico) => (
            <li key={servico.id} className="rounded border border-gray-300 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-medium">{servico.nome}</h2>
                  <p className="text-sm text-gray-600">
                    {servico.nome_exibicao}
                    {servico.verificacao_fornecedor === 'aprovado' && ' · Verificado'}
                    {' · '}{servico.cidade}/{servico.estado}
                  </p>
                  <p className="mt-2 text-sm">{servico.descricao}</p>
                  <p className="mt-2 text-sm font-medium">
                    {formatarPreco(servico.preco_base)}
                    {servico.cobranca === 'hora' ? ' por hora' : ' por pessoa'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {servico.categoria} · antecedência de {servico.dias_antecedencia} dias
                    {servico.capacidade_max !== null && ` · até ${servico.capacidade_max} convidados`}
                  </p>
                </div>

                {podeSolicitar ? (
                  <Link href={`/servicos/${servico.id}/solicitar`}
                    className="shrink-0 rounded bg-gray-900 px-3 py-1.5 text-sm text-white">
                    Solicitar
                  </Link>
                ) : !sessao ? (
                  <Link href="/login"
                    className="shrink-0 rounded border border-gray-400 px-3 py-1.5 text-sm">
                    Entrar para solicitar
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}