import { linhasRecebimento } from '@/lib/recebimento';

// Destino do saque ou do reembolso, uma informação por linha (CT-101).
// Usado no painel da administração, na solicitação do cliente e nos saques
// do fornecedor, para os três mostrarem os dados do mesmo jeito.
export default function DestinoRecebimento({ dados, className = '' }) {
  const linhas = linhasRecebimento(dados);
  if (linhas.length === 0) return null;

  return (
    <dl className={`grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm ${className}`}>
      {linhas.map(({ rotulo, valor }) => (
        <div key={rotulo} className="contents">
          <dt className="text-slate-500">{rotulo}</dt>
          <dd className="min-w-0 break-words text-slate-800">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}
