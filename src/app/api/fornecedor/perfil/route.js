import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterFornecedorLogado } from '@/lib/autorizacao';
import {
  somenteDigitos,
  normalizarCNPJ,
  validarCPF,
  validarCNPJ,
  validarTelefone,
  validarURL,
  validarUF,
  validarMaioridade,
  IDADE_MINIMA,
} from '@/lib/validacao';

// RF004 — o fornecedor consulta e edita o próprio perfil.
// Nenhuma rota recebe id de fornecedor: o dono do dado é sempre quem
// está logado. Aceitar um id vindo do navegador permitiria alguém editar
// o perfil alheio só trocando o número.

export async function GET() {
  const { erro, idUsuario } = await obterFornecedorLogado();
  if (erro) return erro;

  const [linhas] = await pool.execute(
    `SELECT u.nome, u.telefone, u.cidade, u.estado, u.foto_perfil,
            u.latitude, u.longitude,
            f.tipo_pessoa, f.cpf, f.data_nascimento, f.cnpj, f.razao_social,
            f.nome_exibicao, f.descricao,
            f.instagram_url, f.whatsapp_url, f.site,
            f.raio_atendimento_km,
            f.status_fornecedor, f.status_verificacao,
            f.motivo_rejeicao
       FROM fornecedor f
       JOIN usuario u ON u.id = f.id_usuario
      WHERE f.id_usuario = ?`,
    [idUsuario]
  );

  const perfil = linhas[0];

  // O driver devolve DATE como objeto Date. A tela precisa de 'aaaa-mm-dd'
  // para preencher um input type="date".
  return NextResponse.json({
    ...perfil,
    data_nascimento: perfil.data_nascimento
      ? perfil.data_nascimento.toISOString().slice(0, 10)
      : null,
  });
}

export async function PUT(request) {
  const { erro, idUsuario, fornecedor } = await obterFornecedorLogado();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  // Dados da conta (tabela usuario)
  const nome = String(corpo.nome ?? '').trim();
  const telefone = somenteDigitos(corpo.telefone);
  const cidade = String(corpo.cidade ?? '').trim();
  const estado = String(corpo.estado ?? '').trim().toUpperCase();

  // Dados do negócio (tabela fornecedor)
  const nomeExibicao = String(corpo.nomeExibicao ?? '').trim();
  const descricao = String(corpo.descricao ?? '').trim();
  const instagramUrl = String(corpo.instagramUrl ?? '').trim();
  const whatsappUrl = String(corpo.whatsappUrl ?? '').trim();
  const site = String(corpo.site ?? '').trim();
  const raioAtendimentoKm = Number(corpo.raioAtendimentoKm);

  const ehPF = fornecedor.tipo_pessoa === 'PF';
  const razaoSocial = ehPF ? null : String(corpo.razaoSocial ?? '').trim();

  // tipo_pessoa é imutável (RF004): nem é lido do corpo da requisição.

  const erros = {};
  if (nome.length < 3 || nome.length > 150) erros.nome = 'Informe o nome do responsável.';
  if (!validarTelefone(telefone)) erros.telefone = 'Informe o telefone com DDD.';
  if (cidade.length < 2 || cidade.length > 100) erros.cidade = 'Informe a cidade.';
  if (!validarUF(estado)) erros.estado = 'Selecione o estado.';
  if (nomeExibicao.length < 2 || nomeExibicao.length > 150)
    erros.nomeExibicao = 'Informe o nome que aparece na vitrine.';
  if (descricao.length < 20)
    erros.descricao = 'Descreva seu trabalho em ao menos 20 caracteres.';
  if (!validarURL(instagramUrl)) erros.instagramUrl = 'Endereço inválido.';
  if (!validarURL(whatsappUrl)) erros.whatsappUrl = 'Endereço inválido.';
  if (!validarURL(site)) erros.site = 'Endereço inválido.';
  if (!Number.isInteger(raioAtendimentoKm) || raioAtendimentoKm < 1 || raioAtendimentoKm > 200)
    erros.raioAtendimentoKm = 'Informe um raio entre 1 e 200 km.';
  if (!ehPF && (razaoSocial.length < 2 || razaoSocial.length > 200))
    erros.razaoSocial = 'Informe a razão social.';

  // Documento e data de nascimento só admitem correção enquanto a verificação
  // não foi aprovada. Depois da aprovação tornam-se imutáveis: os dois foram
  // conferidos pela administração, e trocá-los exigiria nova análise.
  const documentoEditavel = fornecedor.status_verificacao !== 'aprovado';
  let cpf = null;
  let cnpj = null;
  let dataNascimento = null;

  if (documentoEditavel) {
    if (ehPF) {
      cpf = somenteDigitos(corpo.cpf);
      dataNascimento = String(corpo.dataNascimento ?? '').trim();
      if (!validarCPF(cpf)) erros.cpf = 'CPF inválido.';
      if (!validarMaioridade(dataNascimento)) {
        erros.dataNascimento = `É necessário ter ao menos ${IDADE_MINIMA} anos completos.`;
      }
    } else {
      cnpj = normalizarCNPJ(corpo.cnpj);
      if (!validarCNPJ(cnpj)) erros.cnpj = 'CNPJ inválido.';
    }
  }

  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  const conexao = await pool.getConnection();
  try {
    // Lê os valores atuais para saber o que de fato mudou.
    const [atuais] = await conexao.execute(
      `SELECT nome_exibicao, descricao, razao_social,
              instagram_url, whatsapp_url, site
         FROM fornecedor WHERE id_usuario = ?`,
      [idUsuario]
    );
    const atual = atuais[0];

    // RN067 — alterar dado relevante da vitrine devolve a verificação a
    // "pendente". Telefone, cidade, senha e raio de atendimento NÃO entram
    // nessa lista. O motivo de rejeição anterior é preservado: ele continua
    // visível ao fornecedor até a nova análise.
    const mudouDadoRelevante =
      atual.nome_exibicao !== nomeExibicao ||
      atual.descricao !== descricao ||
      (atual.razao_social ?? '') !== (razaoSocial ?? '') ||
      (atual.instagram_url ?? '') !== instagramUrl ||
      (atual.whatsapp_url ?? '') !== whatsappUrl ||
      (atual.site ?? '') !== site;

    const novoStatusVerificacao = mudouDadoRelevante
      ? 'pendente'
      : fornecedor.status_verificacao;

    await conexao.beginTransaction();

    await conexao.execute(
      `UPDATE usuario
          SET nome = ?, telefone = ?, cidade = ?, estado = ?
        WHERE id = ?`,
      [nome, telefone, cidade, estado, idUsuario]
    );

    // Documento e data de nascimento só entram no UPDATE quando ainda
    // são editáveis.
    if (documentoEditavel) {
      await conexao.execute(
        `UPDATE fornecedor
            SET nome_exibicao = ?, descricao = ?, razao_social = ?,
                instagram_url = ?, whatsapp_url = ?, site = ?,
                raio_atendimento_km = ?, status_verificacao = ?,
                cpf = ?, data_nascimento = ?, cnpj = ?
          WHERE id_usuario = ?`,
        [
          nomeExibicao, descricao, razaoSocial,
          instagramUrl || null, whatsappUrl || null, site || null,
          raioAtendimentoKm, novoStatusVerificacao,
          cpf, dataNascimento, cnpj,
          idUsuario,
        ]
      );
    } else {
      await conexao.execute(
        `UPDATE fornecedor
            SET nome_exibicao = ?, descricao = ?, razao_social = ?,
                instagram_url = ?, whatsapp_url = ?, site = ?,
                raio_atendimento_km = ?, status_verificacao = ?
          WHERE id_usuario = ?`,
        [
          nomeExibicao, descricao, razaoSocial,
          instagramUrl || null, whatsappUrl || null, site || null,
          raioAtendimentoKm, novoStatusVerificacao,
          idUsuario,
        ]
      );
    }

    await conexao.commit();

    return NextResponse.json({
      statusVerificacao: novoStatusVerificacao,
      voltouParaVerificacao: mudouDadoRelevante && fornecedor.status_verificacao !== 'pendente',
    });
  } catch (erro) {
    await conexao.rollback();

    if (erro.code === 'ER_DUP_ENTRY') {
      const mensagem = String(erro.message);
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

    console.error('[fornecedor/perfil PUT]', erro);
    return NextResponse.json(
      { erro: 'Não foi possível salvar as alterações.' },
      { status: 500 }
    );
  } finally {
    conexao.release();
  }
}
