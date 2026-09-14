// Botão compartilhado, em três variantes.
//
//   principal   ação da tela (Criar conta, Salvar, Pagar)
//   secundario  ação de apoio (Cancelar, Voltar, Recusar)
//   discreto    ação de baixo destaque, dentro de listas
//
// Aceita qualquer propriedade de <button>: onClick, disabled, type.

const VARIANTES = {
  principal:
    'bg-festa-600 text-white hover:bg-festa-700 focus-visible:ring-festa-600/40',
  secundario:
    'border border-festa-600 bg-white text-festa-700 hover:bg-festa-50 focus-visible:ring-festa-600/40',
  discreto:
    'text-festa-700 hover:bg-festa-50 focus-visible:ring-festa-600/30',
};

export default function Botao({
  variante = 'principal',
  larguraTotal = false,
  children,
  ...resto
}) {
  return (
    <button
      type="button"
      {...resto}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5
        text-sm font-medium transition-colors
        focus-visible:outline-none focus-visible:ring-2
        disabled:cursor-not-allowed disabled:opacity-50
        ${VARIANTES[variante]}
        ${larguraTotal ? 'w-full' : ''}`}
    >
      {children}
    </button>
  );
}