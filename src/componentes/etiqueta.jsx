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
// O preenchido leva uma borda no tom 200 — um degrau acima do fundo, não a
// cor do texto: com a borda forte do contornado, o preenchido ficaria
// pesado demais, com duas cores fortes disputando num selo de 20px. Assim
// ela só fecha o contorno da etiqueta, que era o que faltava.
const TONS = {
  roxo:    { cheio: 'border-festa-200 bg-festa-100 text-festa-700',       contorno: 'border-festa-600 text-festa-700',     ponto: 'bg-festa-600' },
  atencao: { cheio: 'border-atencao-200 bg-atencao-100 text-atencao-800', contorno: 'border-atencao-600 text-atencao-700', ponto: 'bg-atencao-600' },
  sucesso: { cheio: 'border-sucesso-200 bg-sucesso-100 text-sucesso-700', contorno: 'border-sucesso-600 text-sucesso-700', ponto: 'bg-sucesso-600' },
  perigo:  { cheio: 'border-perigo-200 bg-perigo-100 text-perigo-700',    contorno: 'border-perigo-600 text-perigo-700',   ponto: 'bg-perigo-600' },
  neutro:  { cheio: 'border-slate-300 bg-slate-100 text-slate-700',       contorno: 'border-slate-400 text-slate-600',     ponto: 'bg-slate-400' },
};

// O formato "caixa" é para etiquetas que aparecem dentro de um cartão, ao
// lado de outro texto: canto pouco arredondado, porque ali a pílula compete
// com os cantos do próprio cartão, e altura de 20px — a mesma da linha de
// um text-sm, para a etiqueta não ficar mais alta do que o texto que ela
// acompanha. A pílula continua sendo o padrão, para os status que aparecem
// soltos e não têm nada ao lado para desalinhar.
//
// O formato "ponto" é o contornado com um pontinho na frente: fundo branco,
// e borda e texto na mesma cor. É o status no cartão de solicitação, onde a
// etiqueta divide a linha com o nome do serviço — um retângulo preenchido
// ali disputava atenção com ele. O ponto é o que se enxerga de longe; a
// borda e o texto vêm do mesmo tom, então a etiqueta lê como uma peça só.
const FORMATOS = {
  pilula: 'rounded-full px-2 py-1 text-sm',
  // py-px, e não py-0.5: a borda que entrou agora soma 2px na altura, e sem
  // tirar esses 2px do respiro a caixa ficaria mais alta que a linha de
  // text-sm ao lado, que é justamente o que ela veio consertar.
  caixa: 'rounded-md px-1.5 py-px text-xs',
  // O "border" aqui é a LARGURA da borda, e precisa estar nesta string
  // porque o formato ponto tem <span> próprio: o tom só traz a cor
  // (border-atencao-600), e cor sem largura não desenha borda nenhuma.
  ponto: 'rounded-full border bg-white px-2.5 py-1 text-sm',
};

export default function Etiqueta({
  tom = 'neutro', contorno = false, formato = 'pilula', children,
}) {
  const estilo = TONS[tom] ?? TONS.neutro;
  const medida = FORMATOS[formato] ?? FORMATOS.pilula;

  if (formato === 'ponto') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-medium ${medida} ${estilo.contorno}`}>
        {/* Decorativo: o rótulo ao lado já diz o status por escrito, então
            o ponto não precisa ser lido nem entendido por quem não
            distingue as cores. */}
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${estilo.ponto}`} />
        {children}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center border font-medium ${medida}
        ${contorno ? `bg-white ${estilo.contorno}` : estilo.cheio}`}
    >
      {children}
    </span>
  );
}