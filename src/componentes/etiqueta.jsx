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

const TONS = {
  roxo:    { cheio: 'bg-festa-200 text-festa-600',     contorno: 'border-festa-600 text-festa-700' },
  atencao: { cheio: 'bg-atencao-100 text-atencao-600', contorno: 'border-atencao-600 text-atencao-700' },
  sucesso: { cheio: 'bg-sucesso-100 text-sucesso-600', contorno: 'border-sucesso-600 text-sucesso-700' },
  perigo:  { cheio: 'bg-perigo-100 text-perigo-600',   contorno: 'border-perigo-600 text-perigo-700' },
  neutro:  { cheio: 'bg-slate-100 text-slate-700',     contorno: 'border-slate-400 text-slate-600' },
};

export default function Etiqueta({ tom = 'neutro', contorno = false, children }) {
  const estilo = TONS[tom] ?? TONS.neutro;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-sm font-medium
        ${contorno ? `border bg-white ${estilo.contorno}` : estilo.cheio}`}
    >
      {children}
    </span>
  );
}