// Seção do painel financeiro: Saques, Relatório mensal e Movimentações.
//
// Antes as três seções eram um título solto em cima dos cartões, separadas
// só pela margem. O título tinha o mesmo peso do valor dentro do primeiro
// cartão, e o painel lia como uma lista única de caixas, sem dizer onde
// terminava uma seção e começava a outra. Agora cada uma abre com um fio
// que atravessa a coluna, e o título vem com uma frase do que ela mostra.
//
// A ação da seção (o botão de pedir saque) fica na mesma linha do título,
// à direita, e desce para baixo dele quando não cabe.

export default function SecaoFinanceiro({ id, titulo, descricao, acao, children }) {
  return (
    <section aria-labelledby={id} className="mt-10 border-t border-slate-200 pt-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id={id} className="text-lg font-semibold text-slate-900">{titulo}</h2>
          {descricao && <p className="mt-1 text-sm text-slate-600">{descricao}</p>}
        </div>
        {acao && <div className="shrink-0">{acao}</div>}
      </div>
      {children}
    </section>
  );
}
