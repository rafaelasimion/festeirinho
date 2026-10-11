'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// RF069-B — as fotos que a própria parte enviou com o seu relato, para ela
// rever o que mandou. Só leitura: o envio é único (RN069), então aqui não
// há "anexar" nem "remover" — esse quadro, que antes aceitava as duas
// coisas até a decisão, deixava a prova mudar no meio da análise.
//
// Mesmo componente nas duas pontas: o cliente vê as fotos da contestação,
// o fornecedor as da sua versão. Cada um vê só as suas — quem vê as duas
// pilhas é a administração, que julga (RF070).
//
// É só a fileira de miniaturas, logo abaixo do texto que elas acompanham.
// Sem título nem aviso: quem vê já sabe o que são, porque as escolheu, e o
// aviso de quem vê e por quanto tempo foi lido antes do envio.

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

  if (erro) return <p className="text-xs text-perigo-600">{erro}</p>;

  // Carregando, sem fotos ou já decidida (as fotos foram apagadas junto com
  // a decisão): nada a mostrar. Uma fileira que aparece um instante depois
  // não precisa de "carregando" — o texto acima dela já está na tela.
  if (dados === null || !dados.pendente || dados.fotos.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Fotos enviadas">
      {dados.fotos.map((foto) => (
        <li key={foto.id} className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
          <a href={foto.imagem_url} target="_blank" rel="noreferrer"
            className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-festa-600/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto.imagem_url} alt="Foto enviada — abrir em tamanho real"
              className="h-full w-full object-cover" />
          </a>
        </li>
      ))}
    </ul>
  );
}

// RN063 — o que não é imagem vai pelo suporte, que é externo e aceita vídeo
// e documento por conta própria. O número da solicitação segue junto na
// mensagem, para o atendente abrir o caso certo. Uma linha só, no pé do
// cartão da contestação, nos dois lados e antes e depois do envio — depois
// dele, é o único caminho para uma prova que ficou de fora.
export function LinkProvaPeloSuporte({ idSolicitacao }) {
  return (
    <p className="text-xs text-slate-500">
      Vídeo ou documento?{' '}
      <Link href={`/suporte?assunto=contratacao&origem=solicitacao&solicitacao=${idSolicitacao}`}
        className="font-medium text-festa-700 hover:underline">
        Envie pelo suporte
      </Link>
    </p>
  );
}
