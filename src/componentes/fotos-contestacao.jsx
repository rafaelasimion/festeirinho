'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Headset } from 'lucide-react';

// RF069-B — as fotos que a própria parte enviou com o seu relato, para ela
// rever o que mandou. Só leitura: o envio é único (RN069), então aqui não
// há "anexar" nem "remover" — esse quadro, que antes aceitava as duas
// coisas até a decisão, deixava a prova mudar no meio da análise.
//
// Mesmo componente nas duas pontas: o cliente vê as fotos da contestação,
// o fornecedor as da sua versão. Cada um vê só as suas — quem vê as duas
// pilhas é a administração, que julga (RF070).

export default function FotosContestacao({ idSolicitacao }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  const endereco = `/api/solicitacoes/${idSolicitacao}/fotos-contestacao`;

  useEffect(() => {
    // Resposta que chega depois de o componente sair da tela é descartada.
    // O estado só muda dentro do retorno do fetch, como pede a regra
    // react-hooks/set-state-in-effect.
    let atual = true;
    fetch(endereco)
      .then((resposta) => (resposta.ok ? resposta.json() : Promise.reject()))
      .then((corpo) => { if (atual) setDados(corpo); })
      .catch(() => { if (atual) setErro('Não foi possível carregar as fotos.'); });
    return () => { atual = false; };
  }, [endereco]);

  if (dados === null) {
    return erro ? (
      <p className="text-sm text-perigo-600">{erro}</p>
    ) : (
      <p className="flex items-center gap-2 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Carregando fotos...
      </p>
    );
  }

  // Decidida a contestação, as fotos já foram apagadas: não há o que
  // mostrar.
  if (!dados.pendente) return null;

  return (
    <div className="space-y-2">
      <p className="font-medium text-slate-800">
        Suas fotos{' '}
        <span className="font-normal text-slate-500">({dados.fotos.length})</span>
      </p>

      {dados.fotos.length === 0 ? (
        <p className="text-slate-500">Você não anexou fotos.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {dados.fotos.map((foto) => (
            <li key={foto.id} className="overflow-hidden rounded-lg border border-slate-200">
              <a href={foto.imagem_url} target="_blank" rel="noreferrer"
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-festa-600/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={foto.imagem_url} alt="Foto enviada — abrir em tamanho real"
                  className="aspect-square w-full object-cover" />
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-500">
        Só a administração vê estas fotos, e elas são apagadas quando a contestação
        for decidida.
      </p>

      {/* RN063 — o que não é imagem vai pelo suporte, que é externo e aceita
          vídeo e documento por conta própria. O número da solicitação segue
          junto na mensagem, para o atendente abrir o caso certo. */}
      <Link href={`/suporte?assunto=contratacao&origem=solicitacao&solicitacao=${idSolicitacao}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-festa-700 hover:underline">
        <Headset className="h-3.5 w-3.5" aria-hidden="true" />
        Vídeo ou documento? Envie pelo suporte
      </Link>
    </div>
  );
}
