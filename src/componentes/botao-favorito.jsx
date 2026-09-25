'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';

// RF015 / RF016 — botão de favoritar.
//
// O coração muda de estado ANTES da resposta do servidor. Numa ação
// pequena e reversível como esta, esperar meio segundo por cada clique
// deixa a interface travada; se der erro, o estado volta e a mensagem
// aparece.

export default function BotaoFavorito({ tipo, id, favorito: inicial, rotulo }) {
  const router = useRouter();
  const [favorito, setFavorito] = useState(Boolean(inicial));
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');

  async function alternar() {
    const desejado = !favorito;
    setFavorito(desejado);
    setErro('');
    setProcessando(true);

    try {
      const resposta = desejado
        ? await fetch('/api/favoritos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo, id }),
          })
        : await fetch(`/api/favoritos?tipo=${tipo}&id=${id}`, { method: 'DELETE' });

      if (!resposta.ok) {
        setFavorito(!desejado); // desfaz
        const dados = await resposta.json().catch(() => ({}));
        setErro(dados.erro ?? 'Não foi possível salvar.');
        return;
      }

      router.refresh();
    } catch {
      setFavorito(!desejado);
      setErro('Falha de conexão.');
    } finally {
      setProcessando(false);
    }
  }

  const descricao = favorito
    ? `Remover ${rotulo} dos favoritos`
    : `Salvar ${rotulo} nos favoritos`;

  return (
    <button type="button" onClick={alternar} disabled={processando}
      aria-label={descricao} aria-pressed={favorito} title={erro || descricao}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
        favorito ? 'bg-perigo-50 hover:bg-perigo-100' : 'hover:bg-slate-100'}`}>
      <Heart className={`h-5 w-5 transition-colors ${
        favorito ? 'fill-perigo-600 text-perigo-600' : 'text-slate-400'}`}
        aria-hidden="true" />
    </button>
  );
}
