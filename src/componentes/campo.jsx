'use client';

import { useState } from 'react';

// Campo de formulário compartilhado.
//
// A propriedade `validar` é opcional: recebe o valor digitado e devolve uma
// mensagem de erro, ou null se estiver tudo certo.
//
// A validação roda ao SAIR do campo, não a cada tecla — quem está digitando
// um CPF não deve levar "CPF inválido" no primeiro dígito. Depois que o
// campo já errou uma vez, ele passa a revalidar durante a digitação, para
// que a mensagem desapareça assim que a correção ficar pronta.
//
// Isto é conveniência, não segurança: o servidor valida tudo de novo,
// sempre. Aqui o objetivo é só poupar o envio.

export default function Campo({
  label,
  name,
  erro,
  dica,
  validar,
  onChange,
  onBlur,
  ...resto
}) {
  const [erroLocal, setErroLocal] = useState(null);
  const [tocado, setTocado] = useState(false);

  // O erro vindo do servidor tem prioridade sobre o local.
  const mensagem = erro ?? (tocado ? erroLocal : null);

  function aoSair(evento) {
    setTocado(true);
    if (validar) setErroLocal(validar(evento.target.value));
    if (onBlur) onBlur(evento);
  }

  function aoMudar(evento) {
    if (onChange) onChange(evento);
    if (tocado && validar) setErroLocal(validar(evento.target.value));
  }

  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        onChange={aoMudar}
        onBlur={aoSair}
        {...resto}
        aria-invalid={mensagem ? 'true' : undefined}
        aria-describedby={mensagem ? `${name}-erro` : undefined}
        className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-slate-900
          placeholder:text-slate-400
          focus:outline-none focus:ring-2 focus:ring-festa-600/30
          disabled:bg-slate-100 disabled:text-slate-500
          ${mensagem
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/25'
            : 'border-slate-300 focus:border-festa-600'}`}
      />
      {dica && <p className="mt-1 text-xs text-slate-500">{dica}</p>}
      {mensagem && (
        <p id={`${name}-erro`} className="mt-1 text-sm text-red-600">{mensagem}</p>
      )}
    </div>
  );
}