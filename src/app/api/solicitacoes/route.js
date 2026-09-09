import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { obterClienteLogado } from '@/lib/autorizacao';
import { obterConfiguracoes } from '@/lib/configuracao';
import { calcularValorFinal } from '@/lib/solicitacao';
import { somenteDigitos, validarUF } from '@/lib/validacao';

// RF017 — envio de solicitação pelo cliente.
// É a rota com mais regras do sistema até aqui: RN016, RN017, RN029,
// RN036, RN042 e RN009 aparecem todas neste arquivo.

export async function POST(request) {
  const { erro, cliente } = await obterClienteLogado();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const idServico = Number(corpo.idServico);
  if (!Number.isInteger(idServico)) {
    return NextResponse.json({ erro: 'Serviço inválido.' }, { status: 400 });
  }

  // O serviço precisa estar disponível AGORA. Um serviço inativado ou que
  // voltou para verificação depois que a tela abriu não pode ser contratado.
  const [servicos] = await pool.execute(
    `SELECT s.id, s.preco_base, s.capacidade_max, s.dias_antecedencia,
            cb.descricao AS cobranca
       FROM servico s
       JOIN fornecedor f ON f.id = s.id_fornecedor
       JOIN cobranca cb  ON cb.id = s.id_cobranca
      WHERE s.id = ?
        AND s.status_servico = 'ativo'
        AND s.status_verificacao = 'aprovado'
        AND f.status_fornecedor = 'ativo'
      LIMIT 1`,
    [idServico]
  );

  if (servicos.length === 0) {
    return NextResponse.json(
      { erro: 'Este serviço não está mais disponível para contratação.' },
      { status: 409 }
    );
  }

  const servico = servicos[0];

  // ---------- dados do evento ----------
  const dataHoraEvento = String(corpo.dataHoraEvento ?? '').trim();
  const duracao = Number(corpo.duracao);
  const numeroConvidados = Number(corpo.numeroConvidados);
  const idTipoLocal = Number(corpo.idTipoLocal);
  const tema = String(corpo.tema ?? '').trim();
  const nomeAniversariante = String(corpo.nomeAniversariante ?? '').trim();
  const idadeAniversariante =
    corpo.idadeAniversariante === '' || corpo.idadeAniversariante === null ||
    corpo.idadeAniversariante === undefined
      ? null
      : Number(corpo.idadeAniversariante);
  const observacoes = String(corpo.observacoes ?? '').trim();

  // ---------- endereço ----------
  const cep = somenteDigitos(corpo.cep);
  const rua = String(corpo.rua ?? '').trim();
  const numero = String(corpo.numero ?? '').trim();
  const bairro = String(corpo.bairro ?? '').trim();
  const cidade = String(corpo.cidade ?? '').trim();
  const estado = String(corpo.estado ?? '').trim().toUpperCase();
  const complemento = String(corpo.complemento ?? '').trim();

  const erros = {};

  // RN042 / RN016 — data futura, respeitando a antecedência do serviço.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dataHoraEvento)) {
    erros.dataHoraEvento = 'Informe a data e a hora do evento.';
  } else {
    const evento = new Date(dataHoraEvento);
    const minimo = new Date();
    minimo.setDate(minimo.getDate() + servico.dias_antecedencia);
    if (Number.isNaN(evento.getTime())) {
      erros.dataHoraEvento = 'Data inválida.';
    } else if (evento < minimo) {
      erros.dataHoraEvento =
        `Este serviço exige ao menos ${servico.dias_antecedencia} dias de antecedência.`;
    }
  }

  if (!Number.isFinite(duracao) || duracao <= 0 || duracao > 999.9) {
    erros.duracao = 'Informe a duração em horas.';
  }

  if (!Number.isInteger(numeroConvidados) || numeroConvidados <= 0) {
    erros.numeroConvidados = 'Informe o número de convidados.';
  } else if (servico.capacidade_max !== null && numeroConvidados > servico.capacidade_max) {
    // RN017
    erros.numeroConvidados =
      `Este serviço atende no máximo ${servico.capacidade_max} convidados.`;
  }

  if (!Number.isInteger(idTipoLocal)) erros.idTipoLocal = 'Selecione o tipo de local.';
  if (cep.length !== 8) erros.cep = 'Informe um CEP com 8 dígitos.';
  if (rua.length < 2 || rua.length > 200) erros.rua = 'Informe a rua.';
  if (numero.length < 1 || numero.length > 20) erros.numero = 'Informe o número.';
  if (bairro.length < 2 || bairro.length > 100) erros.bairro = 'Informe o bairro.';
  if (cidade.length < 2 || cidade.length > 100) erros.cidade = 'Informe a cidade.';
  if (!validarUF(estado)) erros.estado = 'Selecione o estado.';
  if (complemento.length > 100) erros.complemento = 'Complemento muito longo.';
  if (tema.length > 100) erros.tema = 'Tema muito longo.';
  if (nomeAniversariante.length > 150) erros.nomeAniversariante = 'Nome muito longo.';
  if (idadeAniversariante !== null &&
      (!Number.isInteger(idadeAniversariante) || idadeAniversariante < 0 || idadeAniversariante > 255)) {
    erros.idadeAniversariante = 'Idade inválida.';
  }

  if (!erros.idTipoLocal) {
    const [tipos] = await pool.execute(
      'SELECT 1 FROM tipo_local WHERE id = ? LIMIT 1', [idTipoLocal]
    );
    if (tipos.length === 0) erros.idTipoLocal = 'Tipo de local inexistente.';
  }

  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  // RN029 — o valor é calculado aqui, no servidor, com o preço vigente.
  // O total que a tela mostrou é só informativo: se alguém adulterasse o
  // número enviado, este cálculo o ignoraria de qualquer forma.
  const valorReferencia = Number(servico.preco_base);
  const valorFinal = calcularValorFinal({
    precoBase: valorReferencia,
    cobranca: servico.cobranca,
    duracao,
    numeroConvidados,
  });

  if (valorFinal === null || valorFinal <= 0) {
    return NextResponse.json(
      { erro: 'Não foi possível calcular o valor da solicitação.' },
      { status: 400 }
    );
  }

  // O input datetime-local entrega '2026-10-15T14:00'. Converto para o
  // formato do MySQL sem passar por fuso horário nenhum.
  const dataEventoSql = `${dataHoraEvento.slice(0, 16).replace('T', ' ')}:00`;

  const configuracoes = await obterConfiguracoes();
  const prazoRespostaHoras = configuracoes.prazo_resposta_fornecedor_horas;

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    // RN009 — cada solicitação tem endereço próprio, criado para ela.
    const [resultadoEndereco] = await conexao.execute(
      `INSERT INTO endereco (estado, cidade, cep, rua, numero, bairro, complemento)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [estado, cidade, cep, rua, numero, bairro, complemento || null]
    );

    // RN035 — o prazo de resposta do fornecedor é contado a partir de agora,
    // com a duração que está na configuração.
    const [resultadoSolicitacao] = await conexao.execute(
      `INSERT INTO solicitacao
         (id_cliente, id_servico, id_endereco, id_tipo_local,
          data_hora_evento, duracao, numero_convidados,
          tema, nome_aniversariante, idade_aniversariante, observacoes,
          valor_referencia, valor_final,
          data_limite_resposta_fornecedor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               DATE_ADD(NOW(), INTERVAL ? HOUR))`,
      [
        cliente.id, idServico, resultadoEndereco.insertId, idTipoLocal,
        dataEventoSql, duracao, numeroConvidados,
        tema || null, nomeAniversariante || null, idadeAniversariante, observacoes || null,
        valorReferencia, valorFinal,
        prazoRespostaHoras,
      ]
    );

    await conexao.commit();

    return NextResponse.json(
      { id: resultadoSolicitacao.insertId, valorFinal },
      { status: 201 }
    );
  } catch (erro) {
    await conexao.rollback();

    // RN036 — a UNIQUE uk_solicitacao_ativa impede duas solicitações
    // ativas do mesmo cliente, para o mesmo serviço, na mesma data e hora.
    if (erro.code === 'ER_DUP_ENTRY' && String(erro.message).includes('uk_solicitacao_ativa')) {
      return NextResponse.json(
        { erro: 'Você já tem uma solicitação ativa para este serviço nesta data e horário.' },
        { status: 409 }
      );
    }

    console.error('[solicitacoes POST]', erro);
    return NextResponse.json(
      { erro: 'Não foi possível enviar a solicitação.' },
      { status: 500 }
    );
  } finally {
    conexao.release();
  }
}