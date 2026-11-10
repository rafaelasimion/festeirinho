import Link from 'next/link';
import { Store, MapPin, BadgeCheck, Star } from 'lucide-react';
import { formatarPreco, SUFIXO_PRECO } from '@/lib/solicitacao';
import { antecedenciaExigida } from '@/lib/parametros';
import Etiqueta from '@/componentes/etiqueta';
import MolduraFoto from '@/componentes/moldura-foto';
import BotaoFavorito from '@/componentes/botao-favorito';

// O cartão de um serviço na vitrine (UC 011).
//
// Saiu da página de busca quando a tela inicial passou a mostrar serviços
// também: o mesmo serviço precisa ter a mesma cara nas duas, e o cartão tem
// regra demais para ser copiado — a antecedência exigida (RN046), a
// distância (RN068), o selo do fornecedor (RF014) e o coração (RF015).
//
// Recebe a linha de buscarServicos (lib/busca-servicos.js). O nível do
// título muda com a página: na busca ele fica logo abaixo do h1; na tela
// inicial, dentro de uma seção que já tem o seu h2.

export default function CartaoServico({
  servico, minimoAntecedencia, podeFavoritar = false, nivelTitulo = 'h2',
}) {
  const Titulo = nivelTitulo;

  return (
    // flex-col + h-full: todos os cards da linha ficam da mesma
    // altura, e o botão encosta no rodapé de cada um.
    <li className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">

      {/* Foto principal do serviço (RF012). Sem foto entra o padrão
          de festa, e a proporção fixa mantém a grade alinhada nos
          dois casos. */}
      <MolduraFoto foto={servico.foto_principal} alt={servico.nome}
        className="aspect-[4/3]">
        <span className="absolute right-3 top-3">
          <Etiqueta tom="roxo">{servico.categoria}</Etiqueta>
        </span>
      </MolduraFoto>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Titulo className="font-medium text-slate-900">
              <Link href={`/servicos/${servico.id}`} className="hover:underline">
                {servico.nome}
              </Link>
            </Titulo>
            <Estrelas media={servico.media_nota} total={servico.total_avaliacoes} />
            {/* Três linhas e ponto: o texto completo está na página
                de detalhes. Expandir aqui desalinharia a grade. */}
            <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-slate-700">
              {servico.descricao}
            </p>
          </div>
          {podeFavoritar && (
            <BotaoFavorito tipo="servico" id={servico.id}
              favorito={Boolean(servico.id_favorito)} rotulo={servico.nome} />
          )}
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
              {servico.distancia_km !== null && (
                <span className="text-slate-500">
                  · {Number(servico.distancia_km).toLocaleString('pt-BR', {
                    minimumFractionDigits: 1, maximumFractionDigits: 1,
                  })} km
                </span>
              )}
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

        {/* RN046 — o mínimo vigente sai uma vez para a lista inteira;
            cada cartão anuncia o maior entre ele e a antecedência do
            serviço. */}
        <p className="text-xs text-slate-500">
          antecedência de {antecedenciaExigida(servico.dias_antecedencia, minimoAntecedencia)} dias
          {servico.capacidade_max !== null &&
            ` · até ${servico.capacidade_max} convidados`}
        </p>

        {/* UC 011 — o card leva aos detalhes; a solicitação parte
            de lá, com as fotos, o fornecedor e as avaliações à
            vista. */}
        <Link href={`/servicos/${servico.id}`}
          className="mt-auto block rounded-lg bg-festa-600 px-4 py-3 text-center font-medium text-white transition-colors hover:bg-festa-700">
          Ver detalhes
        </Link>
      </div>
    </li>
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
