import Link from 'next/link';
import { Bell } from 'lucide-react';
import { lerSessao } from '@/lib/sessao';
import { contarNaoLidas } from '@/lib/notificacao-servidor';

// RF064 — indicador de notificações na barra superior.
//
// Componente de servidor: conta as não lidas no banco a cada renderização
// de página. Não há atualização em tempo real — o número acerta na próxima
// navegação, que para um aviso interno é suficiente.

export default async function SinoNotificacoes() {
  const sessao = await lerSessao();
  if (!sessao) return null;

  const naoLidas = await contarNaoLidas(sessao.id);

  return (
    <Link href="/notificacoes" aria-label={
      naoLidas > 0
        ? `Notificações: ${naoLidas} não lidas`
        : 'Notificações'
    }
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-festa-700 transition-colors hover:bg-festa-50">
      <Bell className="h-5 w-5" aria-hidden="true" />
      {naoLidas > 0 && (
        <span aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-perigo-600 px-1 text-[11px] font-semibold text-white">
          {naoLidas > 9 ? '9+' : naoLidas}
        </span>
      )}
    </Link>
  );
}
