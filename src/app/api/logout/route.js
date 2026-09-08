import { NextResponse } from 'next/server';
import { encerrarSessao } from '@/lib/sessao';

export async function POST(request) {
  await encerrarSessao();
  // 303 faz o navegador trocar o POST por um GET na página de login.
  return NextResponse.redirect(new URL('/login', request.url), 303);
}
