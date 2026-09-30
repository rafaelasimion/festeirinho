import { Children } from 'react';
import Link from 'next/link';

// Vocabulário de ações do cartão de solicitação.
//
// Antes cada ação morava num bloco próprio, com divisória em cima: um
// cartão confirmado virava quatro faixas empilhadas e todas as ações
// pesavam igual — "denunciar fornecedor" com o mesmo destaque de "pagar".
// Aqui elas dividem uma linha só, e o tom diz o que cada uma é:
//
//   principal   move a contratação adiante (pagar, aprovar, confirmar).
//               É uma por cartão, no máximo — se houver duas, uma delas
//               não é principal.
//   secundario  usada com frequência, mas não avança nada (conversar).
//   sucesso     dá ganho de causa a quem reclamou (julgar procedente).
//   atencao     abre uma disputa que a administração vai julgar.
//   perigo      desfaz (cancelar, recusar, rejeitar).
//   discreto    consulta, sem consequência (comprovante, denunciar).
//
// A ordem na linha é essa mesma, e vale para todas as telas: quem usa
// mais de uma não precisa reaprender onde ficam as coisas. O painel
// administrativo usa o mesmo vocabulário — decidir ali é o equivalente do
// avançar aqui.

const TONS = {
  principal: 'bg-festa-600 text-white hover:bg-festa-700',
  secundario: 'border border-festa-600 text-festa-700 hover:bg-festa-50',
  sucesso: 'border border-sucesso-600 text-sucesso-700 hover:bg-sucesso-50',
  atencao: 'border border-atencao-600 text-atencao-800 hover:bg-atencao-50',
  perigo: 'border border-perigo-600 text-perigo-700 hover:bg-perigo-50',
  perigoCheio: 'bg-perigo-600 text-white hover:bg-perigo-700',
  discreto: 'text-slate-600 hover:bg-slate-100',
};

export function BarraAcoes({ children }) {
  // Solicitação recusada ou expirada não tem o que fazer, e as ações vêm
  // de condições que ali dão todas falso. Sem esta checagem, sobraria a
  // divisória sozinha no pé do cartão, anunciando uma barra vazia.
  // Children.toArray descarta null, false e undefined.
  if (Children.toArray(children).length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
      {children}
    </div>
  );
}

export function BotaoAcao({
  tom = 'secundario', Icone, href, onClick, disabled, contador, children,
}) {
  // O discreto é menor de propósito: é o que se lê por último.
  const medida = tom === 'discreto'
    ? 'px-2.5 py-1.5 text-sm'
    : 'px-3.5 py-2 text-sm font-medium';

  const classe = `inline-flex items-center gap-1.5 rounded-lg transition-colors
    disabled:cursor-not-allowed disabled:opacity-50 ${medida} ${TONS[tom] ?? TONS.secundario}`;

  const conteudo = (
    <>
      {Icone && <Icone className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {children}
      {/* O contador de não lidas vive dentro do botão, senão vira um
          segundo elemento para o olho procurar. */}
      {contador > 0 && (
        <span className={`rounded-full px-1.5 text-xs font-semibold ${
          tom === 'principal' ? 'bg-white/25 text-white' : 'bg-festa-600 text-white'}`}>
          {contador}
        </span>
      )}
    </>
  );

  if (href) {
    return <Link href={href} className={classe}>{conteudo}</Link>;
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={classe}>
      {conteudo}
    </button>
  );
}

// Link externo (comprovante em PDF) — <a> de verdade, para abrir em outra
// aba, mas com a mesma aparência de ação discreta.
export function LinkAcao({ href, Icone, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm
        transition-colors ${TONS.discreto}`}>
      {Icone && <Icone className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {children}
    </a>
  );
}
