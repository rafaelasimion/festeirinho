import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterClienteLogado } from '@/lib/autorizacao';
import {
  somenteDigitos, detectarBandeira, ultimosQuatro, conferirCartao,
} from '@/lib/cartao';

// RF032 / UC 030 — cadastro de cartão de crédito.
// RF032-B / UC 029 — remoção fica em ./[id]/route.js
//
// RN013 é a regra que manda nesta rota: o número completo, o CVV e a
// validade ATRAVESSAM o servidor, mas não param nele. Eles existem
// apenas dentro desta função, o tempo de montar a chamada ao gateway, e
// o que sobra no banco é token, bandeira, quatro últimos dígitos e
// apelido. Nada aqui pode ir para console.log, nem em caso de erro.

export async function GET() {
  const { erro, cliente } = await obterClienteLogado();
  if (erro) return erro;

  try {
    const [cartoes] = await pool.execute(
      `SELECT id, bandeira, ultimos_quatro_num, apelido
         FROM cartao_credito
        WHERE id_cliente = ? AND status = 'ativo'
        ORDER BY id DESC`,
      [cliente.id]
    );
    return NextResponse.json({ cartoes });
  } catch (falha) {
    console.error('[cartoes GET]', falha);
    return NextResponse.json(
      { erro: 'Não foi possível carregar seus cartões.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const { erro, cliente } = await obterClienteLogado();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const numero = somenteDigitos(corpo.numero);
  const nomeImpresso = String(corpo.nomeImpresso ?? '').trim();
  const validade = String(corpo.validade ?? '').trim();
  const cvv = somenteDigitos(corpo.cvv);
  const apelido = String(corpo.apelido ?? '').trim();

  const bandeira = detectarBandeira(numero);

  // ---------- validação de entrada ----------
  // As mesmas regras e mensagens que a tela mostra campo a campo
  // (lib/cartao.js). A tela confere antes de enviar; esta é a que vale.
  const erros = conferirCartao({ numero, nomeImpresso, validade, cvv, apelido });

  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  // ---------------------------------------------------------------
  // SIMULAÇÃO DO GATEWAY (UC 030, passo 5)
  // Em produção, número, validade, CVV e nome seriam enviados ao
  // gateway, que devolveria um token. Aqui o token é gerado localmente.
  // Substituir esta simulação por uma integração real significa trocar
  // apenas este bloco — nada do que vem depois muda, porque o resto do
  // sistema só conhece o token.
  const tokenGateway = `TOK-${cliente.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  // ---------------------------------------------------------------

  try {
    const [resultado] = await pool.execute(
      `INSERT INTO cartao_credito
         (id_cliente, token_gateway, ultimos_quatro_num, bandeira, apelido)
       VALUES (?, ?, ?, ?, ?)`,
      [cliente.id, tokenGateway, ultimosQuatro(numero), bandeira, apelido || null]
    );

    return NextResponse.json(
      {
        id: resultado.insertId,
        bandeira,
        ultimos_quatro_num: ultimosQuatro(numero),
        apelido: apelido || null,
      },
      { status: 201 }
    );
  } catch (falha) {
    // O erro do MySQL pode trazer os valores do INSERT. Como um deles é o
    // token, registramos só o código — nunca o objeto inteiro.
    console.error('[cartoes POST]', falha.code ?? 'erro desconhecido');
    return NextResponse.json(
      { erro: 'Não foi possível salvar o cartão. Tente novamente.' },
      { status: 500 }
    );
  }
}
