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
  // min-w-0 é o que impede um controle de empurrar a coluna em que vive.
  // O w-full dá a largura desejada, não a MÍNIMA: a largura mínima de um
  // <select> é intrínseca — a opção mais comprida —, e num item de grade
  // ou de flex, cujo min-width: auto não deixa encolher abaixo do
  // conteúdo, é essa largura que vence. O Chromium trunca a opção e
  // disfarça; o Firefox obedece e o select sai da tela. "Área externa,
  // chácara ou espaço ao ar livre com cobertura" é a opção que faz isso.
  return `w-full min-w-0 rounded-xl border bg-white py-3 text-slate-900
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

// Campo numérico: por que ele NÃO é um <input type="number">.
//
// O type="number" não guarda o texto que foi digitado. Ele sanitiza o valor e
// descarta o que não formar um número no padrão INGLÊS. A vírgula decimal
// brasileira não forma, então é jogada fora SEM AVISO, e o que sobra são os
// dígitos colados:
//
//     a pessoa digita     o campo guardava   o sistema entendia
//     1,5 horas      ->   "15"          ->   15 horas      (dez vezes mais)
//     R$ 89,90       ->   "8990"        ->   R$ 8.990,00   (cem vezes mais)
//     150,50 de saque->   "15050"       ->   R$ 15.050,00  (cem vezes mais)
//
// Não era erro de validação: o número chegava ao servidor bem formado,
// inteiro e positivo, passando por qualquer conferência. Simplesmente não era
// o número que a pessoa quis dizer. Oito dos onze campos numéricos do sistema
// estavam assim, e os dois piores eram preço base e valor de saque.
//
// O ponto enganava no sentido contrário: "1.000" convidados é mil para quem
// digita e UM para o Number(), que lê o ponto como separador decimal.
//
// A primeira tentativa de correção foi traduzir a vírgula em ponto na tecla,
// mantendo o type="number". NÃO FUNCIONA, e vale registrar por quê: ao digitar
// "1" e depois a vírgula, o valor viraria "1." — que não é um número válido, e
// que o navegador portanto sanitiza para VAZIO. O campo esvaziava no meio da
// digitação e "1,5" acabava virando 5. O type="number" não consegue sustentar
// o estado intermediário de um decimal sendo digitado.
//
// Então o controle passa a ser type="text" com inputMode: o teclado do celular
// continua numérico, o texto digitado é preservado como está, e a filtragem é
// nossa. O que se perde são as setinhas de incremento e a validação nativa de
// min/max/step — esta última nunca era consultada, porque o formulário envia
// por botão e ninguém chamava checkValidity().
//
// Fica aqui, e não em cada tela, pelo mesmo motivo da seta do <select> no
// globals.css: são onze campos, e o próximo que alguém criar nasce certo sem
// precisar lembrar desta armadilha.

// Um campo aceita fração quando tem step fracionário (0.01 em preço, 0.5 em
// duração). Sem step, ou com step inteiro, é campo de contagem.
function aceitaFracao(step) {
  return step !== undefined && Number(step) !== Math.trunc(Number(step));
}

// Mantém só dígitos e separadores, e traduz a vírgula em ponto para que todo
// `Number(campos.x)` espalhado pelas telas continue valendo.
//
// Texto malformado NÃO é consertado por adivinhação: "1.000,00" fica
// "1.000.00" e é recusado pela validação com mensagem clara, em vez de virar
// 1,00 ou 100000 no silêncio. Em campo de contagem o separador é preservado
// pelo mesmo motivo — "7,5" precisa aparecer e receber "informe um número
// inteiro", não virar 75 sem ninguém notar.
function filtrarNumero(texto) {
  return String(texto ?? '').replace(/[^\d.,]/g, '').replace(/,/g, '.');
}

export function entradaNumerica({ type, step, onChange }) {
  if (type !== 'number') return onChange;

  return function aoMudarNumero(evento) {
    const original = evento.target.value;
    const filtrado = filtrarNumero(original);

    // Reescreve só quando algo foi barrado, para não mexer no cursor à toa.
    if (filtrado !== original) {
      const campo = evento.target;
      const posicao = campo.selectionStart;
      const removidos = original.length - filtrado.length;
      campo.value = filtrado;
      // O cursor volta para onde estava, descontando o que saiu antes dele.
      if (posicao !== null) {
        const nova = Math.max(0, posicao - removidos);
        campo.setSelectionRange(nova, nova);
      }
    }

    if (onChange) onChange(evento);
  };
}

// Rótulo em cima, dica e erro embaixo: a moldura é a mesma para os três.
function Moldura({ label, name, dica, mensagem, children }) {
  return (
    // min-w-0 pelo mesmo motivo do controle: esta div é o item da grade, e
    // o min-width: auto dela repassaria para a coluna a largura intrínseca
    // de quem está dentro.
    <div className="min-w-0">
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

  // O filtro do campo numérico entra ANTES da validação, para que `validar`
  // receba o texto já normalizado — senão a tela recusaria "1,5" enquanto o
  // servidor o aceitaria.
  const ehNumero = type === 'number';
  const onChangeFiltrado = entradaNumerica({ type, step: resto.step, onChange });

  const { mensagem, aoSair, aoMudar } = useValidacao({
    erro, validar, onChange: onChangeFiltrado, onBlur,
  });

  const ehSenha = type === 'password';
  const tipoEfetivo = ehSenha && revelada
    ? 'text'
    // O porquê do texto no lugar de "number" está no comentário grande acima.
    : ehNumero ? 'text' : type;

  // `step`, `min` e `max` não valem nada num input de texto, e deixá-los no
  // DOM só enganaria quem fosse ler o HTML. Saem daqui; quem vale são as
  // funções `validar` das telas e a conferência do servidor.
  const { step, min, max, ...semAtributosNativos } = resto;
  const atributosNumero = ehNumero
    ? {
      // Teclado do celular: com fração, o que tem separador; sem, só dígitos.
      inputMode: aceitaFracao(step) ? 'decimal' : 'numeric',
      autoComplete: 'off',
    }
    : null;

  return (
    <Moldura label={label} name={name} dica={dica} mensagem={mensagem}>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={tipoEfetivo}
          onChange={aoMudar}
          onBlur={aoSair}
          {...(ehNumero ? semAtributosNativos : resto)}
          {...atributosNumero}
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
//
// `maximo` é o teto da COLUNA do banco, e aparece só quando a pessoa chega
// perto dele — a 50 caracteres do fim. Antes ele não existia: o texto longo
// era aceito pela tela, recusado pelo banco, e a administração lia um "não
// foi possível registrar a análise" genérico, no topo da página, longe do
// botão que ela acabara de clicar. Colar um parecer de outro documento
// bastava para cair nisso.
export function CampoTexto({
  label, name, erro, dica, validar, onChange, onBlur, minimo, maximo, value, ...resto
}) {
  const { mensagem, aoSair, aoMudar } = useValidacao({ erro, validar, onChange, onBlur });

  const escrito = String(value ?? '').trim().length;
  const faltam = minimo ? minimo - escrito : 0;
  const excedeu = maximo ? escrito - maximo : 0;

  let dicaEfetiva = dica;
  if (faltam > 0) {
    if (escrito === 0) dicaEfetiva = `Mínimo de ${minimo} caracteres.`;
    else if (faltam === 1) dicaEfetiva = 'Falta 1 caractere.';
    else dicaEfetiva = `Faltam ${faltam} caracteres.`;
  } else if (maximo && escrito > maximo - 50) {
    dicaEfetiva = excedeu > 0
      ? `${excedeu} caractere${excedeu === 1 ? '' : 's'} além do limite de ${maximo}.`
      : `${maximo - escrito} caractere${maximo - escrito === 1 ? '' : 's'} até o limite de ${maximo}.`;
  }

  return (
    <Moldura label={label} name={name} dica={dicaEfetiva}
      mensagem={mensagem ?? (excedeu > 0 ? `O texto não pode passar de ${maximo} caracteres.` : null)}>
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={aoMudar}
        onBlur={aoSair}
        {...resto}
        aria-invalid={mensagem || excedeu > 0 ? 'true' : undefined}
        aria-describedby={mensagem || excedeu > 0 ? `${name}-erro` : undefined}
        className={classesControle(mensagem || excedeu > 0, 'resize-y px-4')}
      />
    </Moldura>
  );
}
