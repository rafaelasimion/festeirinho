import { CalendarClock, MapPin, Users, ImageOff } from 'lucide-react';

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
  titulo, subtitulo, preco, foto, etiquetas, quando, convidados, local, children,
}) {
  return (
    <Tag className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Roxo cheio, e não um tom claro. As etiquetas de status são
          pastéis, e sobre um fundo também pastel elas se dissolviam: a
          diferença era só de matiz. Aqui a etiqueta é clara sobre escuro —
          5,1:1 no vermelho, 5,6:1 no verde, 5,8:1 no laranja — e a
          miniatura branca ganha moldura de graça. */}
      <div className="bg-festa-600 px-5 py-4">
        <div className="flex gap-3">
          {/* Miniatura quadrada, em fundo branco: sobre o roxo do cabeçalho
              ela se destaca sozinha, e o branco serve de moldura tanto para
              a foto quanto para o ícone de quando não há nenhuma. */}
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageOff className="h-6 w-6 text-festa-300" aria-hidden="true" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            {/* No celular a etiqueta desce para a linha de baixo. Lado a
                lado ali, "Aguardando pagamento" come metade da largura e um
                nome de serviço comprido desce em uma palavra por linha. */}
            <div className="sm:flex sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold text-white">{titulo}</h2>
                {/* festa-200 e não festa-300: o 300 cai para 3,5:1 sobre o
                    festa-600, abaixo do mínimo da RNF013. */}
                <p className="text-sm text-festa-200">{subtitulo}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-0 sm:shrink-0 sm:justify-end">
                {etiquetas}
              </div>
            </div>

            <p className="mt-1.5 text-lg font-semibold text-white">{preco}</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="space-y-1.5 text-sm text-slate-700">
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
