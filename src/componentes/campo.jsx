'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Campos de formulário compartilhados: Campo (input), CampoSelecao (select)
// e CampoTexto (textarea).
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

// A aparência do controle mora numa função só, e não copiada em cada tela.
// Foi justamente por não existir este lugar que o <select> do cadastro
// acabou com canto menor e borda cinza enquanto o <input> logo acima dele
// estava arredondado e com borda roxa: cada arquivo escrevia a sua própria
// CLASSE_SELECT. Quem mudar a borda aqui muda nos três controles.
function classesControle(comErro, espacamento) {
  return `w-full rounded-xl border bg-white py-3 text-slate-900
    placeholder:text-slate-400
    focus:outline-none focus:ring-2
    disabled:bg-slate-100 disabled:text-slate-500
    ${espacamento}
    ${comErro
      ? 'border-perigo-200 focus:border-perigo-600 focus:ring-perigo-600/20'
      : 'border-festa-200 focus:border-festa-600 focus:ring-festa-600/25'}`;
}

// O estado da validação é igual nos três controles, então vive num gancho
// só em vez de repetido em cada um deles.
function useValidacao({ erro, validar, onChange, onBlur }) {
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

  return { mensagem, aoSair, aoMudar };
}

// Rótulo em cima, dica e erro embaixo: a moldura é a mesma para os três.
function Moldura({ label, name, dica, mensagem, children }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>

      {children}

      {dica && <p className="mt-1 text-xs text-slate-500">{dica}</p>}
      {mensagem && (
        <p id={`${name}-erro`} className="mt-1 text-sm text-perigo-600">{mensagem}</p>
      )}
    </div>
  );
}

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
  const [revelada, setRevelada] = useState(false);
  const { mensagem, aoSair, aoMudar } = useValidacao({ erro, validar, onChange, onBlur });

  const ehSenha = type === 'password';
  const tipoEfetivo = ehSenha && revelada ? 'text' : type;

  return (
    <Moldura label={label} name={name} dica={dica} mensagem={mensagem}>
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
          className={classesControle(mensagem, ehSenha ? 'px-4 pr-12' : 'px-4')}
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
    </Moldura>
  );
}

// O select recebe só pl-4, e nunca px-4: o espaço da direita vem da regra
// de base do globals.css, que reserva 2,5rem para a seta que desenhamos. Um
// px-4 aqui apagaria essa reserva — utilitário vence @layer base — e a
// opção comprida voltaria a passar por baixo da seta.
export function CampoSelecao({
  label, name, erro, dica, validar, onChange, onBlur, children, ...resto
}) {
  const { mensagem, aoSair, aoMudar } = useValidacao({ erro, validar, onChange, onBlur });

  return (
    <Moldura label={label} name={name} dica={dica} mensagem={mensagem}>
      <select
        id={name}
        name={name}
        onChange={aoMudar}
        onBlur={aoSair}
        {...resto}
        aria-invalid={mensagem ? 'true' : undefined}
        aria-describedby={mensagem ? `${name}-erro` : undefined}
        className={classesControle(mensagem, 'pl-4')}
      >
        {children}
      </select>
    </Moldura>
  );
}

// `minimo` troca o contador "0/20" por quanto ainda falta, que é a
// informação que a pessoa procura. Com o campo ainda vazio a frase é a
// exigência ("Mínimo de 20 caracteres"), porque "faltam 20 para o mínimo
// de 20" diz a mesma coisa duas vezes. Passado o mínimo a linha some: daí
// em diante ela não informa mais nada.
export function CampoTexto({
  label, name, erro, dica, validar, onChange, onBlur, minimo, value, ...resto
}) {
  const { mensagem, aoSair, aoMudar } = useValidacao({ erro, validar, onChange, onBlur });

  const escrito = String(value ?? '').trim().length;
  const faltam = minimo ? minimo - escrito : 0;

  let dicaEfetiva = dica;
  if (faltam > 0) {
    if (escrito === 0) dicaEfetiva = `Mínimo de ${minimo} caracteres.`;
    else if (faltam === 1) dicaEfetiva = 'Falta 1 caractere.';
    else dicaEfetiva = `Faltam ${faltam} caracteres.`;
  }

  return (
    <Moldura label={label} name={name} dica={dicaEfetiva} mensagem={mensagem}>
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={aoMudar}
        onBlur={aoSair}
        {...resto}
        aria-invalid={mensagem ? 'true' : undefined}
        aria-describedby={mensagem ? `${name}-erro` : undefined}
        className={classesControle(mensagem, 'resize-y px-4')}
      />
    </Moldura>
  );
}
