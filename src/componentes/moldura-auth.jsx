// Moldura das telas de autenticação.
//
// Sem cartão e sem fundo decorativo: a página é branca e o conteúdo
// respira sozinho. O que sobra — e é o que importa — é a largura máxima.
// É ela que resolve o desktop: o conteúdo cresce até um teto e para. Um
// formulário de login esticado em 1920px não fica melhor, fica pior, e os
// olhos percorrem uma linha longa para ler um campo curto.
//
// Como as quatro telas de autenticação passam por aqui, mudar a medida
// neste arquivo muda nas quatro.

export default function MolduraAuth({ largura = 'max-w-md', children }) {
  return (
    <main className={`mx-auto w-full ${largura} px-4 py-10 sm:px-6 sm:py-14`}>
      {children}
    </main>
  );
}
