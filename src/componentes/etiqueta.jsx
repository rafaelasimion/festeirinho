// Etiqueta de status.
//
// O tom carrega significado, e é o mesmo em todo o sistema:
//   roxo     informação neutra, identidade
//   atencao  espera, análise pendente, algo que ainda pode dar errado
//   sucesso  confirmado, concluído, desfecho positivo
//   perigo   recusado, cancelado, expirado, excluído
//
// Dois formatos: preenchido (padrão) para status de solicitação, e
// contornado para os selos de verificação, que aparecem ao lado de um
// título e pedem menos peso visual.

// Preenchido: fundo claro (tom 100) e texto escuro do MESMO tom (700).
// A versão anterior usava o tom 600 no texto, que é a cor de botão — sobre
// fundo claro ela rendia 3,2:1 no laranja e 3,6:1 no vermelho, abaixo do
// mínimo de 4,5:1 que a RNF013 assume ao citar a WCAG 2.1 AA. O laranja é
// o único que precisa descer até o 800: no 700 ele para em 4,49:1.
const TONS = {
  roxo:    { cheio: 'bg-festa-100 text-festa-700',     contorno: 'border-festa-600 text-festa-700' },
  atencao: { cheio: 'bg-atencao-100 text-atencao-800', contorno: 'border-atencao-600 text-atencao-700' },
  sucesso: { cheio: 'bg-sucesso-100 text-sucesso-700', contorno: 'border-sucesso-600 text-sucesso-700' },
  perigo:  { cheio: 'bg-perigo-100 text-perigo-700',   contorno: 'border-perigo-600 text-perigo-700' },
  neutro:  { cheio: 'bg-slate-100 text-slate-700',     contorno: 'border-slate-400 text-slate-600' },
};

// O formato "caixa" é para etiquetas que aparecem dentro de um cartão, ao
// lado de outro texto: canto pouco arredondado, porque ali a pílula compete
// com os cantos do próprio cartão, e altura de 20px — a mesma da linha de
// um text-sm, para a etiqueta não ficar mais alta do que o texto que ela
// acompanha. A pílula continua sendo o padrão, para os status que aparecem
// soltos e não têm nada ao lado para desalinhar.
const FORMATOS = {
  pilula: 'rounded-full px-2 py-1 text-sm',
  caixa: 'rounded-md px-1.5 py-0.5 text-xs',
};

export default function Etiqueta({
  tom = 'neutro', contorno = false, formato = 'pilula', children,
}) {
  const estilo = TONS[tom] ?? TONS.neutro;
  const medida = FORMATOS[formato] ?? FORMATOS.pilula;

  return (
    <span
      className={`inline-flex items-center font-medium ${medida}
        ${contorno ? `border bg-white ${estilo.contorno}` : estilo.cheio}`}
    >
      {children}
    </span>
  );
}