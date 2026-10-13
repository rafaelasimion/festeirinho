import path from 'node:path';
import PDFDocument from 'pdfkit';
import { formatarData, formatarDataHora } from '@/lib/datas';
import {
  ROTULO_ORIGEM_CURTO,
  formatarDinheiro,
  formatarPercentual,
} from '@/lib/relatorio-financeiro';

// Módulo de servidor: o pdfkit lê arquivos do disco. Só a rota do relatório
// o importa.
//
// RF056 / UC 032 — o relatório em PDF, no mesmo desenho do comprovante de
// contratação (RF058): faixa roxa com a marca, os valores que respondem à
// pergunta do documento em destaque e a tabela em listras.
//
// A página segue duas regras, e é delas que vem o alinhamento:
//
// 1. Duas linhas verticais. Bordas de caixa, listras, fios e a barrinha
//    dos títulos começam na MARGEM. Todo texto que mora dentro de uma
//    delas começa na MARGEM + RECUO — o título da seção, a primeira coluna
//    da tabela, o "Total do mês", as notas e o texto das caixas. Antes cada
//    peça tinha o seu recuo (5, 10, 14, 18), e o olho via a escada.
//
// 2. Texto apoiado na linha de base, e não pelo alto da linha. O pdfkit
//    posiciona pelo alto, e um corpo menor ao lado de um maior sobe: era o
//    que desalinhava os três valores do resumo (16 e 20 pontos lado a
//    lado). Com baseline 'alphabetic', o y é a própria linha onde as letras
//    se apoiam, e corpos diferentes ficam na mesma linha. É a mesma solução
//    do rótulo e valor do comprovante.
//
// A tabela tem uma linha por repasse. O percentual da comissão, que antes
// ia numa segunda linha embaixo do valor e fazia toda linha da tabela ter
// altura dupla, ganhou coluna própria (TAXA).

const ROXO = '#534AB7';
const ROXO_CLARO = '#D4D2ED';
const FUNDO_DESTAQUE = '#F6F6FB';
const CINZA = '#64748B';
const ESCURO = '#0F172A';
const LISTRA = '#F8FAFC';
const FIO = '#E2E8F0';
const ATENCAO_FUNDO = '#FCF3F1';
const ATENCAO_BORDA = '#F3CEC1';
const ATENCAO_TEXTO = '#8A3A1F';

const MARGEM = 48;
const RECUO = 12;
const ALTURA_FAIXA = 124;
// Abaixo disto fica o rodapé; nenhuma linha da tabela passa daqui.
const RESERVA_RODAPE = 64;

const CORPO_TABELA = 8.5;
const ALTURA_LINHA = 20;

// Altura das maiúsculas da Helvetica (718/1000 do corpo), regular e negrito.
// É o que centraliza a barrinha do título e o texto de uma linha.
const caixaAlta = (corpo) => (718 / 1000) * corpo;
const alturaX = (corpo) => (523 / 1000) * corpo;

// Texto apoiado na linha de base `base`.
function naBase(doc, texto, x, base, opcoes = {}) {
  doc.text(String(texto), x, base, { lineBreak: false, ...opcoes, baseline: 'alphabetic' });
}

export function montarPdfRelatorio(relatorio) {
  const { periodo, fornecedor, total, servicos, multas, repasses } = relatorio;

  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    // As páginas ficam em memória até o fim, para o rodapé poder dizer
    // "página 1 de 3" — o total só é conhecido depois da última linha.
    bufferPages: true,
    info: {
      Title: `Relatório financeiro mensal — ${periodo.rotulo}`,
      Author: 'Festeirinho',
    },
  });
  const pedacos = [];
  doc.on('data', (pedaco) => pedacos.push(pedaco));
  const pronto = new Promise((resolver) => {
    doc.on('end', () => resolver(Buffer.concat(pedacos)));
  });

  const largura = doc.page.width - MARGEM * 2;
  const fim = MARGEM + largura;
  const texto = MARGEM + RECUO;
  const limite = () => doc.page.height - RESERVA_RODAPE;
  let y;

  // ---------------- faixa do cabeçalho ----------------
  doc.rect(0, 0, doc.page.width, ALTURA_FAIXA).fill(ROXO);
  try {
    // PNG porque o pdfkit não lê webp. Sem o arquivo, o relatório sai
    // assim mesmo, com o nome escrito no lugar do logo.
    doc.image(
      path.join(process.cwd(), 'public', 'logo-festeirinho-completo.png'),
      MARGEM, 20, { width: 124 }
    );
  } catch {
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#FFFFFF');
    naBase(doc, 'Festeirinho', MARGEM, 68);
  }

  doc.font('Helvetica-Bold').fontSize(13).fillColor('#FFFFFF');
  naBase(doc, 'Relatório financeiro mensal', MARGEM, 56, { width: largura, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(ROXO_CLARO);
  naBase(doc, `Referência: ${periodo.titulo}`, MARGEM, 73, { width: largura, align: 'right' });
  naBase(doc, `Emitido em ${formatarDataHora(relatorio.emitidoEm)}`, MARGEM, 86,
    { width: largura, align: 'right' });

  // ---------------- quem é o fornecedor ----------------
  //
  // O relatório costuma ir para o contador. O nome de exibição sozinho não
  // identifica ninguém fora da plataforma; o titular e o documento, sim.
  // Texto solto, sem caixa, por isso na MARGEM.
  y = ALTURA_FAIXA + 22;
  const metade = largura / 2;
  doc.font('Helvetica').fontSize(7.5).fillColor(CINZA);
  naBase(doc, 'FORNECEDOR', MARGEM, y, { characterSpacing: 0.8 });
  naBase(doc, 'TITULAR', MARGEM + metade, y, { characterSpacing: 0.8 });

  const baseNome = y + 15;
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(ESCURO);
  const linhaNome = doc.currentLineHeight(true);
  const altNome = doc.heightOfString(fornecedor.nomeExibicao, { width: metade - 16 });
  const altTitular = doc.heightOfString(fornecedor.titular ?? '—', { width: metade });
  doc.text(fornecedor.nomeExibicao, MARGEM, baseNome,
    { width: metade - 16, baseline: 'alphabetic' });
  doc.text(fornecedor.titular ?? '—', MARGEM + metade, baseNome,
    { width: metade, baseline: 'alphabetic' });

  let baixo = baseNome + Math.max(altNome, altTitular) - linhaNome;
  if (fornecedor.documento) {
    const baseDocumento = baseNome + altTitular - linhaNome + 13;
    doc.font('Helvetica').fontSize(9).fillColor(CINZA);
    naBase(doc, fornecedor.documento, MARGEM + metade, baseDocumento);
    baixo = Math.max(baixo, baseDocumento);
  }
  y = baixo + 20;

  // ---------------- mês em andamento ----------------
  if (relatorio.parcial) {
    const altura = 26;
    doc.roundedRect(MARGEM, y, largura, altura, 6).fillAndStroke(ATENCAO_FUNDO, ATENCAO_BORDA);
    const base = y + altura / 2 + caixaAlta(9) / 2;
    const destaque = 'Mês em andamento.';
    doc.font('Helvetica-Bold').fontSize(9).fillColor(ATENCAO_TEXTO);
    naBase(doc, destaque, texto, base);
    const larguraDestaque = doc.widthOfString(destaque);
    doc.font('Helvetica').fontSize(9);
    naBase(doc, ' O relatório reúne os repasses liberados até a data de emissão.',
      texto + larguraDestaque, base);
    y += altura + 12;
  }

  // ---------------- destaque dos valores ----------------
  //
  // As três respostas que o documento existe para dar (RN058): quanto foi
  // repassado, quanto ficou de comissão e quanto o fornecedor recebeu.
  // Rótulos, valores e detalhes em três linhas de base comuns às três
  // colunas; o líquido é maior e roxo, mas apoiado na mesma linha.
  const alturaDestaque = 80;
  doc.roundedRect(MARGEM, y, largura, alturaDestaque, 8).fillAndStroke(FUNDO_DESTAQUE, ROXO_CLARO);
  const terco = largura / 3;
  const baseRotulo = y + 22;
  const baseValor = y + 48;
  const baseDetalhe = y + 66;
  const destaques = [
    {
      rotulo: 'VALOR BRUTO',
      valor: formatarDinheiro(total.bruto),
      detalhe: total.quantidade === 1 ? '1 repasse liberado' : `${total.quantidade} repasses liberados`,
      corpo: 16,
      cor: ESCURO,
    },
    {
      rotulo: 'COMISSÃO RETIDA',
      valor: formatarDinheiro(total.comissao),
      detalhe: 'sobre os serviços concluídos',
      corpo: 16,
      cor: ESCURO,
    },
    {
      rotulo: 'VALOR LÍQUIDO RECEBIDO',
      valor: formatarDinheiro(total.liquido),
      detalhe: `em ${periodo.rotulo}`,
      corpo: 20,
      cor: ROXO,
    },
  ];
  destaques.forEach((item, indice) => {
    const x = texto + terco * indice;
    const larguraColuna = terco - RECUO * 2;
    doc.font('Helvetica').fontSize(7.5).fillColor(CINZA);
    naBase(doc, item.rotulo, x, baseRotulo, { characterSpacing: 0.8, width: larguraColuna });
    doc.font('Helvetica-Bold').fontSize(item.corpo).fillColor(item.cor);
    naBase(doc, item.valor, x, baseValor, { width: larguraColuna });
    doc.font('Helvetica').fontSize(8).fillColor(CINZA);
    naBase(doc, item.detalhe, x, baseDetalhe, { width: larguraColuna });
  });
  y += alturaDestaque + 24;

  // ---------------- título de seção ----------------
  //
  // A barrinha roxa fica centrada na altura das maiúsculas do título, com
  // folga igual em cima e embaixo — antes ela descia três pontos abaixo da
  // linha do texto. O texto começa no RECUO, na mesma linha vertical da
  // primeira coluna da tabela logo abaixo.
  function tituloSecao(rotulo) {
    const corpo = 9;
    const base = y + caixaAlta(corpo);
    const folga = 2;
    doc.rect(MARGEM, base - caixaAlta(corpo) - folga, 3, caixaAlta(corpo) + folga * 2).fill(ROXO);
    doc.font('Helvetica-Bold').fontSize(corpo).fillColor(ROXO);
    naBase(doc, rotulo.toUpperCase(), texto, base, { characterSpacing: 0.6 });
    y = base + 14;
  }

  // ---------------- tabela ----------------
  //
  // Cada coluna tem uma área de texto: 4 pontos de folga de cada lado, e o
  // RECUO por fora nas duas pontas, para a primeira e a última coluna
  // ficarem alinhadas ao resto da página. As colunas de valor foram medidas
  // para "R$ 999.999,99" caber numa linha; o serviço fica com o que sobra.
  // A data sai sem o ano: o relatório é de um mês só, e o ano está no título.
  const FOLGA = 4;
  const COLUNAS = [
    { chave: 'data', titulo: 'DATA', largura: 46 },
    { chave: 'solicitacao', titulo: 'SOLIC.', largura: 42 },
    { chave: 'servico', titulo: 'SERVIÇO', largura: 0 },
    { chave: 'origem', titulo: 'ORIGEM', largura: 50 },
    { chave: 'bruto', titulo: 'BRUTO', largura: 66, direita: true },
    { chave: 'taxa', titulo: 'TAXA', largura: 38, direita: true },
    { chave: 'comissao', titulo: 'COMISSÃO', largura: 62, direita: true },
    { chave: 'liquido', titulo: 'LÍQUIDO', largura: 74, direita: true },
  ];
  const fixas = COLUNAS.reduce((soma, coluna) => soma + coluna.largura, 0);
  COLUNAS.find((coluna) => coluna.chave === 'servico').largura = largura - fixas;
  {
    let x = MARGEM;
    COLUNAS.forEach((coluna, indice) => {
      const esquerda = indice === 0 ? RECUO : FOLGA;
      const direita = indice === COLUNAS.length - 1 ? RECUO : FOLGA;
      coluna.x = x + esquerda;
      coluna.area = coluna.largura - esquerda - direita;
      x += coluna.largura;
    });
  }
  const coluna = Object.fromEntries(COLUNAS.map((c) => [c.chave, c]));

  function celula(chave, valor, base, opcoes = {}) {
    const c = coluna[chave];
    naBase(doc, valor, c.x, base, {
      width: c.area,
      align: c.direita ? 'right' : 'left',
      ...opcoes,
    });
  }

  function cabecalhoTabela() {
    const base = y + caixaAlta(7.5);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(CINZA);
    for (const c of COLUNAS) celula(c.chave, c.titulo, base, { characterSpacing: 0.4 });
    y = base + 6;
    doc.moveTo(MARGEM, y).lineTo(fim, y).strokeColor(FIO).lineWidth(1).stroke();
  }

  // Página nova com o cabeçalho da tabela repetido: quem lê a página 2 não
  // deve precisar voltar à 1 para saber o que é cada coluna.
  function novaPagina() {
    doc.addPage({ size: 'A4', margin: 0 });
    y = MARGEM;
    doc.font('Helvetica').fontSize(8).fillColor(CINZA);
    naBase(doc, `Relatório financeiro mensal · ${periodo.titulo} (continuação)`, MARGEM, y + 6);
    y += 24;
    cabecalhoTabela();
  }

  // Linha de uma altura só (ALTURA_LINHA), com o texto centrado nela pela
  // altura das maiúsculas. Só o nome do serviço quebra, e aí a linha cresce
  // de uma linha de texto por vez, com a primeira linha de base no mesmo
  // lugar de sempre.
  doc.font('Helvetica').fontSize(CORPO_TABELA);
  const linhaTexto = doc.currentLineHeight(true);
  const baseNaLinha = ALTURA_LINHA / 2 + caixaAlta(CORPO_TABELA) / 2;

  tituloSecao('Repasses liberados no mês');

  if (repasses.length === 0) {
    // UC 032, fluxo 6a — o relatório sai mesmo sem movimentação, dizendo isso.
    const altura = 46;
    doc.roundedRect(MARGEM, y, largura, altura, 6).fillAndStroke(LISTRA, FIO);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ESCURO);
    naBase(doc, `Nenhum repasse foi liberado em ${periodo.rotulo}.`, texto, y + 19);
    doc.font('Helvetica').fontSize(8.5).fillColor(CINZA);
    naBase(doc, 'Não houve movimentação financeira no período.', texto, y + 33);
    y += altura + 26;
  } else {
    cabecalhoTabela();

    repasses.forEach((repasse, indice) => {
      const ehMulta = repasse.origem === 'multa';
      doc.font('Helvetica').fontSize(CORPO_TABELA);
      const linhasServico = Math.max(1, Math.round(
        doc.heightOfString(repasse.servico, { width: coluna.servico.area }) / linhaTexto
      ));
      const altura = ALTURA_LINHA + (linhasServico - 1) * linhaTexto;

      if (y + altura > limite()) novaPagina();

      if (indice % 2 === 0) doc.rect(MARGEM, y, largura, altura).fill(LISTRA);
      const base = y + baseNaLinha;

      doc.font('Helvetica').fontSize(CORPO_TABELA).fillColor(ESCURO);
      celula('data', formatarData(repasse.dataRepasse).slice(0, 5), base);
      celula('solicitacao', `nº ${repasse.idSolicitacao}`, base);
      celula('servico', repasse.servico, base, { lineBreak: true });
      celula('origem', ROTULO_ORIGEM_CURTO[repasse.origem], base);
      celula('bruto', formatarDinheiro(repasse.valorBruto), base);
      // Na multa a taxa é "—", e não "0%": não é uma comissão de zero por
      // cento, é um repasse sobre o qual não incide comissão (RN058).
      doc.fillColor(ehMulta ? CINZA : ESCURO);
      celula('taxa', ehMulta ? '—' : formatarPercentual(repasse.percentualComissao), base);
      doc.fillColor(ESCURO);
      celula('comissao', formatarDinheiro(repasse.valorComissao), base);
      doc.font('Helvetica-Bold');
      celula('liquido', formatarDinheiro(repasse.valorLiquido), base);

      y += altura;
    });

    // Subtotais por origem, nas mesmas colunas de valor da tabela. Só
    // aparecem quando há as duas origens no mês; com uma só, o subtotal
    // repetiria o total da linha de baixo.
    const subtotais = servicos.quantidade > 0 && multas.quantidade > 0
      ? [
        [`Serviços concluídos (${servicos.quantidade})`, servicos],
        [`Multas por cancelamento (${multas.quantidade})`, multas],
      ]
      : [];
    const alturaTotal = 24;
    const alturaFecho = subtotais.length * ALTURA_LINHA + alturaTotal;
    if (y + alturaFecho > limite()) novaPagina();

    if (subtotais.length > 0) {
      doc.moveTo(MARGEM, y).lineTo(fim, y).strokeColor(FIO).lineWidth(1).stroke();
      for (const [rotulo, soma] of subtotais) {
        const base = y + baseNaLinha;
        doc.font('Helvetica').fontSize(CORPO_TABELA).fillColor(CINZA);
        naBase(doc, rotulo, texto, base);
        celula('bruto', formatarDinheiro(soma.bruto), base);
        celula('comissao', formatarDinheiro(soma.comissao), base);
        celula('liquido', formatarDinheiro(soma.liquido), base);
        y += ALTURA_LINHA;
      }
    }

    doc.moveTo(MARGEM, y).lineTo(fim, y).strokeColor(ROXO).lineWidth(1.2).stroke();
    const base = y + alturaTotal / 2 + caixaAlta(CORPO_TABELA) / 2 + 1;
    doc.font('Helvetica-Bold').fontSize(CORPO_TABELA).fillColor(ESCURO);
    naBase(doc, 'Total do mês', texto, base);
    celula('bruto', formatarDinheiro(total.bruto), base);
    celula('comissao', formatarDinheiro(total.comissao), base);
    doc.fillColor(ROXO);
    celula('liquido', formatarDinheiro(total.liquido), base);
    y += alturaTotal + 26;
  }

  // ---------------- como ler ----------------
  const notas = [
    'Entram os repasses liberados no mês de referência, pela data da liberação. '
      + 'Valores ainda em carência na data de emissão aparecem no relatório do mês em que forem liberados.',
    'Na coluna Origem, Serviço é o repasse de um serviço concluído, e Multa, a multa de um '
      + 'cancelamento pedido pelo cliente.',
    'A taxa de comissão de cada serviço é a vigente na data da contratação. '
      + 'As multas são repassadas integralmente, sem comissão.',
    'Saques e saldo disponível não fazem parte deste relatório e podem ser consultados no painel financeiro.',
  ];
  const CORPO_NOTA = 8;
  const larguraNota = largura - RECUO;
  doc.font('Helvetica').fontSize(CORPO_NOTA);
  const alturaNotas = notas.reduce(
    (soma, nota) => soma + doc.heightOfString(nota, { width: larguraNota }) + 5, 30
  );
  if (y + alturaNotas > limite()) {
    doc.addPage({ size: 'A4', margin: 0 });
    y = MARGEM;
  }
  tituloSecao('Como ler este relatório');
  for (const nota of notas) {
    const base = y + caixaAlta(CORPO_NOTA);
    // O ponto fica na linha da barrinha do título, à esquerda do recuo.
    doc.circle(MARGEM + 1.5, base - alturaX(CORPO_NOTA) / 2, 1.3).fill(CINZA);
    doc.font('Helvetica').fontSize(CORPO_NOTA).fillColor(CINZA);
    doc.text(nota, texto, base, { width: larguraNota, baseline: 'alphabetic' });
    y += doc.heightOfString(nota, { width: larguraNota }) + 5;
  }

  // ---------------- rodapé de todas as páginas ----------------
  const paginas = doc.bufferedPageRange();
  for (let i = paginas.start; i < paginas.start + paginas.count; i += 1) {
    doc.switchToPage(i);
    const linha = doc.page.height - MARGEM - 8;
    doc.moveTo(MARGEM, linha).lineTo(fim, linha).strokeColor(FIO).lineWidth(1).stroke();
    const base = linha + 15;
    doc.font('Helvetica').fontSize(7.5).fillColor(CINZA);
    naBase(doc, `Festeirinho · Relatório financeiro mensal · ${periodo.titulo}`, MARGEM, base);
    naBase(doc, `Página ${i - paginas.start + 1} de ${paginas.count}`, MARGEM, base,
      { width: largura, align: 'right' });
  }

  doc.end();
  return pronto;
}
