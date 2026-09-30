// Seção de um formulário longo.
//
// O cadastro de fornecedor tem dezoito campos. Numa lista corrida eles
// viram uma parede: ninguém sabe quanto falta nem por que a razão social
// está entre o telefone e o Instagram. Em seções numeradas, cada cartão
// responde uma pergunta só — quem você é, o que você faz, onde atende,
// como entra.
//
// É <fieldset>/<legend> de verdade, não um <p> em negrito: assim o leitor
// de tela anuncia "Seu negócio" ao entrar em qualquer campo do grupo, o
// que num formulário deste tamanho é a diferença entre saber e não saber
// onde se está (RNF013).
//
// A borda fica no <div> de fora, e não no <fieldset>: o navegador abre um
// vão na borda de cima do fieldset para encaixar a legenda, e o cartão
// apareceria com a moldura partida em dois.

export default function SecaoFormulario({ numero, titulo, descricao, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      {/* min-w-0 no fieldset: por padrão ele tem largura mínima igual ao
          conteúdo, o que impede as grades internas de encolher no celular
          e faz a tela rolar de lado. */}
      <fieldset className="min-w-0">
        <legend className="mb-5">
          <span className="flex items-center gap-3">
            <span aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-festa-100 text-sm font-semibold text-festa-700">
              {numero}
            </span>
            <span className="block">
              <span className="block font-semibold text-slate-900">{titulo}</span>
              {descricao && (
                <span className="block text-sm text-slate-600">{descricao}</span>
              )}
            </span>
          </span>
        </legend>

        <div className="space-y-5">{children}</div>
      </fieldset>
    </div>
  );
}
