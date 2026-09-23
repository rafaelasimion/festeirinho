import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { obterClienteLogado, obterFornecedorLogado } from '@/lib/autorizacao';

// RF066 / RN068 — coordenadas do usuário logado.
//   PUT     grava o par capturado do dispositivo
//   DELETE  remove as coordenadas
//
// No cliente, é a localização-base usada no filtro de proximidade da busca;
// no fornecedor, é a sede a partir da qual ele se desloca.
//
// RN067 — alterar localização NÃO submete o fornecedor a nova verificação:
// a coordenada não é dado exibido na vitrine.

async function usuarioLogado() {
  const sessao = await lerSessao();
  if (!sessao) {
    return { erro: NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 }) };
  }
  const { erro, idUsuario } = sessao.tipoUsuario === 'fornecedor'
    ? await obterFornecedorLogado()
    : await obterClienteLogado();
  if (erro) return { erro };
  return { idUsuario };
}

export async function PUT(request) {
  const { erro, idUsuario } = await usuarioLogado();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const latitude = Number(corpo.latitude);
  const longitude = Number(corpo.longitude);

  // A chk_usuario_geo exige as duas coordenadas juntas e dentro das faixas
  // geográficas. Conferir aqui devolve uma mensagem compreensível em vez de
  // um erro cru do banco.
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ erro: 'Coordenadas inválidas.' }, { status: 400 });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ erro: 'Coordenadas fora da faixa válida.' }, { status: 400 });
  }

  // A coluna guarda seis casas decimais — cerca de 11 cm de precisão, muito
  // além do que o filtro precisa. Arredondar evita que o banco trunque.
  const arredondar = (valor) => Math.round(valor * 1e6) / 1e6;

  try {
    await pool.execute(
      'UPDATE usuario SET latitude = ?, longitude = ? WHERE id = ?',
      [arredondar(latitude), arredondar(longitude), idUsuario]
    );
    return NextResponse.json({
      latitude: arredondar(latitude),
      longitude: arredondar(longitude),
    });
  } catch (erroGravacao) {
    console.error('[perfil/localizacao PUT]', erroGravacao);
    return NextResponse.json({ erro: 'Não foi possível salvar a localização.' }, { status: 500 });
  }
}

export async function DELETE() {
  const { erro, idUsuario } = await usuarioLogado();
  if (erro) return erro;

  try {
    // As duas colunas são anuladas juntas: a CHECK não admite meia
    // coordenada.
    await pool.execute(
      'UPDATE usuario SET latitude = NULL, longitude = NULL WHERE id = ?',
      [idUsuario]
    );
    return NextResponse.json({ latitude: null, longitude: null });
  } catch (erroRemocao) {
    console.error('[perfil/localizacao DELETE]', erroRemocao);
    return NextResponse.json({ erro: 'Não foi possível remover a localização.' }, { status: 500 });
  }
}
