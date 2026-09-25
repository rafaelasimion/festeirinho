'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Loader2, MessageCircle, X } from 'lucide-react';

// UC 016 — canal de mensagens da solicitação.
//
// As mensagens novas chegam por consulta periódica a cada cinco segundos,
// e não por conexão permanente (WebSocket). Para um chat operacional de
// poucas mensagens por contratação, a diferença é imperceptível para quem
// usa, e evita uma peça de infraestrutura inteira. A consulta só roda
// enquanto a conversa está aberta na tela.

const INTERVALO_MS = 5000;

function apenasData(valor) {
  return new Date(valor).toLocaleDateString('pt-BR');
}

// Separador de dia, como em qualquer aplicativo de mensagens: "Hoje" e
// "Ontem" poupam quem lê de calcular a data de cabeça.
function rotuloDoDia(valor) {
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);

  const data = apenasData(valor);
  if (data === apenasData(hoje)) return 'Hoje';
  if (data === apenasData(ontem)) return 'Ontem';
  return new Date(valor).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function horario(valor) {
  return new Date(valor).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function Chat({ idSolicitacao, titulo, aoFechar, aoAlterar }) {
  const [dados, setDados] = useState(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const fim = useRef(null);
  const quantidadeAnterior = useRef(0);

  const endereco = `/api/solicitacoes/${idSolicitacao}/mensagens`;

  const carregar = useCallback(async () => {
    try {
      const resposta = await fetch(endereco);
      if (!resposta.ok) {
        setErro('Não foi possível carregar a conversa.');
        return;
      }
      setDados(await resposta.json());
    } catch {
      setErro('Falha de conexão ao carregar a conversa.');
    }
  }, [endereco]);

  useEffect(() => {
    carregar();
    const relogio = setInterval(carregar, INTERVALO_MS);
    // Sem esta limpeza, a consulta continuaria rodando depois de a conversa
    // sair da tela — e uma nova começaria a cada vez que ela reabrisse.
    return () => clearInterval(relogio);
  }, [carregar]);

  // Rola até o fim quando chega mensagem nova, não a cada consulta: rolar
  // sempre atrapalharia quem estivesse lendo o histórico.
  useEffect(() => {
    const quantidade = dados?.mensagens.length ?? 0;
    if (quantidade > quantidadeAnterior.current) {
      fim.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      quantidadeAnterior.current = quantidade;
      aoAlterar?.();
    }
  }, [dados, aoAlterar]);

  async function enviar() {
    const conteudo = texto.trim();
    if (conteudo === '') return;

    setErro('');
    setEnviando(true);
    try {
      const resposta = await fetch(endereco, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conteudo }),
      });

      let retorno;
      try {
        retorno = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }
      if (!resposta.ok) {
        setErro(retorno.erro ?? 'Não foi possível enviar a mensagem.');
        return;
      }

      setTexto('');
      await carregar();
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-festa-100">
            <MessageCircle className="h-4 w-4 text-festa-600" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{titulo ?? 'Conversa'}</p>
            <p className="text-xs text-slate-500">
              {dados === null
                ? 'Carregando...'
                : dados.aberto
                  ? 'Alinhamento da execução'
                  : 'Canal encerrado'}
            </p>
          </div>
        </div>

        {aoFechar && (
          <button type="button" onClick={aoFechar} aria-label="Fechar conversa"
            className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </header>

      <p className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
        Combine aqui a execução — horário de chegada, montagem, acesso ao local.
        Valores e condições da contratação não mudam por este canal.
      </p>

      {/* Altura fixa: a conversa tem o mesmo tamanho com uma ou com trinta
          mensagens, e não faz o card pular de tamanho a cada envio. */}
      <div className="h-72 overflow-y-auto bg-festa-50/50 px-4 py-3">
        {dados === null ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Carregando conversa...
          </p>
        ) : dados.mensagens.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Nenhuma mensagem ainda. Escreva a primeira abaixo.
          </p>
        ) : (
          <ul className="space-y-2">
            {dados.mensagens.map((mensagem, posicao) => {
              const minha = mensagem.id_usuario === dados.idUsuarioAtual;
              const anterior = dados.mensagens[posicao - 1];
              const mudouODia = !anterior
                || apenasData(anterior.data_hora) !== apenasData(mensagem.data_hora);

              return (
                <li key={mensagem.id}>
                  {mudouODia && (
                    <p className="my-3 text-center">
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">
                        {rotuloDoDia(mensagem.data_hora)}
                      </span>
                    </p>
                  )}
                  <div className={minha ? 'flex justify-end' : 'flex justify-start'}>
                    <div className={`max-w-[75%] px-3.5 py-2 shadow-sm ${
                      minha
                        ? 'rounded-2xl rounded-br-md bg-festa-600 text-white'
                        : 'rounded-2xl rounded-bl-md border border-slate-200 bg-white text-slate-800'}`}>
                      <p className="whitespace-pre-line text-sm">{mensagem.conteudo}</p>
                      <p className={`mt-1 text-right text-[11px] ${
                        minha ? 'text-white/70' : 'text-slate-400'}`}>
                        {horario(mensagem.data_hora)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
            <li ref={fim} />
          </ul>
        )}
      </div>

      <div className="border-t border-slate-200 p-3">
        {erro && <p className="mb-2 text-sm text-red-600">{erro}</p>}

        {dados?.aberto === false ? (
          <p className="text-center text-sm text-slate-600">
            Canal encerrado. Ele fica disponível da aprovação da solicitação até o
            registro da conclusão do serviço.
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <label htmlFor={`mensagem-${idSolicitacao}`} className="sr-only">
              Escreva sua mensagem
            </label>
            <textarea id={`mensagem-${idSolicitacao}`} rows={1} value={texto}
              disabled={dados === null}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                // Enter envia; Shift+Enter quebra linha, como em qualquer chat.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              placeholder="Escreva uma mensagem"
              className="max-h-28 flex-1 resize-none rounded-full border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30 disabled:opacity-50" />
            <button type="button" onClick={enviar} disabled={enviando || texto.trim() === ''}
              aria-label="Enviar mensagem"
              className="shrink-0 rounded-full bg-festa-600 p-2.5 text-white transition-colors hover:bg-festa-700 disabled:opacity-40">
              {enviando
                ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                : <Send className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
