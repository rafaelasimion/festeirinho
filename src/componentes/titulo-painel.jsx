// O título dos formulários que abrem abaixo do resumo da solicitação —
// contestar, cancelar, denunciar, recusar, avaliar.
//
// Antes cada formulário tinha a própria caixa colorida dentro do cartão do
// painel, e era a cor da caixa que dizia o assunto: um cartão dentro do
// outro, com um terceiro nível (os motivos, a conta do cancelamento) dentro
// dela. Agora o formulário fica direto no cartão, e quem diz o assunto é
// este título, com o ícone na cor do tom.
//
// O texto de apoio é opcional e curto: uma frase do que acontece ao enviar.

const COR_ICONE = {
  festa: 'text-festa-600',
  atencao: 'text-atencao-600',
  perigo: 'text-perigo-600',
};

export default function TituloPainel({ icone: Icone, tom = 'festa', titulo, children }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 font-semibold text-slate-900">
        {Icone && (
          <Icone className={`h-4 w-4 shrink-0 ${COR_ICONE[tom] ?? COR_ICONE.festa}`}
            aria-hidden="true" />
        )}
        {titulo}
      </h2>
      {children && <p className="mt-1 text-sm text-slate-600">{children}</p>}
    </div>
  );
}
