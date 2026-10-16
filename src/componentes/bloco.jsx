// Texto longo ou assunto à parte dentro de um cartão — descrição,
// justificativa, motivo de denúncia, o cancelamento de uma solicitação —
// ganha um bloco próprio. Solto entre os dados curtos ele os engolia: a
// descrição de um serviço tem cinco linhas e os outros campos, meia cada.
//
// O bloco é marcado por um fio à esquerda, e não por uma caixa. Com caixa
// (borda e fundo), um cartão de contestação virava uma pilha de quatro ou
// cinco caixas dentro do cartão, e o que separava os assuntos era o
// contorno de cada uma, não o conteúdo. O fio diz "isto é um texto à parte"
// sem fechar o texto num quadro, e a cor dele carrega o tom: o motivo de
// uma denúncia ou de uma contestação em destaque, o resto em cinza.
//
// Nasceu no painel administrativo (cartao-admin.jsx) e veio para cá quando
// as telas de solicitação do cliente e do fornecedor passaram a usá-lo
// também, no lugar das caixas cinza dentro do cartão.
//
// FIO_BLOCO é o mesmo fio para quem monta o próprio conteúdo, como a
// conversa recolhível da contestação e a conferência do financeiro.
export const FIO_BLOCO = {
  neutro: 'border-slate-200',
  atencao: 'border-atencao-600',
  perigo: 'border-perigo-600',
  sucesso: 'border-sucesso-600',
  festa: 'border-festa-300',
};

export function Bloco({ rotulo, tom = 'neutro', className = '', children }) {
  return (
    <div className={`border-l-2 pl-3.5 ${FIO_BLOCO[tom] ?? FIO_BLOCO.neutro} ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {rotulo}
      </p>
      <div className="mt-1 whitespace-pre-line text-sm text-slate-700">{children}</div>
    </div>
  );
}
