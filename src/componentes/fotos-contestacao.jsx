'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ImagePlus, Trash2, Loader2, Headset } from 'lucide-react';
import { AVISO_FOTOS_CONTESTACAO } from '@/lib/contestacao';

// RF069-B / UC 046 — as fotos que uma parte anexa à contestação pendente.
//
// Mesmo componente nas duas pontas: o cliente mostra o que faltou ou veio
// diferente, o fornecedor mostra o que entregou. Cada um vê só as próprias
// fotos — quem vê as duas pilhas é a administração, que julga (RF070).
//
// O componente carrega a própria lista e conversa direto com a rota, como o
// GerenciarFotos dos serviços: a página só precisa colocá-lo no lugar.

const ORIENTACAO = {
  cliente: 'Mostre o que foi entregue e o que faltou ou veio diferente do contratado.',
  fornecedor: 'Mostre o serviço prestado: a montagem, a estrutura, a decoração no local.',
};

export default function FotosContestacao({ idSolicitacao, papel }) {
  const [dados, setDados] = useState(null);
  // Cada envio ou remoção soma um aqui, e o efeito abaixo recarrega a lista.
  // Recarregar chamando uma função de dentro do efeito também funcionaria,
  // mas é o padrão que a regra react-hooks/set-state-in-effect reprova:
  // aqui o estado só muda dentro do retorno do fetch, como ela pede.
  const [versao, setVersao] = useState(0);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');

  const endereco = `/api/solicitacoes/${idSolicitacao}/fotos-contestacao`;
  const idEntrada = `foto-contestacao-${idSolicitacao}`;

  useEffect(() => {
    // Resposta que chega depois de o componente sair da tela, ou depois de
    // uma recarga mais nova, é descartada.
    let atual = true;
    fetch(endereco)
      .then((resposta) => (resposta.ok ? resposta.json() : Promise.reject()))
      .then((corpo) => { if (atual) setDados(corpo); })
      .catch(() => { if (atual) setErro('Não foi possível carregar as fotos.'); });
    return () => { atual = false; };
  }, [endereco, versao]);

  async function executar(requisicao) {
    setErro('');
    setProcessando(true);
    try {
      const resposta = await requisicao();
      let corpo;
      try {
        corpo = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }
      if (!resposta.ok) {
        setErro(corpo.erro ?? 'Não foi possível concluir a operação.');
      }
      // Recarrega mesmo no erro: um 409 de "não está mais pendente" quer
      // dizer que a administração decidiu enquanto a tela estava aberta, e
      // a lista precisa refletir isso.
      setVersao((anterior) => anterior + 1);
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  function enviar(evento) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;

    // FormData, não JSON: o navegador monta o corpo multipart e define o
    // Content-Type sozinho.
    const formulario = new FormData();
    formulario.append('foto', arquivo);
    executar(() => fetch(endereco, { method: 'POST', body: formulario }));
  }

  function remover(idFoto) {
    executar(() => fetch(`${endereco}?idFoto=${idFoto}`, { method: 'DELETE' }));
  }

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
  // mostrar nem o que oferecer.
  if (!dados.pendente) return null;

  const quantidade = dados.fotos.length;
  const cheio = quantidade >= dados.limite;

  return (
    <div className="space-y-3 rounded-lg border border-atencao-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-slate-800">
          Suas fotos{' '}
          <span className="font-normal text-slate-500">
            ({quantidade} de {dados.limite})
          </span>
        </p>

        <input type="file" id={idEntrada} accept="image/jpeg,image/png,image/webp"
          onChange={enviar} disabled={processando || cheio} className="sr-only" />
        <label htmlFor={idEntrada}
          aria-disabled={processando || cheio}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-atencao-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-atencao-700 ${
            processando || cheio ? 'pointer-events-none opacity-50' : ''}`}>
          {processando
            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
          Anexar foto
        </label>
      </div>

      <p className="text-xs text-slate-600">
        {ORIENTACAO[papel]} JPG, PNG ou WEBP, até 5 MB cada.
      </p>

      {/* RN069 / LGPD — o aviso vem ANTES do envio, como o do chat: quem
          anexa precisa saber quem vai ver e por quanto tempo. E a foto de
          festa infantil quase sempre pega criança; o pedido de enquadrar o
          serviço é o jeito mais simples de guardar menos do que não é
          necessário à análise. */}
      <p className="rounded-md bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
        {AVISO_FOTOS_CONTESTACAO}
      </p>

      {erro && <p className="text-sm text-perigo-600">{erro}</p>}

      {quantidade > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {dados.fotos.map((foto) => (
            <li key={foto.id} className="relative overflow-hidden rounded-lg border border-slate-200">
              <a href={foto.imagem_url} target="_blank" rel="noreferrer"
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-festa-600/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={foto.imagem_url} alt="Foto anexada — abrir em tamanho real"
                  className="aspect-square w-full object-cover" />
              </a>
              <button type="button" onClick={() => remover(foto.id)} disabled={processando}
                aria-label="Remover foto"
                className="absolute right-1 top-1 rounded-md bg-white/90 p-1 text-slate-600 shadow-sm transition-colors hover:bg-perigo-50 hover:text-perigo-700 disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

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
