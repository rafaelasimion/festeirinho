import Link from 'next/link';
import { Search } from 'lucide-react';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { calcularAntecedenciaMinimaDias } from '@/lib/configuracao';
import {
  ORDENACOES, buscarServicos, lerLocalizacaoCliente, temCoordenadas,
} from '@/lib/busca-servicos';
import CartaoServico from '@/componentes/cartao-servico';

// Esta página só LÊ e mostra. Por isso ela consulta o banco direto, sem
// passar por uma rota de API: componente de servidor já roda no servidor.
//
// A busca também é inteira de servidor: o formulário é um GET comum, os
// filtros vão para a URL (/servicos?q=bolo&categoria=3) e a página os lê
// daqui. Não há JavaScript no navegador — funciona até com ele desligado,
// e o endereço de uma busca pode ser copiado e compartilhado.
//
// A consulta em si mora em lib/busca-servicos.js, e o cartão em
// componentes/cartao-servico.jsx: a tela inicial mostra a mesma vitrine e
// precisa mostrá-la do mesmo jeito.

export default async function Vitrine({ searchParams }) {
  const parametros = await searchParams;
  const sessao = await lerSessao();
  const podeSolicitar = sessao?.tipoUsuario === 'cliente';

  // RN068 — o filtro de proximidade é do CLIENTE: é a localização dele que
  // define quais fornecedores o alcançam. Visitante e fornecedor navegam na
  // vitrine completa (RN030).
  const localizacao = await lerLocalizacaoCliente(sessao);
  const comCoordenadas = temCoordenadas(localizacao);

  const texto = String(parametros?.q ?? '').trim().slice(0, 100);
  const idCategoria = Number(parametros?.categoria);
  const cidade = String(parametros?.cidade ?? '').trim().slice(0, 100);
  const temCategoria = Number.isInteger(idCategoria) && idCategoria > 0;
  const filtrando = Boolean(texto) || temCategoria || Boolean(cidade);

  // "Mais perto de mim" só existe quando há distância a medir.
  const ordensDisponiveis = Object.fromEntries(
    Object.entries(ORDENACOES).filter(([valor]) => valor !== 'distancia' || comCoordenadas)
  );
  // A variada é o padrão para todo mundo: alterna os fornecedores e, com
  // coordenadas, já começa cada rodada pelo mais próximo. Quem quer a lista
  // rigorosa por distância, data ou preço escolhe no seletor.
  const ordemPadrao = 'variados';
  const ordem = ordensDisponiveis[parametros?.ordem] ? parametros.ordem : ordemPadrao;

  const servicos = await buscarServicos({
    sessao,
    localizacao,
    texto,
    idCategoria: temCategoria ? idCategoria : null,
    cidade,
    ordem,
  });

  const [categorias] = await pool.query('SELECT id, nome FROM categoria ORDER BY nome');

  // RN046 — o mínimo vigente sai uma vez para a lista inteira; cada cartão
  // anuncia o maior entre ele e a antecedência do serviço.
  const minimoAntecedencia = await calcularAntecedenciaMinimaDias();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">
        Serviços disponíveis
      </h1>

      {/* RN068 — o filtro é de conveniência, mas esconde resultados: sem
          explicar, uma lista curta parece defeito do sistema. */}
      {localizacao && (
        <p className="mb-6 text-sm text-slate-600">
          {comCoordenadas ? (
            'Mostrando fornecedores cuja área de atendimento alcança a sua localização.'
          ) : (
            <>
              Mostrando fornecedores de {localizacao.cidade}/{localizacao.estado}.{' '}
              <Link href="/minha-conta#localizacao" className="font-medium text-festa-700 hover:underline">
                Informe sua localização em Minha conta
              </Link>{' '}
              para ver também os de cidades vizinhas que atendem a sua região.
            </>
          )}
        </p>
      )}

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
              className="w-full rounded-lg border border-slate-300 bg-white pl-3.5 py-2.5 text-slate-900 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30">
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
              className="w-full rounded-lg border border-slate-300 bg-white pl-3.5 py-2.5 text-slate-900 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30">
              {Object.entries(ordensDisponiveis).map(([valor, { rotulo }]) => (
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
          {(filtrando || ordem !== ordemPadrao) && (
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
            {localizacao
              ? 'Nenhum fornecedor atende a sua região por enquanto.'
              : 'Ainda não há serviços aprovados disponíveis.'}
          </p>
        )
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2">
          {servicos.map((servico) => (
            <CartaoServico key={servico.id} servico={servico}
              minimoAntecedencia={minimoAntecedencia}
              podeFavoritar={podeSolicitar} />
          ))}
        </ul>
      )}
    </main>
  );
}
