import { TriangleAlert } from 'lucide-react';

// RN032 / UC 001 (6b) e UC 002 — o mesmo CPF pode ter um cadastro de
// cliente e um de fornecedor. Quando o servidor detecta o outro cadastro,
// ele não recusa nada: avisa e devolve a decisão para a pessoa.
//
// O aviso é laranja, não vermelho. Vermelho no sistema é recusa, e aqui
// nada foi recusado — o cadastro continua de onde parou assim que ela
// escolher. O texto vem do servidor de propósito: é ele que sabe o que
// pode ser dito sem revelar dados do outro cadastro.
//
// Igual nos dois cadastros, por isso mora aqui: o texto do aviso é o mesmo
// e o desenho tem de ser o mesmo.

export default function AvisoCpfOutroPapel({ aviso, aoContinuar, aoRevisar, enviando }) {
  return (
    <div className="rounded-xl border border-atencao-200 bg-atencao-50 p-4">
      <div className="flex gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-atencao-700" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <p className="font-medium text-atencao-800">CPF já usado em outro cadastro</p>
          <p className="mt-1 text-sm text-slate-700">{aviso}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={aoContinuar} disabled={enviando}
              className="rounded-lg bg-festa-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-festa-700 disabled:cursor-not-allowed disabled:opacity-50">
              {enviando ? 'Criando conta...' : 'Continuar mesmo assim'}
            </button>
            <button type="button" onClick={aoRevisar}
              className="rounded-lg border border-festa-600 bg-white px-3 py-2.5 text-sm font-semibold text-festa-700 transition-colors hover:bg-festa-50">
              Revisar o CPF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
