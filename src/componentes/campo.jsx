// Campo de formulário compartilhado.
//
// Antes esta função estava copiada no fim de cinco arquivos. Com ela num
// lugar só, mudar a aparência de todos os formulários do sistema passa a
// ser mudar este arquivo — que é exatamente o que a passada visual exige.

export default function Campo({ label, name, erro, dica, ...resto }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        {...resto}
        aria-invalid={erro ? 'true' : undefined}
        className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-slate-900
          placeholder:text-slate-400
          focus:outline-none focus:ring-2 focus:ring-festa-600/30
          disabled:bg-slate-100 disabled:text-slate-500
          ${erro
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/25'
            : 'border-slate-300 focus:rounded-lg border border-festa-600 text-festa-700 hover:bg-festa-50 px-3 py-1.5 text-sm'}`}
      />
      {dica && <p className="mt-1 text-xs text-slate-500">{dica}</p>}
      {erro && <p className="mt-1 text-sm text-red-600">{erro}</p>}
    </div>
  );
}