import { NextResponse } from 'next/server';
import { encerrarSessaoAdmin } from '@/lib/sessao-admin';

export async function POST(request) {
  await encerrarSessaoAdmin();
  return NextResponse.redirect(new URL('/admin/login', request.url), 303);
}
