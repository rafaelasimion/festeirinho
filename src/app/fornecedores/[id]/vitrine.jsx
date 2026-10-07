'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MapPin, Target, Star, SquarePen, Plus,
  Phone, AtSign, Globe, BadgeCheck,
} from 'lucide-react';
import Etiqueta from '@/componentes/etiqueta';
import MolduraFoto from '@/componentes/moldura-foto';
import BotaoFavorito from '@/componentes/botao-favorito';
import {
  formatarPreco, SUFIXO_PRECO, ROTULO_VERIFICACAO, TOM_VERIFICACAO,
} from '@/lib/solicitacao';
import { formatarData } from '@/lib/datas';

function Estrelas({ nota, tamanho = 'h-4 w-4' }) {
  return (
    <span className="flex" aria-label={`Nota ${Number(nota).toFixed(1)} de 5`}>
      {[1, 2, 3, 4, 5].map((posicao) => (
        <Star key={posicao} aria-hidden="true"
          className={`${tamanho} ${posicao <= Math.round(nota)
            ? 'fill-atencao-600 text-atencao-600'
            : 'text-slate-300'}`} />
      ))}
    </span>
  );
}

export default function Vitrine({
  fornecedor, categorias, servicos: servicosIniciais, avaliacoes, comentarios,
  ehDono, ehCliente, favorito,
}) {
  const router = useRouter();
  const [aba, setAba] = useState('servicos');
  const [servicos, setServicos] = useState(servicosIniciais);
  const [alternando, setAlternando] = useState(null);
  const [erroServico, setErroServico] = useState('');

  // UC 010 — ativar e desativar sem sair da vitrine. Atualização
  // otimista: o interruptor vira na hora e volta sozinho se der erro.
  //
  // O desfazimento devolve só o serviço que falhou, e não a lista inteira.
  //
  // Antes ele fazia `setServicos(servicosIniciais)`, voltando para a PROP —
  // que é o retrato do servidor no render em que o clique aconteceu, e não o
  // estado de agora. Desativando dois serviços em sequência, com o segundo
  // falhando, o desfazimento ressuscitava o primeiro como ativo na tela
  // enquanto ele já estava inativo no banco. Mexer só na linha que falhou,
  // a partir da lista corrente, não tem como desfazer o que deu certo.
  async function alternarAtivo(servico) {
    const acao = servico.status_servico === 'ativo' ? 'inativar' : 'reativar';
    const novo = acao === 'inativar' ? 'inativo' : 'ativo';
    const anterior = servico.status_servico;

    const aplicar = (status) => setServicos((lista) => lista.map((s) =>
      s.id === servico.id ? { ...s, status_servico: status } : s));

    setErroServico('');
    setAlternando(servico.id);
    aplicar(novo);

    try {
      const resposta = await fetch(`/api/fornecedor/servicos/${servico.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        aplicar(anterior);
        setErroServico(dados.erro ?? 'Não foi possível alterar o serviço.');
        return;
      }
      router.refresh();
    } catch {
      aplicar(anterior);
      setErroServico('Falha de conexão. Tente novamente.');
    } finally {
      setAlternando(null);
    }
  }

  // RN020 / UC 010 — o desativado sai da vitrine do cliente, mas para o
  // dono ele continua existindo. Separá-los evita que a lista de quem
  // trabalha vire um depósito: o que está no ar fica em cima, o que foi
  // desativado fica recolhido embaixo.
  const ativos = servicos.filter((s) => s.status_servico === 'ativo');
  const inativos = servicos.filter((s) => s.status_servico !== 'ativo');

  const redes = [
    { url: fornecedor.whatsappUrl, rotulo: 'WhatsApp', Icone: Phone },
    { url: fornecedor.instagramUrl, rotulo: 'Instagram', Icone: AtSign },
    { url: fornecedor.site, rotulo: 'Site', Icone: Globe },
  ].filter(({ url }) => Boolean(url));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      {/* ---------- cabeçalho do fornecedor ---------- */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-4">
          {/* Menor no celular: a foto disputa largura com o nome, e era ela
              que empurrava o selo de verificado para a linha de baixo. */}
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-festa-200 bg-festa-50 sm:h-20 sm:w-20">
            {fornecedor.fotoPerfil ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fornecedor.fotoPerfil} alt={`Foto de ${fornecedor.nomeExibicao}`}
                className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-semibold text-festa-600" aria-hidden="true">
                {fornecedor.nomeExibicao.slice(0, 2).toUpperCase()}
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1">
            {/* O selo é inline, e não um item de flex: em nome comprido, o
                flex jogava o selo sozinho para a linha de baixo. Assim ele
                acompanha a última palavra, como um acento. */}
            <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">
              {fornecedor.nomeExibicao}
              {/* RF014 — o selo é do fornecedor aprovado. */}
              {fornecedor.statusVerificacao === 'aprovado' && (
                <BadgeCheck className="ml-1.5 inline h-5 w-5 align-[-0.15em] text-festa-600"
                  aria-label="Fornecedor verificado" />
              )}
            </h1>

            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
              <MapPin className="h-4 w-4 shrink-0 text-festa-600" aria-hidden="true" />
              {fornecedor.cidade}/{fornecedor.estado}
            </p>

            {/* RN068 — para o dono, o alcance que ele definiu; para o
                cliente, a distância real, quando há coordenadas dos dois. */}
            <p className="mt-0.5 flex items-center gap-1.5 text-sm">
              <Target className="h-4 w-4 shrink-0 text-festa-600" aria-hidden="true" />
              {ehDono ? (
                <span className="text-slate-600">
                  Atende até <strong className="font-semibold text-slate-800">
                    {fornecedor.raioAtendimentoKm}km
                  </strong>
                </span>
              ) : fornecedor.distanciaKm !== null ? (
                <span className="font-medium text-festa-700">
                  A {fornecedor.distanciaKm.toLocaleString('pt-BR', {
                    maximumFractionDigits: 1,
                  })}km de você
                </span>
              ) : (
                <span className="text-slate-600">
                  Atende até {fornecedor.raioAtendimentoKm}km
                </span>
              )}
            </p>

            {avaliacoes.total > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <Estrelas nota={avaliacoes.media} />
                <span className="text-sm text-slate-500">{avaliacoes.total}</span>
              </div>
            )}
          </div>

          <div className="shrink-0">
            {ehDono ? (
              <Link href="/fornecedor/vitrine/editar"
                aria-label="Editar dados da vitrine"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-festa-600 transition-colors hover:bg-festa-50">
                <SquarePen className="h-6 w-6" aria-hidden="true" />
              </Link>
            ) : ehCliente ? (
              <BotaoFavorito tipo="fornecedor" id={fornecedor.id}
                favorito={favorito} rotulo={fornecedor.nomeExibicao} />
            ) : null}
          </div>
        </div>

        <p className="mt-4 whitespace-pre-line text-slate-700">{fornecedor.descricao}</p>

        {/* RF014 — categorias derivadas dos serviços ativos e aprovados. */}
        {categorias.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {categorias.map((nome) => (
              <li key={nome}
                className="rounded-full bg-festa-600 px-3.5 py-1.5 text-sm font-medium text-white">
                {nome}
              </li>
            ))}
          </ul>
        )}

        {redes.length > 0 && (
          <ul className="mt-4 flex gap-2">
            {redes.map(({ url, rotulo, Icone }) => (
              <li key={rotulo}>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  aria-label={rotulo} title={rotulo}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-festa-50 text-festa-600 transition-colors hover:bg-festa-100">
                  <Icone className="h-5 w-5" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* RF025 — o dono precisa saber por que foi recusado. */}
      {ehDono && fornecedor.statusVerificacao === 'rejeitado' && fornecedor.motivoRejeicao && (
        <div className="mt-4 rounded-2xl border border-perigo-200 bg-perigo-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-perigo-700">
            Motivo da recusa do cadastro
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
            {fornecedor.motivoRejeicao}
          </p>
        </div>
      )}

      {/* ---------- abas ---------- */}
      {/* No celular ocupam a largura toda, que é o alvo de toque certo.
          No desktop encolhem para o tamanho do texto: um botão de 700px
          de largura para escrever "Serviços" não ajuda ninguém. */}
      <div role="tablist" aria-label="Conteúdo do fornecedor"
        className="mt-6 grid grid-cols-2 gap-3 sm:inline-grid sm:grid-cols-[auto_auto]">
        {[
          { valor: 'servicos', rotulo: 'Serviços' },
          { valor: 'avaliacoes', rotulo: 'Avaliações' },
        ].map(({ valor, rotulo }) => (
          <button key={valor} type="button" role="tab"
            aria-selected={aba === valor}
            onClick={() => setAba(valor)}
            className={`rounded-full px-4 py-3 font-medium transition-colors sm:px-8 sm:py-2.5 ${
              aba === valor
                ? 'bg-festa-600 text-white'
                : 'border border-slate-200 bg-white text-festa-700 hover:bg-festa-50'}`}>
            {rotulo}
          </button>
        ))}
      </div>

      {aba === 'servicos' ? (
        <section className="mt-6">
          {ehDono && (
            <Link href="/fornecedor/servicos?novo=1"
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-festa-600 px-5 py-3.5 font-semibold text-white transition-colors hover:bg-festa-700 sm:inline-flex sm:w-auto sm:py-2.5">
              <Plus className="h-5 w-5" aria-hidden="true" />
              Cadastrar novo serviço
            </Link>
          )}

          {erroServico && (
            <p className="mb-4 rounded-xl bg-perigo-50 px-4 py-3 text-sm text-perigo-700">
              {erroServico}
            </p>
          )}

          {servicos.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              {ehDono
                ? 'Você ainda não cadastrou nenhum serviço.'
                : 'Este fornecedor ainda não tem serviços disponíveis.'}
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {ativos.map((servico) => (
                <CartaoServico key={servico.id} servico={servico} ehDono={ehDono}
                  alternando={alternando === servico.id}
                  aoAlternar={() => alternarAtivo(servico)} />
              ))}
            </ul>
          )}

          {ehDono && inativos.length > 0 && (
            <details className="mt-6 rounded-2xl border border-slate-200 bg-white">
              <summary className="cursor-pointer px-4 py-3.5 font-medium text-slate-700">
                Serviços desativados ({inativos.length})
              </summary>
              <div className="border-t border-slate-200 p-4">
                <p className="mb-4 text-sm text-slate-600">
                  Não aparecem para os clientes. As contratações e avaliações
                  antigas continuam guardadas.
                </p>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {inativos.map((servico) => (
                    <CartaoServico key={servico.id} servico={servico} ehDono={ehDono}
                      alternando={alternando === servico.id}
                      aoAlternar={() => alternarAtivo(servico)} />
                  ))}
                </ul>
              </div>
            </details>
          )}
        </section>
      ) : (
        <AbaAvaliacoes avaliacoes={avaliacoes} comentarios={comentarios} />
      )}
    </main>
  );
}

function CartaoServico({ servico, ehDono, alternando, aoAlternar }) {
  const ativo = servico.status_servico === 'ativo';
  const naoAprovado = servico.status_verificacao === 'rejeitado';

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* aspect-[4/3] em vez de altura fixa: a moldura acompanha a largura
          da coluna, então a foto não achata quando o card cresce.
          overflow-hidden não é só para cortar a foto — é o que faz a
          proporção valer. Como item de um flex em coluna, esta div ganharia
          min-height:auto, e uma foto em pé empurrava a moldura muito além do
          4:3. A regra do flexbox é que a altura mínima automática só vale
          com overflow visible; escondendo, ela vira zero e o 4:3 manda. É o
          mesmo motivo do overflow-hidden nos cards de /servicos. */}
      <MolduraFoto foto={servico.foto_principal} alt={`Foto de ${servico.nome}`}
        className="aspect-[4/3]" />

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-slate-900">{servico.nome}</h3>
          {ehDono && (
            <Link href={`/fornecedor/servicos?editar=${servico.id}`}
              aria-label={`Editar ${servico.nome}`}
              className="shrink-0 text-festa-600 transition-colors hover:text-festa-700">
              <SquarePen className="h-5 w-5" aria-hidden="true" />
            </Link>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>{servico.categoria}</span>
          {ehDono && (
            <Etiqueta tom={TOM_VERIFICACAO[servico.status_verificacao]} formato="caixa">
              {ROTULO_VERIFICACAO[servico.status_verificacao]}
            </Etiqueta>
          )}
        </div>

        {servico.total_avaliacoes > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Estrelas nota={servico.media_nota} />
            <span className="text-sm text-slate-500">{servico.total_avaliacoes}</span>
          </div>
        )}

        <p className="mt-2 text-lg font-semibold text-festa-700">
          {formatarPreco(servico.preco_base)}
          <span className="text-sm font-normal text-slate-500">
            {SUFIXO_PRECO[servico.cobranca] ?? ''}
          </span>
        </p>

        {/* RF025 — o motivo da recusa fica junto do serviço recusado, que é
            onde ele serve para alguma coisa. */}
        {ehDono && naoAprovado && servico.motivo_rejeicao && (
          <div className="mt-3 rounded-lg bg-perigo-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-perigo-700">
              Motivo da recusa
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
              {servico.motivo_rejeicao}
            </p>
          </div>
        )}

        <div className="mt-auto pt-4">
          {ehDono ? (
            /* UC 010 — role="switch" faz o leitor de tela anunciar
               "ligado/desligado" em vez de só "botão". */
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
              <span id={`rotulo-ativo-${servico.id}`} className="text-sm text-slate-700">
                Serviço ativo
              </span>
              <button type="button" role="switch" aria-checked={ativo}
                aria-labelledby={`rotulo-ativo-${servico.id}`}
                disabled={alternando}
                onClick={aoAlternar}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                  ativo ? 'bg-festa-600' : 'bg-slate-300'}`}>
                <span aria-hidden="true"
                  className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                    ativo ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          ) : (
            <Link href={`/servicos/${servico.id}`}
              className="flex w-full items-center justify-center rounded-xl bg-festa-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-festa-700">
              Ver detalhes
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

function AbaAvaliacoes({ avaliacoes, comentarios }) {
  if (avaliacoes.total === 0) {
    return (
      <p className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Este fornecedor ainda não recebeu avaliações.
      </p>
    );
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div className="text-center sm:w-40 sm:shrink-0">
          <p className="text-4xl font-semibold text-slate-900">
            {avaliacoes.media.toFixed(1).replace('.', ',')}
          </p>
          <div className="mt-1 flex justify-center">
            <Estrelas nota={avaliacoes.media} tamanho="h-5 w-5" />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {avaliacoes.total} {avaliacoes.total === 1 ? 'avaliação' : 'avaliações'}
          </p>
        </div>

        {/* Barras por nota. A largura é proporcional ao total, então o
            desenho responde à pergunta que a média não responde: as notas
            se concentram ou estão espalhadas? */}
        <ul className="flex-1 space-y-1.5">
          {avaliacoes.distribuicao.map(({ nota, quantidade }) => {
            const porcentagem = Math.round((quantidade / avaliacoes.total) * 100);
            return (
              <li key={nota} className="flex items-center gap-2">
                <span className="w-3 shrink-0 text-sm text-slate-600">{nota}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-festa-100">
                  <span className="block h-full rounded-full bg-festa-600"
                    style={{ width: `${porcentagem}%` }} />
                </span>
                <span className="w-8 shrink-0 text-right text-sm text-slate-500">
                  {quantidade}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {comentarios.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          As notas recebidas ainda não vieram acompanhadas de comentário público.
        </p>
      ) : (
        <ul className="space-y-3">
          {comentarios.map((comentario) => (
            <li key={comentario.id}
              className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-festa-100">
                  {comentario.foto_perfil ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={comentario.foto_perfil} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-festa-700" aria-hidden="true">
                      {comentario.cliente.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                <div>
                  <p className="font-medium text-slate-900">{comentario.cliente}</p>
                  <Estrelas nota={comentario.nota} />
                </div>
              </div>

              <p className="mt-3 whitespace-pre-line text-slate-700">
                {comentario.comentario}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {formatarData(comentario.data_avaliacao)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// RF004 / RN067 — o painel edita só o que aparece na vitrine. Os dados da
// conta (telefone, cidade, documento, raio) continuam em Meu perfil.
