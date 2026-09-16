'use client';

import { usePathname } from 'next/navigation';

// O painel administrativo tem cabeçalho próprio. Sem isto, o cabeçalho do
// site apareceria lá em cima oferecendo "Entrar" e "Criar conta" — que é o
// acesso dos usuários, não o do administrador.
//
// Precisa ser componente de cliente porque só o navegador sabe em qual
// endereço a pessoa está. O conteúdo continua vindo pronto do servidor,
// passado como children.

export default function CabecalhoVisibilidade({ children }) {
  const caminho = usePathname();
  if (caminho?.startsWith('/admin')) return null;
  return children;
}
