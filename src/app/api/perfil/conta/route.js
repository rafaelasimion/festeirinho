import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { obterClienteLogado, obterFornecedorLogado } from '@/lib/autorizacao';
import {
  UFS, validarEmail, validarTelefone, validarNomeUsuario, somenteDigitos,
} from '@/lib/validacao';

// RF004 / UC 004 — dados da conta, comuns a cliente e fornecedor.
//
// O UC 004 separa os dados DA CONTA dos dados exibidos na vitrine, e esta
// rota cuida só dos primeiros: nome, nome de usuário, e-mail, telefone,
// estado, cidade e senha. Os campos da vitrine do fornecedor — nome de
// exibição, descrição, razão social, redes — continuam na rota do perfil
// dele, porque só aqueles disparam nova verificação (RN067).
//
//   PUT    atualiza os dados da conta
//   PATCH  troca a senha

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

  const nome = String(corpo.nome ?? '').trim();
  const nomeUsuario = String(corpo.nomeUsuario ?? '').trim();
  const email = String(corpo.email ?? '').trim().toLowerCase();
  const telefone = somenteDigitos(corpo.telefone);
  const estado = String(corpo.estado ?? '').trim().toUpperCase();
  const cidade = String(corpo.cidade ?? '').trim();

  const erros = {};
  if (nome.length < 3 || nome.length > 150) erros.nome = 'Informe o nome completo.';
  if (!validarNomeUsuario(nomeUsuario)) {
    erros.nomeUsuario = 'Use de 3 a 50 caracteres: letras, números, ponto ou _.';
  }
  if (!validarEmail(email)) erros.email = 'Informe um e-mail válido.';
  if (!validarTelefone(telefone)) erros.telefone = 'Informe o telefone com DDD.';
  if (!UFS.includes(estado)) erros.estado = 'Selecione o estado.';
  if (cidade.length < 2 || cidade.length > 100) erros.cidade = 'Informe a cidade.';

  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  try {
    // RN002 — nome de usuário e e-mail são únicos no sistema. A conferência
    // exclui o próprio registro: sem isso, salvar sem mexer em nada
    // acusaria conflito com a própria conta.
    const [conflitos] = await pool.execute(
      `SELECT nome_usuario, email FROM usuario
        WHERE (nome_usuario = ? OR email = ?) AND id <> ?`,
      [nomeUsuario, email, idUsuario]
    );

    for (const conflito of conflitos) {
      if (conflito.nome_usuario === nomeUsuario) {
        erros.nomeUsuario = 'Este nome de usuário já está em uso.';
      }
      if (conflito.email === email) {
        erros.email = 'Este e-mail já está em uso.';
      }
    }
    if (Object.keys(erros).length > 0) {
      return NextResponse.json({ erros }, { status: 400 });
    }

    await pool.execute(
      `UPDATE usuario
          SET nome = ?, nome_usuario = ?, email = ?, telefone = ?,
              estado = ?, cidade = ?
        WHERE id = ?`,
      [nome, nomeUsuario, email, telefone, estado, cidade, idUsuario]
    );

    // RF004 — nenhum destes campos altera o status de verificação do
    // fornecedor, mesmo quando quem edita é um fornecedor aprovado.
    return NextResponse.json({ salvo: true });
  } catch (erroGravacao) {
    // As UNIQUE do banco são a última linha de defesa: dois cadastros
    // simultâneos passariam pela conferência acima e só o índice barraria.
    if (erroGravacao.code === 'ER_DUP_ENTRY') {
      const campo = String(erroGravacao.message).includes('email') ? 'email' : 'nomeUsuario';
      return NextResponse.json(
        { erros: { [campo]: 'Este dado já está em uso.' } },
        { status: 409 }
      );
    }
    console.error('[perfil/conta PUT]', erroGravacao);
    return NextResponse.json({ erro: 'Não foi possível salvar os dados.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const { erro, idUsuario } = await usuarioLogado();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const senhaAtual = String(corpo.senhaAtual ?? '');
  const novaSenha = String(corpo.novaSenha ?? '');

  if (novaSenha.length < 8) {
    return NextResponse.json(
      { erros: { novaSenha: 'A senha deve ter ao menos 8 caracteres.' } },
      { status: 400 }
    );
  }

  try {
    const [linhas] = await pool.execute(
      'SELECT senha_hash FROM usuario WHERE id = ? LIMIT 1',
      [idUsuario]
    );
    if (linhas.length === 0) {
      return NextResponse.json({ erro: 'Conta não encontrada.' }, { status: 404 });
    }

    // A senha atual é exigida mesmo havendo sessão válida. Isso não está
    // no RF004: é salvaguarda de implementação. Um computador deixado
    // aberto permitiria a um terceiro trocar a senha e tomar a conta.
    const confere = await bcrypt.compare(senhaAtual, linhas[0].senha_hash);
    if (!confere) {
      return NextResponse.json(
        { erros: { senhaAtual: 'Senha atual incorreta.' } },
        { status: 400 }
      );
    }

    // RNF001 — a senha é guardada apenas como hash. O custo 10 é o mesmo
    // usado no cadastro; mudar aqui criaria hashes de custos diferentes.
    const novoHash = await bcrypt.hash(novaSenha, 10);
    await pool.execute('UPDATE usuario SET senha_hash = ? WHERE id = ?', [novoHash, idUsuario]);

    return NextResponse.json({ senhaAlterada: true });
  } catch (erroSenha) {
    console.error('[perfil/conta PATCH]', erroSenha);
    return NextResponse.json({ erro: 'Não foi possível alterar a senha.' }, { status: 500 });
  }
}
