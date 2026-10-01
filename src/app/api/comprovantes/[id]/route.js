import path from 'node:path';
import PDFDocument from 'pdfkit';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { formatarDataHora } from '@/lib/datas';

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
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const pedacos = [];
  doc.on('data', (pedaco) => pedacos.push(pedaco));
  const pronto = new Promise((resolver) => {
    doc.on('end', () => resolver(Buffer.concat(pedacos)));
  });

  const margem = 48;
  const largura = doc.page.width - margem * 2;
  const fim = doc.page.width - margem;

  // ---------------- faixa do cabeçalho ----------------
  //
  // O comprovante é o único pedaço do sistema que sai da tela: vira
  // anexo de e-mail, impressão, print no WhatsApp. A faixa roxa com a
  // marca é o que faz alguém reconhecer de onde ele veio sem ler.
  // A faixa acomoda o logo com o mascote, que é quase quadrado — bem mais
  // alto que o logo só escrito, para a mesma largura.
  const ALTURA_FAIXA = 124;
  doc.rect(0, 0, doc.page.width, ALTURA_FAIXA).fill(ROXO);

  try {
    // O logo é PNG porque o pdfkit não lê webp. Se o arquivo faltar, o
    // comprovante sai assim mesmo — ele não pode falhar por causa de uma
    // imagem.
    doc.image(
      path.join(process.cwd(), 'public', 'logo-festeirinho-completo.png'),
      margem, 20, { width: 124 }
    );
  } catch {
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#FFFFFF')
      .text('Festeirinho', margem, 46);
  }

  doc.font('Helvetica-Bold').fontSize(13).fillColor('#FFFFFF')
    .text('Comprovante de contratação', margem, 44, { width: largura, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#D4D2ED')
    .text(`Solicitação nº ${dados.id}`, margem, 64, { width: largura, align: 'right' })
    .text(`Emitido em ${formatarDataHora(new Date())}`,
      margem, 77, { width: largura, align: 'right' });

  // ---------------- destaque do valor ----------------
  //
  // O que um comprovante responde primeiro é "quanto, como e quando".
  // Antes esses três dados eram três linhas no meio de vinte iguais, e o
  // valor pago pesava o mesmo que o tipo de local.
  const topoValor = ALTURA_FAIXA + 14;
  const alturaValor = 78;
  doc.roundedRect(margem, topoValor, largura, alturaValor, 10)
    .fillAndStroke('#F6F6FB', '#D4D2ED');

  doc.font('Helvetica').fontSize(8).fillColor(CINZA)
    .text('VALOR PAGO', margem + 18, topoValor + 16, { characterSpacing: 0.8 });
  doc.font('Helvetica-Bold').fontSize(25).fillColor(ROXO)
    .text(dinheiro(dados.valor_final), margem + 18, topoValor + 28);

  doc.font('Helvetica').fontSize(8).fillColor(CINZA)
    .text('FORMA', margem + largura / 2, topoValor + 16, { characterSpacing: 0.8 });
  doc.font('Helvetica-Bold').fontSize(11).fillColor(ESCURO)
    .text(ROTULO_FORMA[dados.forma_pagamento] ?? dados.forma_pagamento,
      margem + largura / 2, topoValor + 30);
  doc.font('Helvetica').fontSize(9).fillColor(CINZA)
    .text(`Pago em ${formatarDataHora(dados.data_pagamento)}`,
      margem + largura / 2, topoValor + 46)
    .text(`Transação ${dados.id_transacao_gateway ?? '—'}`,
      margem + largura / 2, topoValor + 58, { width: largura / 2 - 18 });

  doc.y = topoValor + alturaValor + 12;

  // ---------------- aviso ----------------
  //
  // No alto, e não no rodapé: é a informação que muda o que a pessoa pode
  // fazer com o documento (RN059).
  const topoAviso = doc.y;
  const alturaAviso = 34;
  doc.roundedRect(margem, topoAviso, largura, alturaAviso, 8)
    .fillAndStroke('#FCF3F1', '#F3CEC1');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#8A3A1F')
    .text('Documento sem validade fiscal', margem + 14, topoAviso + 8);
  doc.font('Helvetica').fontSize(8).fillColor('#B14A27')
    .text('Registra a transação e as condições acordadas. Não substitui nota fiscal.',
      margem + 14, topoAviso + 20);
  doc.y = topoAviso + alturaAviso + 6;

  // ---------------- peças de seção ----------------
  function titulo(texto) {
    doc.moveDown(0.7);
    const y = doc.y;
    // Marcador roxo à esquerda do título: separa as seções sem gastar uma
    // linha inteira com régua, que era o que fatiava a página antes.
    doc.rect(margem, y + 1, 3, 10).fill(ROXO);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(ROXO)
      .text(texto.toUpperCase(), margem + 10, y, { width: largura - 10, characterSpacing: 0.6 });
    doc.moveDown(0.5);
  }

  // Rótulo à esquerda, valor à direita, com um fundo alternado muito leve:
  // em vinte linhas iguais o olho perde a correspondência entre as duas
  // colunas no meio do caminho.
  let listra = 0;
  function linha(rotulo, valor) {
    const texto = String(valor);
    const y = doc.y;
    const alturaTexto = doc.font('Helvetica').fontSize(10)
      .heightOfString(texto, { width: largura * 0.58 - 12 });
    const altura = Math.max(alturaTexto, 12) + 6;

    if (listra % 2 === 0) {
      doc.rect(margem, y - 3, largura, altura).fill('#F8FAFC');
    }
    listra += 1;

    // Rótulo e valor compartilham a MESMA linha de base.
    //
    // Antes os dois eram desenhados a partir do topo, e como o rótulo tem
    // 9pt e o valor 10pt, a letra menor subia: o pdfkit posiciona pelo
    // alto da linha, e uma fonte menor tem a base mais acima. Com
    // baseline: 'alphabetic', o y passa a ser a própria linha de base, e
    // os dois se apoiam nela independentemente do corpo.
    const base = y + 8;
    doc.font('Helvetica').fontSize(9).fillColor(CINZA)
      .text(rotulo, margem + 8, base, {
        width: largura * 0.42 - 16, baseline: 'alphabetic',
      });
    doc.font('Helvetica').fontSize(10).fillColor(ESCURO)
      .text(texto, margem + largura * 0.42, base, {
        width: largura * 0.58 - 8, align: 'right', baseline: 'alphabetic',
      });
    doc.y = y + altura;
  }

  // A listra recomeça em cada seção, senão a alternância fica à mercê de
  // quantas linhas a seção anterior teve.
  function secao(texto) {
    titulo(texto);
    listra = 0;
  }

  // ---------------- partes ----------------
  secao('Partes');
  linha('Cliente', dados.cliente);
  linha('Fornecedor', `${dados.nome_exibicao} (${dados.tipo_pessoa})`);

  // ---------------- serviço ----------------
  secao('Serviço contratado');
  linha('Serviço', dados.servico);
  linha('Categoria', dados.categoria);
  linha('Tipo de cobrança', ROTULO_COBRANCA[dados.cobranca] ?? dados.cobranca);
  linha('Valor de referência', dinheiro(dados.valor_referencia));

  // ---------------- evento ----------------
  secao('Evento');
  linha('Data e hora', formatarDataHora(dados.data_hora_evento));
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

  // ---------------- condições de cancelamento ----------------
  // RN050 — os percentuais são os congelados no pagamento, e não os
  // vigentes hoje. É o que dá sentido ao comprovante como prova do acordo.
  secao('Se o cliente cancelar');

  const COLUNA = [margem + 8, margem + largura * 0.52, margem + largura * 0.76];
  doc.font('Helvetica-Bold').fontSize(8).fillColor(CINZA);
  const yCabecalho = doc.y;
  doc.text('QUANDO', COLUNA[0], yCabecalho, { characterSpacing: 0.5 });
  doc.text('RETENÇÃO', COLUNA[1], yCabecalho,
    { width: largura * 0.2, align: 'right', characterSpacing: 0.5 });
  doc.text('REEMBOLSO', COLUNA[2], yCabecalho,
    { width: largura * 0.22, align: 'right', characterSpacing: 0.5 });
  doc.y = yCabecalho + 14;

  const faixas = [
    ['7 dias ou mais antes do evento', dados.perc_multa_faixa_mais_7d],
    ['Entre 7 dias e 48 horas', dados.perc_multa_faixa_7d_48h],
    ['Entre 48 e 24 horas', dados.perc_multa_faixa_48h_24h],
    ['Menos de 24 horas', dados.perc_multa_faixa_24h],
  ];
  faixas.forEach(([rotulo, percentual], indice) => {
    const multa = Number(percentual);
    const y = doc.y;
    if (indice % 2 === 0) doc.rect(margem, y - 3, largura, 18).fill('#F8FAFC');
    const base = y + 7;
    doc.font('Helvetica').fontSize(9).fillColor(ESCURO)
      .text(rotulo, COLUNA[0], base, { baseline: 'alphabetic' });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#B14A27')
      .text(`${multa}%`, COLUNA[1], base,
        { width: largura * 0.2, align: 'right', baseline: 'alphabetic' });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0C5A47')
      .text(`${100 - multa}%`, COLUNA[2], base,
        { width: largura * 0.22, align: 'right', baseline: 'alphabetic' });
    doc.y = y + 14;
  });

  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(8).fillColor(CINZA).text(
    'Percentuais vigentes na data da contratação. O cancelamento solicitado pelo '
    + 'fornecedor gera reembolso integral ao cliente, sem retenção.',
    margem + 8, doc.y, { width: largura - 16 }
  );

  // ---------------- rodapé ----------------
  //
  // Preso ao pé da página, para ficar no mesmo lugar em todo comprovante —
  // mas nunca por cima do conteúdo. Um endereço comprido ou um tema e um
  // aniversariante preenchidos empurram as seções para baixo, e aí o
  // rodapé desce junto em vez de atropelar o texto.
  const topoRodape = Math.max(doc.y + 18, doc.page.height - margem - 54);
  doc.moveTo(margem, topoRodape).lineTo(fim, topoRodape)
    .strokeColor('#E2E8F0').lineWidth(1).stroke();

  doc.font('Helvetica').fontSize(8).fillColor(CINZA).text(
    dados.tipo_pessoa === 'PJ'
      ? 'A emissão de nota fiscal de serviço, quando aplicável, é de responsabilidade '
        + 'do fornecedor perante o município em que atua.'
      : 'Fornecedor pessoa física não emite nota fiscal de serviço; este comprovante '
        + 'é o documento da contratação.',
    margem, topoRodape + 10, { width: largura }
  );
  doc.fontSize(8).fillColor(CINZA).text(
    `Solicitação enviada em ${formatarDataHora(dados.data_solicitacao)}. `
    + 'As condições acima foram registradas no envio e não podem ser alteradas.',
    margem, doc.y + 2, { width: largura }
  );

  doc.end();
  return pronto;
}
