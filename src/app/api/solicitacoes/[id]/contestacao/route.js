import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterConfiguracoes } from '@/lib/configuracao';
import { notificar, partesDaSolicitacao } from '@/lib/notificacao-servidor';
import {
  MOTIVOS_CONTESTACAO,
  MINIMO_RELATO_CONTESTACAO,
  MAXIMO_RELATO_CONTESTACAO,
} from '@/lib/contestacao';
import {
  parteDaContestacao,
  salvarFotosDoEnvio,
  inserirFotosDoEnvio,
  removerArquivosContestacao,
} from '@/lib/fotos-contestacao-servidor';

// O relato de cada parte sobre a contestação da conclusão, com as fotos,
// num envio só (multipart/form-data):
//
//   cliente     UC 042 — registra a contestação: "motivo", "descricao" e
//               até cinco "fotos" (RF069, RF069-B).
//   fornecedor  UC 046 — apresenta a sua versão sobre a contestação
//               pendente: "descricao" e até cinco "fotos" (RF069-B).
//
// O papel vem da sessão, não do formulário: quem é cliente da solicitação
// contesta, quem é o fornecedor dela responde.
//
// RN069 — o envio é ÚNICO para as duas partes. Antes, a contestação ia por
// uma rota e cada foto por outra, e o quadro de fotos continuava aceitando
// inclusões e remoções até a decisão: a prova mudava enquanto a
// administração analisava. Agora relato e fotos entram juntos, numa
// transação, e depois disso nada muda. Se uma foto é recusada, nada é
// registrado e o formulário continua preenchido para a troca.

export async function POST(request, { params }) {
  const { erro, idSolicitacao, papel } = await parteDaContestacao(params);
  if (erro) return erro;

  let formulario;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const descricao = String(formulario.get('descricao') ?? '').trim();
  const motivo = String(formulario.get('motivo') ?? '');
  const fotos = formulario.getAll('fotos');

  // 1. O que dá para conferir sem o banco.
  if (papel === 'cliente' && !MOTIVOS_CONTESTACAO.some((m) => m.valor === motivo)) {
    return NextResponse.json({ erro: 'Selecione o motivo da contestação.' }, { status: 400 });
  }
  if (descricao.length < MINIMO_RELATO_CONTESTACAO) {
    return NextResponse.json(
      {
        erro: papel === 'cliente'
          ? `Descreva o ocorrido em ao menos ${MINIMO_RELATO_CONTESTACAO} caracteres.`
          : `Descreva a sua versão em ao menos ${MINIMO_RELATO_CONTESTACAO} caracteres.`,
      },
      { status: 400 }
    );
  }
  if (descricao.length > MAXIMO_RELATO_CONTESTACAO) {
    return NextResponse.json({ erro: 'Descrição muito longa.' }, { status: 400 });
  }

  // 2. O estado da solicitação, ANTES de gravar qualquer arquivo: um envio
  //    que vai ser recusado não deixa foto no disco nem por um instante.
  //    A mesma conferência se repete dentro da transação, com a linha
  //    travada — entre uma e outra, a decisão da administração ou a
  //    confirmação automática podem ter chegado.
  const configuracoes = await obterConfiguracoes();
  const [antes] = await pool.execute(CONSULTA_ESTADO, [idSolicitacao]);
  const impedimentoAntes = impedimento(antes[0], papel, configuracoes);
  if (impedimentoAntes) {
    return NextResponse.json({ erro: impedimentoAntes }, { status: 409 });
  }

  // 3. As fotos no disco — todas ou nenhuma.
  const salvas = await salvarFotosDoEnvio(fotos);
  if (salvas.erro) {
    return NextResponse.json({ erro: salvas.erro }, { status: 400 });
  }

  // 4. Relato e fotos no banco, juntos.
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    // A linha fica travada até o commit. É o que impede o envio de
    // atravessar a decisão da administração (que grava a mesma linha) ou a
    // confirmação automática: uma espera a outra.
    const [linhas] = await conexao.execute(`${CONSULTA_ESTADO} FOR UPDATE`, [idSolicitacao]);
    const impedimentoAgora = impedimento(linhas[0], papel, configuracoes);
    if (impedimentoAgora) {
      await conexao.rollback();
      await removerArquivosContestacao(salvas.urls);
      return NextResponse.json({ erro: impedimentoAgora }, { status: 409 });
    }

    if (papel === 'cliente') {
      // A CHECK da tabela admite só três estados coerentes para a
      // contestação. O estado "pendente" exige motivo, descrição e data
      // preenchidos, e resultado, justificativa e data de análise nulos —
      // tudo na mesma instrução.
      await conexao.execute(
        `UPDATE solicitacao
            SET motivo_contestacao_cliente = ?,
                descricao_contestacao_cliente = ?,
                data_contestacao_cliente = NOW(),
                status_contestacao = 'pendente'
          WHERE id = ?`,
        [motivo, descricao, idSolicitacao]
      );
    } else {
      // A chk_solicitacao_contestacao_fornecedor exige descrição e data
      // juntas, sobre contestação registrada, e anteriores à decisão.
      await conexao.execute(
        `UPDATE solicitacao
            SET descricao_contestacao_fornecedor = ?,
                data_contestacao_fornecedor = NOW()
          WHERE id = ?`,
        [descricao, idSolicitacao]
      );
    }

    await inserirFotosDoEnvio(conexao, idSolicitacao, papel, salvas.urls);
    await conexao.commit();
  } catch (erroEnvio) {
    await conexao.rollback();
    // Os arquivos já foram gravados; sem as linhas no banco ficariam órfãos.
    await removerArquivosContestacao(salvas.urls);
    console.error('[solicitacoes contestacao POST]', erroEnvio);
    return NextResponse.json(
      {
        erro: papel === 'cliente'
          ? 'Não foi possível registrar a contestação.'
          : 'Não foi possível registrar a sua versão.',
      },
      { status: 500 }
    );
  } finally {
    conexao.release();
  }

  // RN069 — a solicitação permanece em "confirmado", a confirmação
  // automática fica suspensa e o repasse não se torna elegível.
  //
  // RF069-B — o aviso diz ao fornecedor que ele pode contar o seu lado.
  // Sem isso, ele só descobriria o formulário abrindo a solicitação por
  // acaso. A versão do fornecedor não gera aviso: só a administração a lê.
  if (papel === 'cliente') {
    const partes = await partesDaSolicitacao(idSolicitacao);
    if (partes) {
      await notificar({
        idUsuario: partes.fornecedor,
        tipo: 'solicitacao',
        titulo: 'Conclusão contestada pelo cliente',
        mensagem: `${partes.nome_cliente} contestou a conclusão de ${partes.servico}. `
          + 'A administração vai analisar. Se quiser, apresente a sua versão, '
          + 'com fotos do serviço prestado, na página da solicitação.',
        idSolicitacao,
      });
    }
  }

  return NextResponse.json(
    { papel, statusContestacao: 'pendente', fotos: salvas.urls.length },
    { status: 201 }
  );
}

const CONSULTA_ESTADO = `
  SELECT status,
         data_registro_conclusao_fornecedor,
         data_confirmacao_conclusao_cliente,
         status_contestacao,
         data_contestacao_fornecedor
    FROM solicitacao
   WHERE id = ?`;

// O motivo de o envio não caber no estado atual, ou null se cabe.
function impedimento(solicitacao, papel, configuracoes) {
  if (!solicitacao) return 'Solicitação não encontrada.';

  if (papel === 'fornecedor') {
    if (solicitacao.status_contestacao === null) {
      return 'Não há contestação registrada nesta solicitação.';
    }
    if (solicitacao.status_contestacao !== 'pendente') {
      return 'A contestação desta solicitação não está pendente: a administração já decidiu.';
    }
    if (solicitacao.data_contestacao_fornecedor !== null) {
      return 'Você já enviou a sua versão sobre esta contestação.';
    }
    return null;
  }

  // UC 042, pré-condições: conclusão registrada, sem confirmação e sem
  // contestação anterior.
  if (solicitacao.data_registro_conclusao_fornecedor === null) {
    return 'O fornecedor ainda não registrou a conclusão deste serviço.';
  }
  if (solicitacao.status_contestacao !== null) {
    return 'Esta solicitação já possui uma contestação registrada.';
  }
  if (solicitacao.status !== 'confirmado'
      || solicitacao.data_confirmacao_conclusao_cliente !== null) {
    return 'Esta solicitação não está aguardando confirmação.';
  }

  // UC 042, fluxo 3a — fora do prazo da RN039 não há o que contestar: a
  // conclusão já teria sido confirmada automaticamente.
  const limite = new Date(solicitacao.data_registro_conclusao_fornecedor);
  limite.setHours(limite.getHours() + configuracoes.prazo_confirmacao_conclusao_horas);
  if (limite < new Date()) {
    return 'O prazo para contestar esta conclusão já se esgotou.';
  }
  return null;
}
