'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LifeBuoy, Mail, MessageCircle, ArrowLeft } from 'lucide-react';
import {
  ASSUNTOS,
  montarMensagem,
  montarAssuntoEmail,
  enderecoEmail,
  enderecoWhatsapp,
} from '@/lib/suporte';

export default function FormularioSuporte({
  usuario, contexto, canais, assuntoInicial,
}) {
  const [assunto, setAssunto] = useState(assuntoInicial ?? '');
  const [relato, setRelato] = useState('');

  // UC 039, passo 5 — a mensagem inicial. Ela é recalculada a cada
  // tecla, e é a MESMA para os dois canais: muda só o endereço que a
  // carrega. Por isso o texto mora no módulo puro, não aqui.
  const mensagem = montarMensagem({ assunto, relato, usuario, contexto });

  const linkWhatsapp = assunto === '' ? null : enderecoWhatsapp({
    numero: canais.whatsapp,
    corpo: mensagem,
  });

  const linkEmail = assunto === '' ? null : enderecoEmail({
    email: canais.email,
    assunto: montarAssuntoEmail({ assunto, contexto }),
    corpo: mensagem,
  });

  const semCanal = !canais.email && !canais.whatsapp;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-festa-50">
          <LifeBuoy className="h-5 w-5 text-festa-700" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Falar com o suporte</h1>
          <p className="text-sm text-slate-600">
            O atendimento acontece por WhatsApp ou e-mail. Escolha o assunto e a
            mensagem já vai preenchida.
          </p>
        </div>
      </div>

      {/* UC 039, passo 2 — contexto identificado. Quando não há, a tela
          simplesmente não mostra este bloco (fluxo alternativo 2a). */}
      {contexto && (
        <div className="mb-6 rounded-xl border border-festa-200 bg-festa-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-festa-700">
            Sobre esta contratação
          </p>
          <p className="mt-1 text-sm text-slate-800">
            Solicitação nº {contexto.idSolicitacao} — {contexto.servico}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            O número segue junto na mensagem, então o atendente já abre o caso certo.
          </p>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-slate-700">
          Qual é o assunto?
        </legend>

        {ASSUNTOS.map(({ valor, rotulo, detalhe }) => (
          <label key={valor}
            className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors ${
              assunto === valor
                ? 'border-festa-600 bg-festa-50'
                : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <input type="radio" name="assunto" value={valor}
              checked={assunto === valor}
              onChange={(evento) => setAssunto(evento.target.value)}
              className="mt-0.5 accent-festa-600" />
            <span>
              <span className="block text-sm font-medium text-slate-800">{rotulo}</span>
              <span className="block text-xs text-slate-500">{detalhe}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="mt-6">
        <label htmlFor="relato" className="mb-1.5 block text-sm font-medium text-slate-700">
          Conte o que aconteceu <span className="font-normal text-slate-500">(opcional)</span>
        </label>
        <textarea id="relato" rows={4} value={relato}
          onChange={(evento) => setRelato(evento.target.value)}
          placeholder="Você pode escrever aqui ou direto na conversa, como preferir."
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
      </div>

      {/* Mostrar a mensagem antes de abrir o canal evita a surpresa de
          ver dados próprios saindo para um aplicativo de fora. */}
      {assunto !== '' && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Mensagem que será enviada
          </p>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{mensagem}</p>
        </div>
      )}

      {/* UC 039, passos 3 e 4 — as opções de canal. O botão do WhatsApp
          só aparece quando há um número configurado; o do e-mail, quando
          há endereço. RN064: o menu de triagem que atende do outro lado
          é configurado na própria ferramenta de WhatsApp, fora daqui. */}
      <div className="mt-6 flex flex-wrap gap-3">
        {canais.whatsapp && (
          <a href={linkWhatsapp ?? undefined}
            target="_blank" rel="noopener noreferrer"
            aria-disabled={linkWhatsapp === null}
            onClick={(evento) => { if (linkWhatsapp === null) evento.preventDefault(); }}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors ${
              linkWhatsapp === null
                ? 'pointer-events-none bg-slate-300'
                : 'bg-sucesso-700 hover:bg-sucesso-800'}`}>
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Abrir no WhatsApp
          </a>
        )}

        {canais.email && (
          <a href={linkEmail ?? undefined}
            aria-disabled={linkEmail === null}
            onClick={(evento) => { if (linkEmail === null) evento.preventDefault(); }}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              linkEmail === null
                ? 'pointer-events-none border border-slate-200 bg-white text-slate-300'
                : 'border border-festa-600 bg-white text-festa-700 hover:bg-festa-50'}`}>
            <Mail className="h-4 w-4" aria-hidden="true" />
            Enviar por e-mail
          </a>
        )}
      </div>

      {assunto === '' && !semCanal && (
        <p className="mt-3 text-sm text-slate-500">Escolha um assunto para continuar.</p>
      )}

      {semCanal && (
        <p className="mt-3 text-sm text-atencao-700">
          Nenhum canal de atendimento está configurado no momento.
        </p>
      )}

      {canais.email && (
        <p className="mt-6 text-xs text-slate-500">
          O botão de e-mail abre o seu programa de e-mail com a mensagem pronta.
          Se preferir, escreva direto para {canais.email}.
        </p>
      )}

      <Link href="/"
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar
      </Link>
    </main>
  );
}
