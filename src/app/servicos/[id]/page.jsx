import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Store, MapPin, BadgeCheck, Star, ChevronLeft, User,
  Users, CalendarClock, AtSign, Globe, Phone,
} from 'lucide-react';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { formatarPreco, SUFIXO_PRECO, EXPLICACAO_COBRANCA } from '@/lib/solicitacao';
import Etiqueta from '@/componentes/etiqueta';
import GaleriaFotos from '@/componentes/galeria-fotos';
import BotaoFavorito from '@/componentes/botao-favorito';

// UC 011, passo 6 — detalhes do serviço e do fornecedor, com o indicador de
// verificação, as fotos e as avaliações.
//
// Um link direto para um serviço fora da área de atendimento continua
// abrindo: o filtro de proximidade é da BUSCA (RN068), e alguém pode ter
// recebido o endereço de outra pessoa. A distância é exibida para que a
// decisão seja informada.

function formatarData(valor) {
  return new Date(valor).toLocaleDateString('pt-BR');
}

// O comentário é público (RF037), mas o nome completo de quem avaliou não
// precisa ser: primeiro nome e a inicial do sobrenome bastam para dar
// credibilidade sem expor o cliente.
function nomeAbreviado(nome) {
  const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'Cliente';
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1][0]}.`;
}

export default async function DetalheServico({ params }) {
  const { id } = await params;
  const idServico = Number(id);
  if (!Number.isInteger(idServico)) notFound();

  const sessao = await lerSessao();
  const podeSolicitar = sessao?.tipoUsuario === 'cliente';

  // RN068 — a distância só existe quando cliente e fornecedor têm
  // coordenadas. As coordenadas em si nunca saem do servidor.
  let localizacao = null;
  if (podeSolicitar) {
    const [linhas] = await pool.execute(
      'SELECT latitude, longitude FROM usuario WHERE id = ? LIMIT 1',
      [sessao.id]
    );
    localizacao = linhas[0]?.latitude === null ? null : linhas[0];
  }

  const selecaoDistancia = localizacao
    ? `ROUND(ST_Distance_Sphere(POINT(u.longitude, u.latitude), POINT(?, ?)) / 1000, 1) AS distancia_km`
    : 'NULL AS distancia_km';
  const valores = localizacao
    ? [localizacao.longitude, localizacao.latitude, idServico]
    : [idServico];

  // RN020 — serviço inativo ou não aprovado, ou de fornecedor indisponível,
  // não é exibido ao cliente, nem por link direto.
  const [servicos] = await pool.execute(
    `SELECT s.id, s.nome, s.descricao, s.preco_base, s.capacidade_max,
            s.dias_antecedencia,
            c.nome AS categoria, cb.descricao AS cobranca,
            f.id AS id_fornecedor,
            f.nome_exibicao, f.descricao AS descricao_fornecedor,
            f.status_verificacao AS verificacao_fornecedor,
            f.instagram_url, f.whatsapp_url, f.site,
            u.cidade, u.estado, u.foto_perfil,
            ${selecaoDistancia}
       FROM servico s
       JOIN fornecedor f ON f.id = s.id_fornecedor
       JOIN usuario u    ON u.id = f.id_usuario
       JOIN categoria c  ON c.id = s.id_categoria
       JOIN cobranca cb  ON cb.id = s.id_cobranca
      WHERE s.id = ?
        AND s.status_servico = 'ativo'
        AND s.status_verificacao = 'aprovado'
        AND f.status_fornecedor = 'ativo'
      LIMIT 1`,
    valores
  );

  if (servicos.length === 0) notFound();
  const servico = servicos[0];

  // RF015 / RF016 — estado dos dois corações. Só o cliente favorita.
  let favoritos = { servico: false, fornecedor: false };
  if (podeSolicitar) {
    const [linhas] = await pool.execute(
      `SELECT fv.id_servico, fv.id_fornecedor
         FROM favorito fv
         JOIN cliente c ON c.id = fv.id_cliente
        WHERE c.id_usuario = ?
          AND (fv.id_servico = ? OR fv.id_fornecedor = ?)`,
      [sessao.id, idServico, servico.id_fornecedor]
    );
    favoritos = {
      servico: linhas.some((linha) => linha.id_servico === idServico),
      fornecedor: linhas.some((linha) => linha.id_fornecedor === servico.id_fornecedor),
    };
  }

  const [fotos] = await pool.execute(
    `SELECT id, imagem_url FROM foto_servico
      WHERE id_servico = ? ORDER BY principal DESC, id`,
    [idServico]
  );

  // RN062 — a média considera TODAS as notas, inclusive as de avaliações
  // ocultas; só o comentário é que fica restrito.
  const [resumo] = await pool.execute(
    `SELECT AVG(a.nota) AS media, COUNT(*) AS total
       FROM avaliacao a
       JOIN solicitacao so ON so.id = a.id_solicitacao
      WHERE so.id_servico = ?`,
    [idServico]
  );
  const media = resumo[0].media === null ? null : Number(resumo[0].media);
  const totalAvaliacoes = Number(resumo[0].total);

  const [comentarios] = await pool.execute(
    `SELECT a.nota, a.comentario, a.data_avaliacao, u.nome AS cliente
       FROM avaliacao a
       JOIN solicitacao so ON so.id = a.id_solicitacao
       JOIN cliente cl     ON cl.id = so.id_cliente
       JOIN usuario u      ON u.id  = cl.id_usuario
      WHERE so.id_servico = ?
        AND a.status_avaliacao = 'visivel'
        AND a.comentario IS NOT NULL
      ORDER BY a.data_avaliacao DESC
      LIMIT 20`,
    [idServico]
  );

  const redes = [
    { url: servico.instagram_url, rotulo: 'Instagram', Icone: AtSign },
    { url: servico.whatsapp_url, rotulo: 'WhatsApp', Icone: Phone },
    { url: servico.site, rotulo: 'Site', Icone: Globe },
  ].filter((rede) => rede.url);

  return (
    <div className="min-h-screen bg-festa-50">
      {/* Barra superior fixa: voltar e o nome do serviço, como no protótipo.
          Em telas pequenas, é o que mantém a orientação durante a rolagem. */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/servicos" aria-label="Voltar para a busca"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-festa-50 text-festa-700 transition-colors hover:bg-festa-100">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <h1 className="truncate text-lg font-semibold text-slate-900">{servico.nome}</h1>
        </div>
      </header>

      {/* pb-28 reserva o espaço da barra de ação fixa no rodapé. */}
      <main className="mx-auto max-w-3xl space-y-3 px-4 pb-28 pt-4">
        <section className="overflow-hidden rounded-2xl bg-white p-3">
          <GaleriaFotos fotos={fotos} nomeServico={servico.nome} />
        </section>

        <section className="rounded-2xl bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-slate-900">{servico.nome}</h2>
              <Estrelas media={media} total={totalAvaliacoes} />
            </div>
            {podeSolicitar && (
              <BotaoFavorito tipo="servico" id={servico.id}
                favorito={favoritos.servico} rotulo={servico.nome} />
            )}
          </div>
          <div className="mt-3">
            <Etiqueta tom="roxo">{servico.categoria}</Etiqueta>
          </div>
        </section>

        {/* UC 011, passo 6 — o fornecedor e o indicador de verificação. */}
        <section className="rounded-2xl bg-white p-5">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-festa-100">
              {servico.foto_perfil ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={servico.foto_perfil} alt={`Foto de ${servico.nome_exibicao}`}
                  className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <Store className="h-6 w-6 text-festa-600" aria-hidden="true" />
                </span>
              )}
            </div>

            {podeSolicitar && (
              <span className="order-last">
                <BotaoFavorito tipo="fornecedor" id={servico.id_fornecedor}
                  favorito={favoritos.fornecedor} rotulo={servico.nome_exibicao} />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <h3 className="flex flex-wrap items-center gap-1.5 text-lg font-medium text-slate-900">
                {servico.nome_exibicao}
                {servico.verificacao_fornecedor === 'aprovado' && (
                  <BadgeCheck className="h-5 w-5 shrink-0 text-festa-600"
                    aria-label="Fornecedor verificado" />
                )}
              </h3>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
                <MapPin className="h-4 w-4 shrink-0 text-festa-600" aria-hidden="true" />
                {servico.cidade}/{servico.estado}
                {servico.distancia_km !== null && (
                  <span className="text-slate-500">
                    · {Number(servico.distancia_km).toLocaleString('pt-BR', {
                      minimumFractionDigits: 1, maximumFractionDigits: 1,
                    })} km de você
                  </span>
                )}
              </p>
              {servico.verificacao_fornecedor === 'aprovado' && (
                <p className="mt-1 text-xs text-slate-500">
                  Cadastro conferido pela administração da plataforma.
                </p>
              )}
            </div>
          </div>

          <p className="mt-4 whitespace-pre-line text-sm text-slate-700">
            {servico.descricao_fornecedor}
          </p>

          {redes.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-4">
              {redes.map(({ url, rotulo, Icone }) => (
                <li key={rotulo}>
                  <a href={url} target="_blank" rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-festa-700 hover:underline">
                    <Icone className="h-4 w-4" aria-hidden="true" />
                    {rotulo}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-lg font-semibold text-festa-700">Sobre o serviço</h2>
          <p className="mt-2 whitespace-pre-line text-slate-700">{servico.descricao}</p>
          <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">
            {EXPLICACAO_COBRANCA[servico.cobranca]}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
            <Users className="h-6 w-6 shrink-0 text-festa-600" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium text-slate-900">Capacidade</p>
              <p className="text-sm text-slate-600">
                {servico.capacidade_max === null
                  ? 'Sem limite'
                  : `${servico.capacidade_max} pessoas`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
            <CalendarClock className="h-6 w-6 shrink-0 text-festa-600" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium text-slate-900">Antecedência</p>
              <p className="text-sm text-slate-600">{servico.dias_antecedencia} dias</p>
            </div>
          </div>
        </div>

        {/* RN062 — só os comentários públicos aparecem; as notas das
            avaliações privadas já estão na média acima. */}
        <section className="pt-3">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
            Avaliações {totalAvaliacoes > 0 && `(${totalAvaliacoes})`}
          </h2>

          {totalAvaliacoes === 0 ? (
            <p className="rounded-2xl bg-white p-5 text-sm text-slate-600">
              Este serviço ainda não foi avaliado.
            </p>
          ) : comentarios.length === 0 ? (
            <p className="rounded-2xl bg-white p-5 text-sm text-slate-600">
              As avaliações deste serviço não têm comentários públicos, mas as notas
              estão na média acima.
            </p>
          ) : (
            <ul className="space-y-3">
              {comentarios.map((comentario, posicao) => (
                <li key={posicao} className="rounded-2xl bg-white p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-festa-100">
                      <User className="h-5 w-5 text-festa-600" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">
                        {nomeAbreviado(comentario.cliente)}
                      </p>
                      <span className="mt-0.5 flex" aria-label={`Nota ${comentario.nota} de 5`}>
                        {[1, 2, 3, 4, 5].map((posicaoEstrela) => (
                          <Star key={posicaoEstrela} aria-hidden="true"
                            className={`h-4 w-4 ${posicaoEstrela <= comentario.nota
                              ? 'fill-atencao-600 text-atencao-600'
                              : 'text-slate-300'}`} />
                        ))}
                      </span>
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
      </main>

      {/* Barra de ação fixa: preço à esquerda, ação à direita. Numa página
          longa, a decisão precisa estar à mão em qualquer ponto da rolagem. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="shrink-0">
            <p className="text-xl font-semibold text-slate-900">
              {formatarPreco(servico.preco_base)}
            </p>
            {SUFIXO_PRECO[servico.cobranca] && (
              <p className="text-sm text-slate-600">
                {SUFIXO_PRECO[servico.cobranca].trim()}
              </p>
            )}
          </div>

          {podeSolicitar ? (
            <Link href={`/servicos/${servico.id}/solicitar`}
              className="rounded-lg bg-festa-600 px-6 py-3 font-medium text-white transition-colors hover:bg-festa-700">
              Solicitar serviço
            </Link>
          ) : !sessao ? (
            <Link href="/login"
              className="rounded-lg border border-festa-600 px-6 py-3 font-medium text-festa-700 transition-colors hover:bg-festa-50">
              Entrar para solicitar
            </Link>
          ) : (
            <p className="text-right text-sm text-slate-600">
              Apenas contas de cliente<br />podem solicitar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Estrelas({ media, total }) {
  if (!total) {
    return <p className="mt-1 text-sm text-slate-500">Ainda sem avaliações</p>;
  }

  const cheias = Math.round(media);

  return (
    <p className="mt-1 flex items-center gap-2">
      <span className="flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((posicao) => (
          <Star key={posicao}
            className={`h-5 w-5 ${posicao <= cheias
              ? 'fill-atencao-600 text-atencao-600'
              : 'text-slate-300'}`} />
        ))}
      </span>
      <span className="text-sm text-slate-600">
        {media.toFixed(1)} · {total} avaliação(ões)
      </span>
    </p>
  );
}
