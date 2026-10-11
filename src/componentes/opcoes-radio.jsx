// Lista de escolha única com rótulo e explicação em cada opção — o motivo
// da contestação, o da denúncia, a visibilidade da avaliação.
//
// Cada opção tem uma borda leve, que delimita onde ela começa e termina e
// mostra que a linha inteira é clicável, e não só a bolinha. A escolhida
// ganha a borda e o fundo na cor do tom do formulário. As três listas eram
// escritas à mão, cada uma com as suas classes, e já tinham começado a
// divergir.
//
// As classes ficam escritas por inteiro, e não montadas com o nome do tom:
// o Tailwind só gera as classes que encontra escritas no código.

const TONS = {
  festa: { escolhida: 'border-festa-600 bg-festa-50', radio: 'accent-festa-600' },
  atencao: { escolhida: 'border-atencao-600 bg-atencao-50', radio: 'accent-atencao-600' },
  perigo: { escolhida: 'border-perigo-600 bg-perigo-50', radio: 'accent-perigo-600' },
};

export default function OpcoesRadio({
  nome, legenda, opcoes, valor, aoEscolher, tom = 'festa', desabilitado = false, children,
}) {
  const { escolhida, radio } = TONS[tom] ?? TONS.festa;

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-slate-700">{legenda}</legend>
      <div className="space-y-2">
        {opcoes.map((opcao) => (
          <label key={opcao.valor}
            className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
              valor === opcao.valor
                ? escolhida
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
            <input type="radio" name={nome} value={opcao.valor}
              checked={valor === opcao.valor}
              onChange={() => aoEscolher(opcao.valor)}
              disabled={desabilitado}
              className={`mt-1 ${radio}`} />
            <span>
              <span className="block text-sm font-medium text-slate-800">{opcao.rotulo}</span>
              {opcao.detalhe && (
                <span className="block text-xs text-slate-500">{opcao.detalhe}</span>
              )}
            </span>
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}
