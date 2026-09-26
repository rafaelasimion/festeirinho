import PDFDocument from 'pdfkit';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';

// RF058 / UC 034 / RN059 — comprovante de contratação.
//
// Documento NÃO FISCAL: registra a transação e as condições contratadas.
// A nota fiscal, quando cabível, é responsabilidade do fornecedor PJ
// perante o município dele, e a plataforma não a emite.
//
// O conteúdo reproduz o que ficou gravado no envio da solicitação (RF024) e
// os percentuais de multa congelados no pagamento (RN050). É justamente por
// isso que o comprovante pode ser emitido meses depois e continuar
// correspondendo ao que foi acordado.

const ROTULO_FORMA = {
  pix: 'Pix',
  cartao: 'Cartão de crédito',
  boleto: 'Boleto bancário',
};

const ROTULO_COBRANCA = {
  hora: 'por hora',
  pessoa: 'por pessoa',
  fixo: 'valor fixo',
};

const ROXO = '#534AB7';
const CINZA = '#64748B';
const ESCURO = '#0F172A';

function dinheiro(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataHora(valor) {
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export async function GET(request, { params }) {
  const sessao = await lerSessao();
  if (!sessao) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  const { id } = await params;
  const idSolicitacao = Number(id);
  if (!Number.isInteger(idSolicitacao)) {
    return Response.json({ erro: 'Solicitação inválida.' }, { status: 400 });
  }

  const [linhas] = await pool.execute(
    `SELECT so.id, so.data_hora_evento, so.duracao, so.numero_convidados,
            so.tema, so.nome_aniversariante, so.idade_aniversariante,
            so.valor_referencia, so.valor_final, so.data_solicitacao,
            s.nome AS servico, c.nome AS categoria, cb.descricao AS cobranca,
            tl.descricao AS tipo_local,
            e.rua, e.numero, e.complemento, e.bairro, e.cidade, e.estado, e.cep,
            f.nome_exibicao, f.tipo_pessoa,
            uc.nome AS cliente,
            cl.id_usuario AS usuario_cliente,
            f.id_usuario  AS usuario_fornecedor,
            p.status AS status_pagamento, p.forma_pagamento, p.data_pagamento,
            p.id_transacao_gateway, p.valor_bruto,
            p.perc_multa_faixa_mais_7d, p.perc_multa_faixa_7d_48h,
            p.perc_multa_faixa_48h_24h, p.perc_multa_faixa_24h
       FROM solicitacao so
       JOIN servico s     ON s.id  = so.id_servico
       JOIN categoria c   ON c.id  = s.id_categoria
       JOIN cobranca cb   ON cb.id = s.id_cobranca
       JOIN tipo_local tl ON tl.id = so.id_tipo_local
       JOIN endereco e    ON e.id  = so.id_endereco
       JOIN fornecedor f  ON f.id  = s.id_fornecedor
       JOIN cliente cl    ON cl.id = so.id_cliente
       JOIN usuario uc    ON uc.id = cl.id_usuario
       LEFT JOIN pagamento p ON p.id_solicitacao = so.id
      WHERE so.id = ?
      LIMIT 1`,
    [idSolicitacao]
  );

  if (linhas.length === 0) {
    return Response.json({ erro: 'Solicitação não encontrada.' }, { status: 404 });
  }
  const dados = linhas[0];

  // Só as partes da contratação têm acesso ao comprovante. Como no chat,
  // quem não é parte recebe "não encontrada": confirmar a existência já
  // seria informação a mais.
  if (sessao.id !== dados.usuario_cliente && sessao.id !== dados.usuario_fornecedor) {
    return Response.json({ erro: 'Solicitação não encontrada.' }, { status: 404 });
  }

  // UC 034, fluxo 1a / RN059 — só existe comprovante de pagamento efetivado.
  if (dados.status_pagamento !== 'pago') {
    return Response.json(
      { erro: 'O comprovante fica disponível após a confirmação do pagamento.' },
      { status: 409 }
    );
  }

  const pdf = await montarPdf(dados);

  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      // inline abre no navegador; o nome é usado se a pessoa salvar.
      'Content-Disposition':
        `inline; filename="comprovante-festeirinho-${dados.id}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

function montarPdf(dados) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const pedacos = [];
  doc.on('data', (pedaco) => pedacos.push(pedaco));
  const pronto = new Promise((resolver) => {
    doc.on('end', () => resolver(Buffer.concat(pedacos)));
  });

  const margem = 50;
  const largura = doc.page.width - margem * 2;

  // O x é sempre informado: a linha anterior termina com o cursor na
  // coluna da direita, e sem isso o título nasceria recuado.
  function titulo(texto) {
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ROXO)
      .text(texto.toUpperCase(), margem, doc.y, { width: largura });
    doc.moveTo(margem, doc.y + 3).lineTo(margem + largura, doc.y + 3)
      .strokeColor('#E2E8F0').lineWidth(1).stroke();
    doc.moveDown(0.6);
  }

  // Rótulo à esquerda e valor à direita, na mesma linha: é o formato que
  // faz um comprovante ser lido de relance.
  function linha(rotulo, valor) {
    const y = doc.y;
    doc.font('Helvetica').fontSize(9).fillColor(CINZA).text(rotulo, margem, y, {
      width: largura * 0.4,
    });
    doc.font('Helvetica').fontSize(10).fillColor(ESCURO)
      .text(String(valor), margem + largura * 0.4, y, {
        width: largura * 0.6, align: 'right',
      });
    doc.moveDown(0.35);
  }

  // ---------------- cabeçalho ----------------
  doc.font('Helvetica-Bold').fontSize(20).fillColor(ROXO)
    .text('Festeirinho', margem, margem);
  doc.font('Helvetica').fontSize(12).fillColor(ESCURO)
    .text('Comprovante de contratação', margem, doc.y + 2);
  doc.font('Helvetica').fontSize(9).fillColor(CINZA)
    .text(`Solicitação nº ${dados.id} · emitido em ${dataHora(new Date())}`,
      margem, doc.y + 2);

  // O aviso vem no alto, e não escondido no rodapé: é a informação que
  // muda o que a pessoa pode fazer com o documento (RN059).
  //
  // A posição da caixa é guardada antes de desenhá-la: preencher um
  // retângulo não move o cursor de texto, então escrever "a partir daqui"
  // cairia fora dela.
  const topoAviso = doc.y + 14;
  const alturaAviso = 36;
  doc.rect(margem, topoAviso, largura, alturaAviso).fillAndStroke('#FDF3EF', '#F0C9B8');
  doc.fillColor('#9A3F1B').font('Helvetica-Bold').fontSize(9)
    .text('Documento sem validade fiscal', margem + 10, topoAviso + 8,
      { width: largura - 20 });
  doc.font('Helvetica').fontSize(8).fillColor('#7C3A1D')
    .text('Registra a transação e as condições acordadas. Não substitui nota fiscal.',
      margem + 10, topoAviso + 21, { width: largura - 20 });
  doc.y = topoAviso + alturaAviso;

  // ---------------- partes ----------------
  titulo('Partes');
  linha('Cliente', dados.cliente);
  linha('Fornecedor', `${dados.nome_exibicao} (${dados.tipo_pessoa})`);

  // ---------------- serviço ----------------
  titulo('Serviço contratado');
  linha('Serviço', dados.servico);
  linha('Categoria', dados.categoria);
  linha('Tipo de cobrança', ROTULO_COBRANCA[dados.cobranca] ?? dados.cobranca);

  // ---------------- evento ----------------
  titulo('Evento');
  linha('Data e hora', dataHora(dados.data_hora_evento));
  linha('Duração', `${Number(dados.duracao)} hora(s)`);
  linha('Convidados', dados.numero_convidados);
  linha('Tipo de local', dados.tipo_local);
  linha('Endereço', [
    `${dados.rua}, ${dados.numero}`,
    dados.complemento,
    dados.bairro,
    `${dados.cidade}/${dados.estado}`,
    `CEP ${dados.cep}`,
  ].filter(Boolean).join(' · '));
  if (dados.tema) linha('Tema', dados.tema);
  if (dados.nome_aniversariante) {
    linha('Aniversariante', dados.idade_aniversariante
      ? `${dados.nome_aniversariante}, ${dados.idade_aniversariante} anos`
      : dados.nome_aniversariante);
  }

  // ---------------- valores ----------------
  titulo('Valores');
  linha('Valor de referência', dinheiro(dados.valor_referencia));
  linha('Valor final', dinheiro(dados.valor_final));

  // ---------------- pagamento ----------------
  titulo('Pagamento');
  linha('Forma', ROTULO_FORMA[dados.forma_pagamento] ?? dados.forma_pagamento);
  linha('Data', dataHora(dados.data_pagamento));
  linha('Transação', dados.id_transacao_gateway ?? '—');

  // ---------------- condições de cancelamento ----------------
  // RN050 — os percentuais são os congelados no pagamento, e não os
  // vigentes hoje. É o que dá sentido ao comprovante como prova do acordo.
  titulo('Condições de cancelamento pelo cliente');
  const faixas = [
    ['7 dias ou mais antes do evento', dados.perc_multa_faixa_mais_7d],
    ['Entre 7 dias e 48 horas', dados.perc_multa_faixa_7d_48h],
    ['Entre 48 e 24 horas', dados.perc_multa_faixa_48h_24h],
    ['Menos de 24 horas', dados.perc_multa_faixa_24h],
  ];
  for (const [rotulo, percentual] of faixas) {
    const multa = Number(percentual);
    linha(rotulo, `retenção de ${multa}% · reembolso de ${100 - multa}%`);
  }
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(8).fillColor(CINZA).text(
    'Percentuais vigentes na data da contratação. O cancelamento solicitado pelo '
    + 'fornecedor gera reembolso integral ao cliente, sem retenção.',
    margem, doc.y, { width: largura }
  );

  // ---------------- rodapé ----------------
  doc.moveDown(1.2);
  doc.font('Helvetica').fontSize(8).fillColor(CINZA).text(
    dados.tipo_pessoa === 'PJ'
      ? 'A emissão de nota fiscal de serviço, quando aplicável, é de responsabilidade '
        + 'do fornecedor perante o município em que atua.'
      : 'Fornecedor pessoa física não emite nota fiscal de serviço; este comprovante '
        + 'é o documento da contratação.',
    margem, doc.y, { width: largura }
  );
  doc.moveDown(0.4);
  doc.fontSize(8).fillColor(CINZA).text(
    `Solicitação enviada em ${dataHora(dados.data_solicitacao)}. As condições acima `
    + 'foram registradas no envio e não podem ser alteradas.',
    margem, doc.y, { width: largura }
  );

  doc.end();
  return pronto;
}
