import { ExternalLink } from 'lucide-react';

// Atalho da administração para a vitrine de um fornecedor, nas abas
// Denúncias e Contas: o perfil, os serviços e as avaliações ajudam a
// decidir uma denúncia ou um pedido de revisão. Abre em outra aba para não
// perder a decisão em andamento, e a vitrine abre para a administração
// mesmo com o fornecedor fora do ar (suspenso, pausado ou inativo).
export default function LinkVitrine({ idFornecedor, nome }) {
  return (
    <a href={`/fornecedores/${idFornecedor}`} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-festa-700 hover:underline">
      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
      Ver a vitrine de {nome}
      <span className="sr-only"> (abre em outra aba)</span>
    </a>
  );
}
