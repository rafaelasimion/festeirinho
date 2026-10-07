'use client';

import { useEffect, useRef } from 'react';

// O aviso de resultado das telas de administração — sucesso e erro.
//
// Por que ele rola a si mesmo para a vista: nas abas do painel a mensagem
// mora no alto, logo abaixo das abas, e as ações ficam dentro de listas que
// podem ser longas. Quem rejeita o quinto fornecedor da fila está com a tela
// rolada, clica em "Confirmar rejeição", e a resposta — tanto o erro quanto
// o "Rejeitado, com o motivo registrado" — aparece fora do campo de visão.
// Da cadeira de quem clicou, não aconteceu nada.
//
// A rolagem é suave e só acontece quando o texto MUDA para algo não vazio,
// nunca a cada renderização: o que a pessoa acabou de provocar vem até ela,
// e o resto fica onde está.
export default function AvisoPainel({ mensagem, erro, margem = false }) {
  const alvo = useRef(null);
  const ultimoTexto = useRef('');

  const texto = erro || mensagem || '';

  useEffect(() => {
    if (!texto || texto === ultimoTexto.current) return;
    ultimoTexto.current = texto;
    alvo.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [texto]);

  if (!texto) {
    // Mantém o ponto de ancoragem no documento mesmo sem aviso, para que a
    // referência exista quando o primeiro deles chegar.
    return <div ref={alvo} aria-hidden="true" />;
  }

  return (
    <div ref={alvo} className={margem ? 'mb-4' : undefined}>
      {mensagem && !erro && (
        <p role="status"
          className="rounded-xl bg-sucesso-50 px-4 py-3 text-sm text-sucesso-800">
          {mensagem}
        </p>
      )}
      {erro && (
        <p role="alert"
          className="rounded-xl bg-perigo-50 px-4 py-3 text-sm text-perigo-700">
          {erro}
        </p>
      )}
    </div>
  );
}
