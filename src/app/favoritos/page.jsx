import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Store, MapPin, BadgeCheck, Image as ImageIcon, Star, Heart } from 'lucide-react';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { formatarPreco, SUFIXO_PRECO } from '@/lib/solicitacao';
import Etiqueta from '@/componentes/etiqueta';
import BotaoFavorito from '@/componentes/botao-favorito';

// RF015 / RF016 — lista de favoritos do cliente.

export const metadata = { title: 'Favoritos — Festeirinho' };

export default async function Favoritos() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');
  if (sessao.tipoUsuario !== 'cliente') redirect('/minha-conta');

  const [clientes] = await pool.execute(
    'SELECT id FROM cliente WHERE id_usuario = ? LIMIT 1',
    [sessao.id]
  );
  if (clientes.length === 0) redirect('/minha-conta');
  const idCliente = clientes[0].id;

  // Serviços favoritados. O que saiu do ar continua listado, mas marcado
  // como indisponível: sumir sem aviso faria parecer que a plataforma
  // perdeu o favorito.
  const [servicos] = await pool.execute(
    `SELECT s.id, s.nome, s.preco_base, s.status_servico, s.status_verificacao,
            c.nome AS categoria, cb.descricao AS cobranca,
            f.nome_exibicao, f.status_fornecedor,
            u.cidade, u.estado,
            fp.imagem_url AS foto_principal,
            av.media_nota, av.total_avaliacoes
       FROM favorito fv
       JOIN servico s    ON s.id = fv.id_servico
       JOIN fornecedor f ON f.id = s.id_fornecedor
       JOIN usuario u    ON u.id = f.id_usuario
       JOIN categoria c  ON c.id = s.id_categoria
       JOIN cobranca cb  ON cb.id = s.id_cobranca
       LEFT JOIN foto_servico fp ON fp.id_servico = s.id AND fp.principal = TRUE
       LEFT JOIN (
            SELECT so.id_servico, AVG(a.nota) AS media_nota, COUNT(*) AS total_avaliacoes
              FROM avaliacao a JOIN solicitacao so ON so.id = a.id_solicitacao
             GROUP BY so.id_servico
       ) av ON av.id_servico = s.id
      WHERE fv.id_cliente = ? AND fv.tipo_favorito = 'servico'
      ORDER BY fv.data_salvo DESC`,
    [idCliente]
  );

  const [fornecedores] = await pool.execute(
    `SELECT f.id, f.nome_exibicao, f.descricao, f.status_verificacao, f.status_fornecedor,
            u.cidade, u.estado, u.foto_perfil,
            (SELECT COUNT(*) FROM servico s
              WHERE s.id_fornecedor = f.id
                AND s.status_servico = 'ativo'
                AND s.status_verificacao = 'aprovado') AS servicos_ativos
       FROM favorito fv
       JOIN fornecedor f ON f.id = fv.id_fornecedor
       JOIN usuario u    ON u.id = f.id_usuario
      WHERE fv.id_cliente = ? AND fv.tipo_favorito = 'fornecedor'
      ORDER BY fv.data_salvo DESC`,
    [idCliente]
  );

  const vazio = servicos.length === 0 && fornecedores.length === 0;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Favoritos</h1>

      {vazio ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Heart className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm text-slate-600">
            Você ainda não salvou nada. Use o coração na vitrine para guardar os
            serviços e fornecedores que gostar.
          </p>
          <Link href="/servicos"
            className="mt-4 inline-block rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700">
            Ver serviços
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {servicos.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-medium text-slate-900">
                Serviços salvos
              </h2>
              <ul className="grid gap-6 sm:grid-cols-2">
                {servicos.map((servico) => {
                  const disponivel = servico.status_servico === 'ativo'
                    && servico.status_verificacao === 'aprovado'
                    && servico.status_fornecedor === 'ativo';

                  return (
                    <li key={servico.id}
                      className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-festa-100">
                        {servico.foto_principal ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={servico.foto_principal} alt={servico.nome}
                            className={`h-full w-full object-cover ${disponivel ? '' : 'opacity-50'}`} />
                        ) : (
                          <ImageIcon className="h-10 w-10 text-festa-600" aria-hidden="true" />
                        )}
                        <span className="absolute right-3 top-3">
                          <Etiqueta tom="roxo">{servico.categoria}</Etiqueta>
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col gap-3 p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-medium text-slate-900">{servico.nome}</h3>
                            <Estrelas media={servico.media_nota} total={servico.total_avaliacoes} />
                          </div>
                          <BotaoFavorito tipo="servico" id={servico.id} favorito
                            rotulo={servico.nome} />
                        </div>

                        <div className="flex items-end justify-between gap-4">
                          <div className="space-y-1 text-sm">
                            <p className="flex items-center gap-1.5 font-medium text-festa-700">
                              <Store className="h-4 w-4 shrink-0" aria-hidden="true" />
                              {servico.nome_exibicao}
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

                        {disponivel ? (
                          <Link href={`/servicos/${servico.id}`}
                            className="mt-auto block rounded-lg bg-festa-600 px-4 py-3 text-center font-medium text-white transition-colors hover:bg-festa-700">
                            Ver detalhes
                          </Link>
                        ) : (
                          <p className="mt-auto rounded-lg bg-slate-100 px-4 py-3 text-center text-sm text-slate-600">
                            Indisponível no momento
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {fornecedores.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-medium text-slate-900">
                Fornecedores salvos
              </h2>
              <ul className="space-y-3">
                {fornecedores.map((fornecedor) => (
                  <li key={fornecedor.id}
                    className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-festa-100">
                      {fornecedor.foto_perfil ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fornecedor.foto_perfil} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          <Store className="h-6 w-6 text-festa-600" aria-hidden="true" />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                        {fornecedor.nome_exibicao}
                        {fornecedor.status_verificacao === 'aprovado' && (
                          <BadgeCheck className="h-4 w-4 shrink-0 text-festa-600"
                            aria-label="Fornecedor verificado" />
                        )}
                      </p>
                      <p className="flex items-center gap-1.5 text-sm text-slate-600">
                        <MapPin className="h-4 w-4 shrink-0 text-festa-600" aria-hidden="true" />
                        {fornecedor.cidade}/{fornecedor.estado}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {fornecedor.status_fornecedor === 'ativo'
                          ? `${fornecedor.servicos_ativos} serviço(s) na vitrine`
                          : 'Indisponível no momento'}
                      </p>
                    </div>

                    <BotaoFavorito tipo="fornecedor" id={fornecedor.id} favorito
                      rotulo={fornecedor.nome_exibicao} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
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
      <span className="text-xs text-slate-500">{nota.toFixed(1)} ({total})</span>
    </p>
  );
}
