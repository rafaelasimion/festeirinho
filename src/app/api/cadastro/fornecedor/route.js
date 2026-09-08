import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';
import {
  somenteDigitos,
  normalizarCNPJ,
  validarCPF,
  validarCNPJ,
  validarEmail,
  validarTelefone,
  validarURL,
  validarUF,
  validarNomeUsuario,
} from '@/lib/validacao';

// RF002 — Cadastro de fornecedor.
// Mesma estrutura do cadastro de cliente: transação gravando em usuario +
// fornecedor. A diferença é a RN001 (PF e PJ se excluem).

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

  // ----- dados da conta (tabela usuario) -----
  const nome = String(corpo.nome ?? '').trim();
  const nomeUsuario = String(corpo.nomeUsuario ?? '').trim();
  const email = String(corpo.email ?? '').trim().toLowerCase();
  const telefone = somenteDigitos(corpo.telefone);
  const senha = String(corpo.senha ?? '');
  const estado = String(corpo.estado ?? '').trim().toUpperCase();
  const cidade = String(corpo.cidade ?? '').trim();

  // ----- dados do fornecedor (tabela fornecedor) -----
  const tipoPessoa = String(corpo.tipoPessoa ?? '').trim().toUpperCase();
  const nomeExibicao = String(corpo.nomeExibicao ?? '').trim();
  const descricao = String(corpo.descricao ?? '').trim();
  const instagramUrl = String(corpo.instagramUrl ?? '').trim();
  const whatsappUrl = String(corpo.whatsappUrl ?? '').trim();
  const site = String(corpo.site ?? '').trim();
  const raioAtendimentoKm = Number(corpo.raioAtendimentoKm ?? 30);

  // RN001 — PF preenche CPF; PJ preenche CNPJ e razão social.
  const ehPF = tipoPessoa === 'PF';
  const cpf = ehPF ? somenteDigitos(corpo.cpf) : null;
  const cnpj = ehPF ? null : normalizarCNPJ(corpo.cnpj);
  const razaoSocial = ehPF ? null : String(corpo.razaoSocial ?? '').trim();

  const temCoordenadas =
    corpo.latitude !== undefined && corpo.latitude !== null &&
    corpo.longitude !== undefined && corpo.longitude !== null;
  const latitude = temCoordenadas ? Number(corpo.latitude) : null;
  const longitude = temCoordenadas ? Number(corpo.longitude) : null;

  // ---------- Validação ----------
  const erros = {};
  if (nome.length < 3 || nome.length > 150) erros.nome = 'Informe o nome do responsável.';
  if (!validarNomeUsuario(nomeUsuario))
    erros.nomeUsuario = 'Use de 3 a 50 caracteres, apenas letras, números, ponto ou _.';
  if (!validarEmail(email)) erros.email = 'Informe um e-mail válido.';
  if (!validarTelefone(telefone)) erros.telefone = 'Informe o telefone com DDD.';
  if (senha.length < 8) erros.senha = 'A senha deve ter ao menos 8 caracteres.';
  if (!validarUF(estado)) erros.estado = 'Selecione o estado.';
  if (cidade.length < 2 || cidade.length > 100) erros.cidade = 'Informe a cidade.';

  if (tipoPessoa !== 'PF' && tipoPessoa !== 'PJ') {
    erros.tipoPessoa = 'Selecione pessoa física ou jurídica.';
  } else if (ehPF) {
    // RN001 — o banco só garante que o lado oposto está nulo; a
    // obrigatoriedade do lado preenchido é responsabilidade daqui.
    if (!validarCPF(cpf)) erros.cpf = 'CPF inválido.';
  } else {
    if (!validarCNPJ(cnpj)) erros.cnpj = 'CNPJ inválido.';
    if (razaoSocial.length < 2 || razaoSocial.length > 200)
      erros.razaoSocial = 'Informe a razão social.';
  }

  if (nomeExibicao.length < 2 || nomeExibicao.length > 150)
    erros.nomeExibicao = 'Informe o nome que aparecerá na vitrine.';
  if (descricao.length < 20)
    erros.descricao = 'Descreva seu trabalho em ao menos 20 caracteres.';
  if (!validarURL(instagramUrl)) erros.instagramUrl = 'Endereço inválido.';
  if (!validarURL(whatsappUrl)) erros.whatsappUrl = 'Endereço inválido.';
  if (!validarURL(site)) erros.site = 'Endereço inválido.';
  if (!Number.isInteger(raioAtendimentoKm) || raioAtendimentoKm < 1 || raioAtendimentoKm > 200)
    erros.raioAtendimentoKm = 'Informe um raio entre 1 e 200 km.';
  if (temCoordenadas && (Number.isNaN(latitude) || Number.isNaN(longitude)))
    erros.localizacao = 'Coordenadas inválidas.';

  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  const conexao = await pool.getConnection();
  try {
    // RN032 — CPF já usado em cadastro de cliente: avisa e deixa prosseguir.
    if (ehPF && !corpo.cienteCpfOutroPapel) {
      const [existentes] = await conexao.execute(
        'SELECT 1 FROM cliente WHERE cpf = ? LIMIT 1',
        [cpf]
      );
      if (existentes.length > 0) {
        return NextResponse.json(
          {
            codigo: 'CPF_EM_OUTRO_PAPEL',
            aviso:
              'Já existe um cadastro de cliente com este CPF. Você pode continuar e criar sua conta de fornecedor normalmente.',
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
       VALUES ('fornecedor', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nome, nomeUsuario, email, telefone, senhaHash, estado, cidade, latitude, longitude]
    );

    const idUsuario = resultadoUsuario.insertId;

    // status_verificacao nasce 'pendente' por default: o fornecedor só
    // aparece na vitrine depois da aprovação da administração.
    await conexao.execute(
      `INSERT INTO fornecedor
         (id_usuario, tipo_usuario, tipo_pessoa, cpf, cnpj, razao_social,
          nome_exibicao, descricao, instagram_url, whatsapp_url, site,
          raio_atendimento_km)
       VALUES (?, 'fornecedor', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        idUsuario,
        tipoPessoa,
        cpf,
        cnpj,
        razaoSocial,
        nomeExibicao,
        descricao,
        instagramUrl || null,
        whatsappUrl || null,
        site || null,
        raioAtendimentoKm,
      ]
    );

    await conexao.commit();

    return NextResponse.json(
      { id: idUsuario, nomeExibicao, statusVerificacao: 'pendente' },
      { status: 201 }
    );
  } catch (erro) {
    await conexao.rollback();

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
      if (mensagem.includes('uk_fornecedor_cpf'))
        return NextResponse.json(
          { erros: { cpf: 'Já existe um fornecedor com este CPF.' } },
          { status: 409 }
        );
      if (mensagem.includes('uk_fornecedor_cnpj'))
        return NextResponse.json(
          { erros: { cnpj: 'Já existe um fornecedor com este CNPJ.' } },
          { status: 409 }
        );
    }

    console.error('[cadastro/fornecedor]', erro);
    return NextResponse.json(
      { erro: 'Não foi possível concluir o cadastro. Tente novamente.' },
      { status: 500 }
    );
  } finally {
    conexao.release();
  }
}