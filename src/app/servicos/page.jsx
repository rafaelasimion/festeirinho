import Link from 'next/link';
import { Store, MapPin, BadgeCheck, Image as ImageIcon, Star, Search } from 'lucide-react';
import { pool } from '@/lib/db';
import { formatarPreco, SUFIXO_PRECO } from '@/lib/solicitacao';
import { lerSessao } from '@/lib/sessao';
import Etiqueta from '@/componentes/etiqueta';
import DescricaoExpansivel from '@/componentes/descricao-expansivel';

// Esta página só LÊ e mostra. Por isso ela consulta o banco direto, sem
// passar por uma rota de API: componente de servidor já roda no servidor.
//
// A busca também é inteira de servidor: o formulário é um GET comum, os
// filtros vão para a URL (/servicos?q=bolo&categoria=3) e a página os lê
// daqui. Não há JavaScript no navegador — funciona até com ele desligado,
// e o endereço de uma busca pode ser copiado e compartilhado.

// A ordenação vem de uma lista fechada. O valor recebido da URL escolhe uma
// entrada da lista; ele NUNCA é colado no SQL. ORDER BY não aceita
// parâmetro "?", então esta lista é a única proteção possível ali.
const ORDENACOES = {
  recentes: { rotulo: 'Mais recentes', sql: 's.data_cadastro DESC' },
  avaliacao: {
    rotulo: 'Melhor avaliados',
    // Serviços sem avaliação vão para o fim, e não para o começo.
    sql: 'av.media_nota IS NULL, av.media_nota DESC, av.total_avaliacoes DESC',
  },
  menor_preco: { rotulo: 'Menor preço', sql: 's.preco_base ASC' },
  maior_preco: { rotulo: 'Maior preço', sql: 's.preco_base DESC' },
};

// No LIKE, % e _ são curingas. Sem escapar, quem digitasse "100%" buscaria
// "100 seguido de qualquer coisa". A barra invertida é o escape padrão do
// MySQL.
function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, '\\$&');
}

export default async function Vitrine({ searchParams }) {
  const parametros = await searchParams;
  const sessao = await lerSessao();
  const podeSolicitar = sessao?.tipoUsuario === 'cliente';

  const texto = String(parametros?.q ?? '').trim().slice(0, 100);
  const idCategoria = Number(parametros?.categoria);
  const cidade = String(parametros?.cidade ?? '').trim().slice(0, 100);
  const ordem = ORDENACOES[parametros?.ordem] ? parametros.ordem : 'recentes';

  const temCategoria = Number.isInteger(idCategoria) && idCategoria > 0;
  const filtrando = Boolean(texto) || temCategoria || Boolean(cidade);

  // RN020 — só aparece o que está ativo e aprovado, de fornecedor ativo.
  // Os filtros são acrescentados como condições com "?", cada uma com o seu
  // valor no array: o texto digitado nunca vira parte do comando.
  const condicoes = [
    "s.status_servico = 'ativo'",
    "s.status_verificacao = 'aprovado'",
    "f.status_fornecedor = 'ativo'",
  ];
  const valores = [];

  if (texto) {
    // Um termo busca em nome e descrição do serviço, no nome do fornecedor
    // e na categoria — é onde a pessoa espera encontrar o que digitou.
    condicoes.push(`(s.nome LIKE CONCAT('%', ?, '%')
                  OR s.descricao LIKE CONCAT('%', ?, '%')
                  OR f.nome_exibicao LIKE CONCAT('%', ?, '%')
                  OR c.nome LIKE CONCAT('%', ?, '%'))`);
    const termo = escaparLike(texto);
    valores.push(termo, termo, termo, termo);
  }

  if (temCategoria) {
    condicoes.push('s.id_categoria = ?');
    valores.push(idCategoria);
  }

  if (cidade) {
    condicoes.push(`u.cidade LIKE CONCAT('%', ?, '%')`);
    valores.push(escaparLike(cidade));
  }

  // A média de avaliações vem de uma subconsulta agrupada. Entram TODAS as
  // notas, inclusive as de avaliação oculta: a RN062 esconde só o
  // comentário, nunca a nota.
  const [servicos] = await pool.execute(
    `SELECT s.id, s.nome, s.descricao, s.preco_base, s.capacidade_max,
            s.dias_antecedencia,
            c.nome AS categoria, cb.descricao AS cobranca,
            f.nome_exibicao, f.status_verificacao AS verificacao_fornecedor,
            u.cidade, u.estado,
            av.media_nota, av.total_avaliacoes,
            fp.imagem_url AS foto_principal
       FROM servico s
       JOIN fornecedor f ON f.id = s.id_fornecedor
       JOIN usuario u    ON u.id = f.id_usuario
       JOIN categoria c  ON c.id = s.id_categoria
       JOIN cobranca cb  ON cb.id = s.id_cobranca
       LEFT JOIN foto_servico fp ON fp.id_servico = s.id AND fp.principal = TRUE
       LEFT JOIN (
            SELECT so.id_servico,
                   AVG(a.nota)  AS media_nota,
                   COUNT(*)     AS total_avaliacoes
              FROM avaliacao a
              JOIN solicitacao so ON so.id = a.id_solicitacao
             GROUP BY so.id_servico
       ) av ON av.id_servico = s.id
      WHERE ${condicoes.join(' AND ')}
      ORDER BY ${ORDENACOES[ordem].sql}`,
    valores
  );

  const [categorias] = await pool.query('SELECT id, nome FROM categoria ORDER BY nome');

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">
        Serviços disponíveis
      </h1>

      {/* method="get": os campos viram parâmetros na URL ao enviar. */}
      <form method="get" action="/servicos" role="search"
        className="mb-8 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-festa-600"
            aria-hidden="true" />
          <label htmlFor="busca-texto" className="sr-only">Buscar</label>
          <input id="busca-texto" name="q" type="search" defaultValue={texto}
            placeholder="Busque por serviço, tema ou fornecedor"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-11 pr-3.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="busca-categoria" className="sr-only">Categoria</label>
            <select id="busca-categoria" name="categoria"
              defaultValue={temCategoria ? String(idCategoria) : ''}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30">
              <option value="">Todas as categorias</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="busca-cidade" className="sr-only">Cidade</label>
            <input id="busca-cidade" name="cidade" defaultValue={cidade} placeholder="Cidade"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
          </div>

          <div>
            <label htmlFor="busca-ordem" className="sr-only">Ordenar por</label>
            <select id="busca-ordem" name="ordem" defaultValue={ordem}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30">
              {Object.entries(ORDENACOES).map(([valor, { rotulo }]) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit"
            className="rounded-lg bg-festa-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-festa-700">
            Buscar
          </button>
          {(filtrando || ordem !== 'recentes') && (
            <Link href="/servicos" className="text-sm font-medium text-festa-700 hover:underline">
              Limpar filtros
            </Link>
          )}
        </div>
      </form>

      {filtrando && (
        <p className="mb-4 text-sm text-slate-600" aria-live="polite">
          {servicos.length === 0
            ? 'Nenhum serviço encontrado com esses filtros.'
            : `${servicos.length} serviço(s) encontrado(s).`}
        </p>
      )}

      {servicos.length === 0 ? (
        !filtrando && (
          <p className="text-sm text-slate-600">
            Ainda não há serviços aprovados disponíveis.
          </p>
        )
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2">
          {servicos.map((servico) => (
            <li key={servico.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

              {/* Foto principal do serviço (RF012). Sem foto, o espaço fica
                  reservado com o ícone: a proporção fixa mantém a grade
                  alinhada nos dois casos. */}
              <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-festa-100">
                {servico.foto_principal ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={servico.foto_principal} alt={servico.nome}
                    className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-10 w-10 text-festa-600" aria-hidden="true" />
                )}
                <span className="absolute right-3 top-3">
                  <Etiqueta tom="roxo">{servico.categoria}</Etiqueta>
                </span>
              </div>

              <div className="flex flex-col gap-3 p-5">
                <div>
                  <h2 className="font-medium text-slate-900">{servico.nome}</h2>
                  <Estrelas media={servico.media_nota} total={servico.total_avaliacoes} />
                  <DescricaoExpansivel texto={servico.descricao} />
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
