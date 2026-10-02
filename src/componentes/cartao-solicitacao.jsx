import Link from 'next/link';
import { CalendarClock, MapPin, Users, ChevronRight } from 'lucide-react';
import MolduraFoto from '@/componentes/moldura-foto';

// Casca do cartão de solicitação, igual nas duas telas — a do cliente e a
// de solicitações recebidas. Quem usa as duas reconhece a mesma peça.
//
// O cabeçalho em roxo claro é o que faz o cartão ler como cartão: antes
// era tudo branco sobre branco, com uma borda fina, e o que separava um
// pedido do outro era só um espaço. Ele também agrupa o que identifica a
// contratação — o quê, com quem, quanto e em que pé está — e deixa o corpo
// branco só para o detalhe e as ações.

// `como` existe porque este mesmo resumo aparece fora de lista: na tela de
// pagamento ele é um bloco solto, e um <li> sozinho, sem <ul> em volta, é
// HTML inválido. O padrão continua sendo o <li> das duas listas.
// hrefTitulo e hrefSubtitulo são opcionais porque os dois lados do
// sistema têm destinos diferentes: para o cliente o título leva ao serviço
// e o subtítulo à vitrine do fornecedor; para o fornecedor o subtítulo é o
// nome do cliente, que não tem página. Sem href, o texto fica texto.
export default function CartaoSolicitacao({
  como: Tag = 'li',
  titulo, subtitulo, preco, foto, etiquetas, quando, convidados, local,
  hrefTitulo, hrefSubtitulo, painel, children,
}) {
  return (
    // Corpo branco, e quem dá peso ao cartão é a foto.
    //
    // Antes daqui o cabeçalho era um bloco roxo, e foram quatro tentativas
    // de fazer a etiqueta de status funcionar em cima dele: pastel sobre
    // roxo claro se dissolvia, sobre roxo vivo ficava encardida, e selo
    // colorido cheio sumia (sucesso-600 sobre festa-600 dá 1,12:1). O
    // problema não era a cor da etiqueta — era pedir que ela vivesse sobre
    // fundo colorido. Sem o bloco, a etiqueta de ponto resolve sozinha.
    <Tag className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col sm:flex-row">
        {/* No celular a foto é uma faixa no topo, com altura fixa: de lado
            ali ela vira uma fita de 60px, larga demais para caber a
            contratação e estreita demais para se enxergar a foto. Do sm
            para cima ela volta para a lateral, sem altura própria, e
            acompanha esta linha. */}
        <MolduraFoto foto={foto} className="h-32 w-full shrink-0 sm:h-auto sm:w-28" />

        <div className="min-w-0 flex-1 p-4 sm:p-5">
        {/* No celular a etiqueta desce para a linha de baixo. Lado a lado
            ali, "Aguardando pagamento" come a largura toda e um nome de
            serviço comprido desce em uma palavra por linha. */}
        <div className="sm:flex sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">
              {hrefTitulo
                ? (
                  <Link href={hrefTitulo}
                    className="rounded transition-colors hover:text-festa-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-festa-600/40">
                    {titulo}
                  </Link>
                )
                : titulo}
            </h2>
            <p className="text-sm text-slate-600">
              {hrefSubtitulo
                ? (
                  <Link href={hrefSubtitulo}
                    className="rounded transition-colors hover:text-festa-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-festa-600/40">
                    {subtitulo}
                  </Link>
                )
                : subtitulo}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-0 sm:shrink-0 sm:justify-end">
            {etiquetas}
          </div>
        </div>

        <p className="mt-1.5 text-lg font-semibold text-festa-700">{preco}</p>

        {/* Uma divisória só, separando o que identifica a contratação do
            detalhe dela. */}
        <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 text-sm text-slate-700">
          <p className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-festa-600" aria-hidden="true" />
            <span>{quando}</span>
          </p>
          {convidados && (
            <p className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-festa-600" aria-hidden="true" />
              <span>{convidados}</span>
            </p>
          )}
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-festa-600" aria-hidden="true" />
            <span>{local}</span>
          </p>
        </div>

          {children}
        </div>
      </div>

      {/* O painel aberto — conversa, cancelamento, recusa, denúncia,
          contestação — mora FORA da linha da foto, em largura cheia.
          Dentro dela, um chat de 500px de altura esticava a faixa lateral
          junto, e a foto virava uma tira comprida e deformada. Aqui o
          cartão cresce para baixo e a faixa continua do tamanho do resumo. */}
      {painel && (
        <div className="border-t border-slate-200 p-4 sm:p-5">{painel}</div>
      )}
    </Tag>
  );
}

// Detalhe que o cartão guarda fechado.
//
// Uma contestação traz motivo, descrição, data de envio, resultado,
// justificativa e data da análise — seis parágrafos que, abertos, fazem o
// cartão passar de duas telas e empurram as ações para fora da vista.
// Recolhido, sobra a linha que importa: do que se trata e como terminou.
//
// É <details>/<summary> do navegador, sem estado em React: abre e fecha
// sozinho, funciona pelo teclado e é lido como botão por leitor de tela.
//
// `abertoPorPadrao` serve ao que ainda está em aberto — uma contestação
// pendente a pessoa precisa ver sem procurar; uma já julgada, não.
export function DetalheRecolhivel({
  resumo, tom = 'neutro', abertoPorPadrao = false, children,
}) {
  const TONS = {
    neutro: 'border-slate-200 bg-slate-50',
    atencao: 'border-atencao-200 bg-atencao-50',
    perigo: 'border-perigo-200 bg-perigo-50',
  };

  return (
    <details open={abertoPorPadrao || undefined}
      className={`group mt-4 rounded-xl border ${TONS[tom] ?? TONS.neutro}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium text-slate-800">
        <ChevronRight aria-hidden="true"
          className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
        <span className="min-w-0 flex-1">{resumo}</span>
      </summary>

      <div className="space-y-2 px-3 pb-3 pl-9 text-sm">{children}</div>
    </details>
  );
}

// Aviso de uma linha dentro do cartão — prazo a cumprir, situação em
// andamento. Substitui os <p> soltos que antes vinham cada um com a sua
// divisória: eles fatiavam o cartão em faixas.
export function AvisoCartao({ tom = 'neutro', children }) {
  const TONS = {
    neutro: 'bg-slate-50 text-slate-700',
    festa: 'bg-festa-50 text-festa-800',
    atencao: 'bg-atencao-50 text-atencao-800',
    sucesso: 'bg-sucesso-50 text-sucesso-800',
  };

  return (
    <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${TONS[tom] ?? TONS.neutro}`}>
      {children}
    </p>
  );
}
