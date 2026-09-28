import { Suspense } from 'react';
import FormularioServico from './formulario';

// Formulário de serviço (UC 008, UC 009).
//
// A LISTA dos serviços não mora mais aqui: ela é a vitrine, que é a mesma
// página que o cliente vê. Ter duas listas era pedir para elas divergirem
// — e obrigava o fornecedor a decidir, toda vez, em qual das duas telas
// ele queria estar. Chega-se aqui pelos botões da vitrine: ?novo=1 para
// cadastrar e ?editar=<id> para alterar.
//
// Esta casca existe por causa do useSearchParams: ler a query string é
// coisa do navegador, então o Next exige que o componente que a lê esteja
// dentro de um <Suspense>. Sem isso a compilação de produção falha.

export default function PaginaServico() {
  return (
    <Suspense fallback={
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <p className="text-sm text-slate-500">Carregando...</p>
      </main>
    }>
      <FormularioServico />
    </Suspense>
  );
}
