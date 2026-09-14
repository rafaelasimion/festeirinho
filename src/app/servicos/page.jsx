import Link from 'next/link';
import { Store, MapPin, BadgeCheck, Image as ImageIcon, Star } from 'lucide-react';
import { pool } from '@/lib/db';
import { formatarPreco, SUFIXO_PRECO } from '@/lib/solicitacao';
import { lerSessao } from '@/lib/sessao';
import Etiqueta from '@/componentes/etiqueta';

// Esta página só LÊ e mostra. Por isso ela consulta o banco direto, sem
// passar por uma rota de API: componente de servidor já roda no servidor.

export default async function Vitrine() {
  const sessao = await lerSessao();
  const podeSolicitar = sessao?.tipoUsuario === 'cliente';

  // RN020 — só aparece o que está ativo e aprovado, de fornecedor ativo.
  // A média de avaliações vem de uma subconsulta agrupada: avaliação está
  // ligada à solicitação, e a solicitação ao serviço. Só entram as visíveis
  // (RN062). Serviço sem avaliação devolve NULL, tratado na tela.
  const [servicos] = await pool.query(
    `SELECT s.id, s.nome, s.descricao, s.preco_base, s.capacidade_max,
            s.dias_antecedencia,
            c.nome AS categoria, cb.descricao AS cobranca,
            f.nome_exibicao, f.status_verificacao AS verificacao_fornecedor,
            u.cidade, u.estado,
            av.media_nota, av.total_avaliacoes
       FROM servico s
       JOIN fornecedor f ON f.id = s.id_fornecedor
       JOIN usuario u    ON u.id = f.id_usuario
       JOIN categoria c  ON c.id = s.id_categoria
       JOIN cobranca cb  ON cb.id = s.id_cobranca
       LEFT JOIN (
            SELECT so.id_servico,
                   AVG(a.nota)  AS media_nota,
                   COUNT(*)     AS total_avaliacoes
              FROM avaliacao a
              JOIN solicitacao so ON so.id = a.id_solicitacao
             WHERE a.status_avaliacao = 'visivel'
             GROUP BY so.id_servico
       ) av ON av.id_servico = s.id
      WHERE s.status_servico = 'ativo'
        AND s.status_verificacao = 'aprovado'
        AND f.status_fornecedor = 'ativo'
      ORDER BY s.data_cadastro DESC`
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">
        Serviços disponíveis
      </h1>

      {servicos.length === 0 ? (
        <p className="text-sm text-slate-600">
          Ainda não há serviços aprovados disponíveis.
        </p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2">
          {servicos.map((servico) => (
            <li key={servico.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

              {/* Espaço reservado para as fotos do serviço, ainda não
                  implementadas. A proporção fixa mantém o card estável
                  para quando as imagens entrarem. */}
              <div className="relative flex aspect-[16/10] items-center justify-center bg-festa-100">
                <ImageIcon className="h-10 w-10 text-festa-600" aria-hidden="true" />
                <span className="absolute right-3 top-3">
                  <Etiqueta tom="roxo">{servico.categoria}</Etiqueta>
                </span>
              </div>

              <div className="flex flex-col gap-3 p-5">
                <div>
                  <h2 className="font-medium text-slate-900">{servico.nome}</h2>
                  <Estrelas media={servico.media_nota} total={servico.total_avaliacoes} />
                </div>

                <div className="flex items-end justify-between gap-4">
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-1.5 font-medium text-festa-700">
                      <Store className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {servico.nome_exibicao}
                      {servico.verificacao_fornecedor === 'aprovado' && (
                        <BadgeCheck className="h-4 w-4 shrink-0 text-festa-600"
                          aria-label="Fornecedor verificado" />
                      )}
                    </p>
                    <p className="flex items-center gap-1.5 text-slate-600">
                      <MapPin className="h-4 w-4 shrink-0 text-festa-600" aria-hidden="true" />
                      {servico.cidade}/{servico.estado}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-lg font-semibold text-slate-900">
                      {formatarPreco(servico.preco_base)}
                    </p>
                    {SUFIXO_PRECO[servico.cobranca] && (
                      <p className="text-xs text-slate-500">
                        {SUFIXO_PRECO[servico.cobranca].trim()}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  antecedência de {servico.dias_antecedencia} dias
                  {servico.capacidade_max !== null &&
                    ` · até ${servico.capacidade_max} convidados`}
                </p>

                {podeSolicitar ? (
                  <Link href={`/servicos/${servico.id}/solicitar`}
                    className="mt-1 block rounded-lg bg-festa-600 px-4 py-3 text-center font-medium text-white transition-colors hover:bg-festa-700">
                    Solicitar
                  </Link>
                ) : !sessao ? (
                  <Link href="/login"
                    className="mt-1 block rounded-lg border border-festa-600 px-4 py-3 text-center font-medium text-festa-700 transition-colors hover:bg-festa-50">
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

function Estrelas({ media, total }) {
  if (!total) {
    return <p className="mt-1 text-xs text-slate-500">Ainda sem avaliações</p>;
  }

  const nota = Number(media);
  const cheias = Math.round(nota);

  return (
    <p className="mt-1 flex items-center gap-1.5">
      <span className="flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((posicao) => (
          <Star key={posicao}
            className={`h-4 w-4 ${posicao <= cheias
              ? 'fill-atencao-600 text-atencao-600'
              : 'text-slate-300'}`} />
        ))}
      </span>
      <span className="text-xs text-slate-500">
        {nota.toFixed(1)} ({total})
      </span>
      <span className="sr-only">
        Nota média {nota.toFixed(1)} de 5, com base em {total} avaliações.
      </span>
    </p>
  );
}