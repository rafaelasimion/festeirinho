import { Children } from 'react';

// Casca dos itens do painel administrativo.
//
// As sete abas mostram a mesma coisa em roupas diferentes: um item que
// espera decisão, com o que o identifica em cima, os dados no meio e as
// ações no pé. Cada aba desenhava isso do seu jeito, e o resultado era um
// retângulo de borda fina onde tudo tinha o mesmo peso — a lista virava
// uma parede cinza e não dava para dizer, de relance, onde terminava um
// item e começava o outro.
//
// Aqui o cartão tem três zonas com fundos diferentes: a faixa de cima
// identifica, o corpo branco informa, o pé decide. É a mesma ideia do
// cartão de solicitação do cliente, com uma diferença: lá quem dá peso é a
// foto do serviço, que ocupa a lateral inteira; aqui a miniatura é
// pequena, porque a análise é sobre o texto, então o peso vem da faixa.
//
// A faixa é cinza-claro, e não colorida. Sobre fundo colorido, a etiqueta
// de status se dissolve ou fica encardida — foi o que custou quatro
// tentativas no cartão do cliente. Sobre o cinza, a etiqueta de ponto, que
// tem fundo branco próprio, se destaca sozinha.

export default function CartaoAdmin({
  como: Tag = 'li', miniatura, titulo, subtitulo, etiqueta, rodape, children,
}) {
  return (
    <Tag className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {miniatura}

          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-slate-900">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-sm text-slate-600">{subtitulo}</p>}
          </div>

          {/* Do sm para cima a etiqueta divide a linha com o título e não
              encolhe: é a primeira coisa que se procura ao varrer a lista.
              No celular ela desce, senão "pendente de análise" come metade
              da largura e um título de duas palavras quebra em duas linhas. */}
          {etiqueta && <div className="hidden shrink-0 sm:block">{etiqueta}</div>}
        </div>

        {etiqueta && (
          <div className="mt-3 flex flex-wrap gap-1.5 sm:hidden">{etiqueta}</div>
        )}
      </div>

      {/* O espaçamento entre grade, blocos e painéis mora aqui, e não na
          margem de cada peça: com margem própria, o primeiro bloco do
          corpo vinha empurrado e cada tela precisava anular isso na mão. */}
      <div className="space-y-4 p-4 sm:p-5">{children}</div>

      {rodape && (
        <div className="border-t border-slate-200 bg-slate-50 p-4 sm:p-5">{rodape}</div>
      )}
    </Tag>
  );
}

// Os dados curtos em grade, com o rótulo em caixa alta pequena ACIMA do
// valor, e não em "Rótulo: valor" numa linha corrida. Corrido, rótulo e
// valor têm quase o mesmo peso e o olho não acha onde um dado acaba e o
// outro começa — era exatamente o que deixava a aba de serviços difícil de
// varrer. Em grade, os rótulos formam uma coluna que se lê de cima a baixo
// e os valores, outra.
// `colunas` existe porque três dados curtos numa grade de duas colunas
// deixam o terceiro sozinho na fileira de baixo, e a falta de simetria
// chama mais atenção que os dados. No celular é sempre uma coluna.
export function Fatos({ colunas = 2, children }) {
  const grade = colunas === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  return (
    <dl className={`grid gap-x-6 gap-y-3.5 ${grade}`}>{children}</dl>
  );
}

export function Fato({ rotulo, largo = false, children }) {
  return (
    <div className={largo ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {rotulo}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

// Texto longo — descrição do serviço, justificativa, motivo de denúncia —
// ganha um painel próprio. Solto entre os dados curtos ele os engolia: a
// descrição de um serviço tem cinco linhas e os outros campos, meia cada.
// O painel diz "isto aqui é um bloco de texto" antes de a pessoa começar
// a ler.
export function Bloco({ rotulo, tom = 'neutro', children }) {
  const TONS = {
    neutro: 'border-slate-200 bg-slate-50',
    atencao: 'border-atencao-200 bg-atencao-50',
    perigo: 'border-perigo-200 bg-perigo-50',
    festa: 'border-festa-100 bg-festa-50',
  };

  return (
    <div className={`rounded-xl border p-3.5 ${TONS[tom] ?? TONS.neutro}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {rotulo}
      </p>
      <div className="mt-1 whitespace-pre-line text-sm text-slate-700">{children}</div>
    </div>
  );
}

// Nota no topo de uma aba: a regra que rege aquela análise, ou a contagem
// do que está pendente. Cada aba escrevia a sua com uma classe diferente.
export function NotaAba({ tom = 'neutro', Icone, children }) {
  const TONS = {
    neutro: 'border-slate-200 bg-slate-50 text-slate-600',
    atencao: 'border-atencao-200 bg-atencao-50 text-atencao-800',
    festa: 'border-festa-100 bg-festa-50 text-slate-700',
  };

  return (
    <p className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-sm ${
      TONS[tom] ?? TONS.neutro}`}>
      {Icone && <Icone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </p>
  );
}

// Lista vazia com moldura tracejada, e não uma frase solta no branco: sem
// ela a aba vazia parecia uma tela que não terminou de carregar.
export function ListaVazia({ children }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

// A linha de ações do pé. Some quando não há nenhuma, para o cartão não
// terminar numa faixa cinza vazia.
export function AcoesAdmin({ children }) {
  if (Children.toArray(children).length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  );
}

// Situação escrita à esquerda e a ação à direita: é o pé de um item já
// decidido, onde o que importa é o desfecho, e a ação ("Alterar decisão")
// é a exceção.
export function PeDecidido({ children, acao }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-600">{children}</p>
      {acao}
    </div>
  );
}
