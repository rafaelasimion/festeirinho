import { CalendarClock, MapPin, Users } from 'lucide-react';
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
export default function CartaoSolicitacao({
  como: Tag = 'li',
  titulo, subtitulo, preco, foto, etiquetas, quando, convidados, local,
  painel, children,
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
            <h2 className="font-semibold text-slate-900">{titulo}</h2>
            <p className="text-sm text-slate-600">{subtitulo}</p>
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
