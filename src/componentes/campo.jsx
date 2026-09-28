'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

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
//
// Campos de senha ganham sozinhos o botão de revelar. Está aqui, e não em
// cada tela, para que login, cadastro e alteração de senha se comportem
// igual sem ninguém precisar lembrar de repetir o botão.

export default function Campo({
  label,
  name,
  erro,
  dica,
  validar,
  onChange,
  onBlur,
  type = 'text',
  ...resto
}) {
  const [erroLocal, setErroLocal] = useState(null);
  const [tocado, setTocado] = useState(false);
  const [revelada, setRevelada] = useState(false);

  // O erro vindo do servidor tem prioridade sobre o local.
  const mensagem = erro ?? (tocado ? erroLocal : null);

  const ehSenha = type === 'password';
  const tipoEfetivo = ehSenha && revelada ? 'text' : type;

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

      <div className="relative">
        <input
          id={name}
          name={name}
          type={tipoEfetivo}
          onChange={aoMudar}
          onBlur={aoSair}
          {...resto}
          aria-invalid={mensagem ? 'true' : undefined}
          aria-describedby={mensagem ? `${name}-erro` : undefined}
          className={`w-full rounded-xl border bg-white px-4 py-3 text-slate-900
            placeholder:text-slate-400
            focus:outline-none focus:ring-2
            disabled:bg-slate-100 disabled:text-slate-500
            ${ehSenha ? 'pr-12' : ''}
            ${mensagem
              ? 'border-perigo-200 focus:border-perigo-600 focus:ring-perigo-600/20'
              : 'border-festa-200 focus:border-festa-600 focus:ring-festa-600/25'}`}
        />

        {ehSenha && (
          // 44px de alvo de toque: o mínimo confortável no celular.
          <button type="button" onClick={() => setRevelada((atual) => !atual)}
            aria-label={revelada ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={revelada}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-400 transition-colors hover:text-festa-700 focus-visible:text-festa-700 focus-visible:outline-none">
            {revelada
              ? <EyeOff className="h-5 w-5" aria-hidden="true" />
              : <Eye className="h-5 w-5" aria-hidden="true" />}
          </button>
        )}
      </div>

      {dica && <p className="mt-1 text-xs text-slate-500">{dica}</p>}
      {mensagem && (
        <p id={`${name}-erro`} className="mt-1 text-sm text-perigo-600">{mensagem}</p>
      )}
    </div>
  );
}
