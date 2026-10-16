import PDFDocument from 'pdfkit';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { formatarDataHora } from '@/lib/datas';
import {
  COR, MARGEM, caixaAlta, naBase, fio, cabecalhoDocumento, avisoComFio,
} from '@/lib/pdf-marca';

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
       -- RN029 — a cobrança da CONTRATAÇÃO, congelada na solicitação, e não
       -- a atual do serviço: o fornecedor pode ter trocado "por hora" por
       -- "por pessoa" depois, e o comprovante mostraria uma conta que não
       -- fecha com o valor final.
       JOIN cobranca cb   ON cb.id = so.id_cobranca
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
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    info: { Title: `Comprovante de contratação nº ${dados.id}`, Author: 'Festeirinho' },
  });
  const pedacos = [];
  doc.on('data', (pedaco) => pedacos.push(pedaco));
  const pronto = new Promise((resolver) => {
    doc.on('end', () => resolver(Buffer.concat(pedacos)));
  });

  const largura = doc.page.width - MARGEM * 2;
  const fim = MARGEM + largura;
  const metade = MARGEM + largura / 2;

  // ---------------- cabeçalho ----------------
  //
  // O comprovante é o pedaço do sistema que mais sai da tela: vira anexo
  // de e-mail, impressão, print no WhatsApp. O logo identifica de onde ele
  // veio; sem faixa pintada, a impressão gasta tinta só no que se lê
  // (lib/pdf-marca.js).
  let y = cabecalhoDocumento(doc, {
    titulo: 'Comprovante de contratação',
    linhas: [
      `Solicitação nº ${dados.id}`,
      `Emitido em ${formatarDataHora(new Date())}`,
    ],
  });

  // ---------------- destaque do valor ----------------
  //
  // O que um comprovante responde primeiro é "quanto, como e quando". O
  // destaque vem do tamanho do valor, e não de uma caixa em volta dele.
  y += 26;
  doc.font('Helvetica').fontSize(7.5).fillColor(COR.cinza);
  naBase(doc, 'VALOR PAGO', MARGEM, y, { characterSpacing: 0.8 });
  naBase(doc, 'FORMA DE PAGAMENTO', metade, y, { characterSpacing: 0.8 });

  doc.font('Helvetica-Bold').fontSize(24).fillColor(COR.roxo);
  naBase(doc, dinheiro(dados.valor_final), MARGEM, y + 27);

  doc.font('Helvetica-Bold').fontSize(11).fillColor(COR.escuro);
  naBase(doc, ROTULO_FORMA[dados.forma_pagamento] ?? dados.forma_pagamento, metade, y + 16);
  doc.font('Helvetica').fontSize(8.5).fillColor(COR.cinza);
  naBase(doc, `Pago em ${formatarDataHora(dados.data_pagamento)}`, metade, y + 29);
  naBase(doc, `Transação ${dados.id_transacao_gateway ?? '—'}`, metade, y + 40,
    { width: largura / 2 });
  y += 58;

  // ---------------- aviso ----------------
  //
  // No alto, e não no rodapé: é a informação que muda o que a pessoa pode
  // fazer com o documento (RN059).
  y += avisoComFio(doc, {
    x: MARGEM, y, largura,
    destaque: 'Documento sem validade fiscal',
    texto: 'Registra a transação e as condições acordadas. Não substitui nota fiscal.',
  });
  y += 8;

  // ---------------- peças de seção ----------------
  //
  // Título em caixa alta e roxo; as linhas embaixo, separadas por fios
  // finos. Sem listras: impressas, elas viram faixas cinzentas, e o fio
  // já faz o trabalho de guiar o olho do rótulo ao valor.
  function secao(texto) {
    y += 22;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COR.roxo);
    naBase(doc, texto.toUpperCase(), MARGEM, y + caixaAlta(8.5), { characterSpacing: 0.6 });
    y += caixaAlta(8.5) + 7;
    fio(doc, y);
  }

  // Rótulo à esquerda, valor à direita, os dois na MESMA linha de base. O
  // valor pode quebrar (endereço comprido); a linha cresce com ele.
  const LARGURA_VALOR = largura * 0.6;
  function linha(rotulo, valor) {
    const texto = String(valor);
    doc.font('Helvetica').fontSize(10);
    const alturaTexto = doc.heightOfString(texto, { width: LARGURA_VALOR });
    const base = y + 13;

    doc.font('Helvetica').fontSize(9).fillColor(COR.cinza);
    naBase(doc, rotulo, MARGEM, base, { width: largura - LARGURA_VALOR - 12 });
    doc.font('Helvetica').fontSize(10).fillColor(COR.escuro)
      .text(texto, fim - LARGURA_VALOR, base, {
        width: LARGURA_VALOR, align: 'right', baseline: 'alphabetic',
      });

    y += alturaTexto + 8;
    fio(doc, y);
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
    `CEP ${String(dados.cep).replace(/^(\d{5})(\d{3})$/, '$1-$2')}`,
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

  const LARGURA_PERCENTUAL = 80;
  const xReembolso = fim - LARGURA_PERCENTUAL;
  const xRetencao = xReembolso - LARGURA_PERCENTUAL;
  {
    const base = y + 12;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COR.cinza);
    naBase(doc, 'QUANDO', MARGEM, base, { characterSpacing: 0.5 });
    naBase(doc, 'RETENÇÃO', xRetencao, base,
      { width: LARGURA_PERCENTUAL, align: 'right', characterSpacing: 0.5 });
    naBase(doc, 'REEMBOLSO', xReembolso, base,
      { width: LARGURA_PERCENTUAL, align: 'right', characterSpacing: 0.5 });
    y += 18;
    fio(doc, y);
  }

  const faixas = [
    ['7 dias ou mais antes do evento', dados.perc_multa_faixa_mais_7d],
    ['Entre 7 dias e 48 horas', dados.perc_multa_faixa_7d_48h],
    ['Entre 48 e 24 horas', dados.perc_multa_faixa_48h_24h],
    ['Menos de 24 horas', dados.perc_multa_faixa_24h],
  ];
  for (const [rotulo, percentual] of faixas) {
    const multa = Number(percentual);
    const base = y + 12.5;
    doc.font('Helvetica').fontSize(9).fillColor(COR.escuro);
    naBase(doc, rotulo, MARGEM, base);
    doc.font('Helvetica-Bold');
    naBase(doc, `${multa}%`, xRetencao, base, { width: LARGURA_PERCENTUAL, align: 'right' });
    naBase(doc, `${100 - multa}%`, xReembolso, base, { width: LARGURA_PERCENTUAL, align: 'right' });
    y += 18;
    fio(doc, y);
  }

  y += 10;
  doc.font('Helvetica').fontSize(8).fillColor(COR.cinza).text(
    'Percentuais vigentes na data da contratação. O cancelamento solicitado pelo '
    + 'fornecedor gera reembolso integral ao cliente, sem retenção.',
    MARGEM, y, { width: largura }
  );
  y = doc.y;

  // ---------------- rodapé ----------------
  //
  // Preso ao pé da página, para ficar no mesmo lugar em todo comprovante —
  // mas nunca por cima do conteúdo. Um endereço comprido ou um tema e um
  // aniversariante preenchidos empurram as seções para baixo, e aí o
  // rodapé desce junto em vez de atropelar o texto.
  const topoRodape = Math.max(y + 18, doc.page.height - MARGEM - 46);
  fio(doc, topoRodape);

  doc.font('Helvetica').fontSize(7.5).fillColor(COR.cinza).text(
    dados.tipo_pessoa === 'PJ'
      ? 'A emissão de nota fiscal de serviço, quando aplicável, é de responsabilidade '
        + 'do fornecedor perante o município em que atua.'
      : 'Fornecedor pessoa física não emite nota fiscal de serviço; este comprovante '
        + 'é o documento da contratação.',
    MARGEM, topoRodape + 9, { width: largura }
  );
  doc.text(
    `Solicitação enviada em ${formatarDataHora(dados.data_solicitacao)}. `
    + 'As condições acima foram registradas no envio e não podem ser alteradas.',
    MARGEM, doc.y + 2, { width: largura }
  );

  doc.end();
  return pronto;
}
