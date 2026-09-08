import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';
import {
  somenteDigitos,
  validarCPF,
  validarEmail,
  validarTelefone,
  validarUF,
  validarDataNascimento,
  validarNomeUsuario,
} from '@/lib/validacao';

// RF001 — Cadastro de cliente.
// Grava em duas tabelas (usuario + cliente) dentro de uma transação:
// ou as duas linhas nascem juntas, ou nenhuma nasce.

export async function POST(request) {
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json(
      { erro: 'Corpo da requisição inválido.' },
      { status: 400 }
    );
  }

  const nome = String(corpo.nome ?? '').trim();
  const nomeUsuario = String(corpo.nomeUsuario ?? '').trim();
  const email = String(corpo.email ?? '').trim().toLowerCase();
  const telefone = somenteDigitos(corpo.telefone);
  const senha = String(corpo.senha ?? '');
  const estado = String(corpo.estado ?? '').trim().toUpperCase();
  const cidade = String(corpo.cidade ?? '').trim();
  const cpf = somenteDigitos(corpo.cpf);
  const dataNascimento = String(corpo.dataNascimento ?? '').trim();

  // RN068 — a coordenada é opcional, mas nunca pela metade:
  // ou as duas vêm preenchidas, ou as duas ficam nulas.
  const temCoordenadas =
    corpo.latitude !== undefined && corpo.latitude !== null &&
    corpo.longitude !== undefined && corpo.longitude !== null;
  const latitude = temCoordenadas ? Number(corpo.latitude) : null;
  const longitude = temCoordenadas ? Number(corpo.longitude) : null;

  // ---------- Validação de entrada ----------
  const erros = {};
  if (nome.length < 3 || nome.length > 150) erros.nome = 'Informe o nome completo.';
  if (!validarNomeUsuario(nomeUsuario))
    erros.nomeUsuario = 'Use de 3 a 50 caracteres, apenas letras, números, ponto ou _.';
  if (!validarEmail(email)) erros.email = 'Informe um e-mail válido.';
  if (!validarTelefone(telefone)) erros.telefone = 'Informe o telefone com DDD.';
  if (senha.length < 8) erros.senha = 'A senha deve ter ao menos 8 caracteres.';
  if (!validarUF(estado)) erros.estado = 'Selecione o estado.';
  if (cidade.length < 2 || cidade.length > 100) erros.cidade = 'Informe a cidade.';
  if (!validarCPF(cpf)) erros.cpf = 'CPF inválido.'; // RN037
  if (!validarDataNascimento(dataNascimento))
    erros.dataNascimento = 'Informe uma data de nascimento válida.';
  if (temCoordenadas && (Number.isNaN(latitude) || Number.isNaN(longitude)))
    erros.localizacao = 'Coordenadas inválidas.';

  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  const conexao = await pool.getConnection();
  try {
    // RN032 — se o CPF já existe em um cadastro de fornecedor, avisa e
    // deixa prosseguir. O front reenvia com cienteCpfOutroPapel = true.
    if (!corpo.cienteCpfOutroPapel) {
      const [existentes] = await conexao.execute(
        'SELECT 1 FROM fornecedor WHERE cpf = ? LIMIT 1',
        [cpf]
      );
      if (existentes.length > 0) {
        return NextResponse.json(
          {
            codigo: 'CPF_EM_OUTRO_PAPEL',
            aviso:
              'Já existe um cadastro de fornecedor com este CPF. Você pode continuar e criar sua conta de cliente normalmente.',
          },
          { status: 409 }
        );
      }
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    await conexao.beginTransaction();

    const [resultadoUsuario] = await conexao.execute(
      `INSERT INTO usuario
         (tipo_usuario, nome, nome_usuario, email, telefone,
          senha_hash, estado, cidade, latitude, longitude)
       VALUES ('cliente', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nome, nomeUsuario, email, telefone, senhaHash, estado, cidade, latitude, longitude]
    );

    const idUsuario = resultadoUsuario.insertId;

    await conexao.execute(
      `INSERT INTO cliente
         (id_usuario, tipo_usuario, cpf, data_nascimento)
       VALUES (?, 'cliente', ?, ?)`,
      [idUsuario, cpf, dataNascimento]
    );

    await conexao.commit();

    // Nunca devolva senha_hash nem dados que a tela não vá usar.
    return NextResponse.json(
      { id: idUsuario, nome, nomeUsuario },
      { status: 201 }
    );
  } catch (erro) {
    await conexao.rollback();

    // RN002 — unicidade. O banco é a última linha de defesa: mesmo com a
    // checagem prévia, dois cadastros simultâneos podem passar. Traduzimos
    // o erro do MySQL para uma mensagem que a tela sabe exibir.
    if (erro.code === 'ER_DUP_ENTRY') {
      const mensagem = String(erro.message);
      if (mensagem.includes('uk_usuario_email'))
        return NextResponse.json(
          { erros: { email: 'Este e-mail já está cadastrado.' } },
          { status: 409 }
        );
      if (mensagem.includes('uk_usuario_nome_usuario'))
        return NextResponse.json(
          { erros: { nomeUsuario: 'Este nome de usuário já está em uso.' } },
          { status: 409 }
        );
      if (mensagem.includes('uk_cliente_cpf'))
        return NextResponse.json(
          { erros: { cpf: 'Já existe um cadastro de cliente com este CPF.' } },
          { status: 409 }
        );
    }

    console.error('[cadastro/cliente]', erro);
    return NextResponse.json(
      { erro: 'Não foi possível concluir o cadastro. Tente novamente.' },
      { status: 500 }
    );
  } finally {
    conexao.release();
  }
}
