import PDFDocument from 'pdfkit';
import { formatarData, formatarDataHora } from '@/lib/datas';
import {
  COR, MARGEM, caixaAlta, naBase, fio, cabecalhoDocumento, avisoComFio,
} from '@/lib/pdf-marca';
import {
  ROTULO_ORIGEM_CURTO,
  formatarDinheiro,
  formatarPercentual,
} from '@/lib/relatorio-financeiro';

// Módulo de servidor: o pdfkit lê arquivos do disco. Só a rota do relatório
// o importa.
//
// RF056 / UC 032 — o relatório em PDF, no mesmo desenho do comprovante de
// contratação (RF058): o logo no alto, os valores que respondem à pergunta
// do documento em destaque e a tabela separada por fios. É um documento
// para imprimir e mandar ao contador, então nada é pintado: cor só em
// texto e em fios finos (lib/pdf-marca.js).
//
// A página segue duas regras, e é delas que vem o alinhamento:
//
// 1. Uma linha vertical só. Sem caixas nem listras, não há borda para o
//    texto se afastar: fios, títulos, a primeira coluna da tabela, o
//    "Total do mês" e as notas começam todos na MARGEM.
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

const { roxo: ROXO, cinza: CINZA, escuro: ESCURO } = COR;

// Abaixo disto fica o rodapé; nenhuma linha da tabela passa daqui.
const RESERVA_RODAPE = 64;

const CORPO_TABELA = 8.5;
const ALTURA_LINHA = 20;

// Altura do "x" da Helvetica: centra o ponto das notas na letra minúscula.
const alturaX = (corpo) => (523 / 1000) * corpo;

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
  const limite = () => doc.page.height - RESERVA_RODAPE;
  let y;

  // ---------------- cabeçalho ----------------
  y = cabecalhoDocumento(doc, {
    titulo: 'Relatório financeiro mensal',
    linhas: [
      `Referência: ${periodo.titulo}`,
      `Emitido em ${formatarDataHora(relatorio.emitidoEm)}`,
    ],
  });

  // ---------------- quem é o fornecedor ----------------
  //
  // O relatório costuma ir para o contador. O nome de exibição sozinho não
  // identifica ninguém fora da plataforma; o titular e o documento, sim.
  y += 26;
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
    y += avisoComFio(doc, {
      x: MARGEM, y, largura,
      destaque: 'Mês em andamento',
      texto: 'O relatório reúne os repasses liberados até a data de emissão.',
    });
    y += 16;
  }

  // ---------------- destaque dos valores ----------------
  //
  // As três respostas que o documento existe para dar (RN058): quanto foi
  // repassado, quanto ficou de comissão e quanto o fornecedor recebeu.
  // Rótulos, valores e detalhes em três linhas de base comuns às três
  // colunas; o líquido é maior e roxo, mas apoiado na mesma linha. Dois
  // fios marcam a faixa, no lugar da caixa pintada.
  const alturaDestaque = 80;
  fio(doc, y);
  fio(doc, y + alturaDestaque);
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
    const x = MARGEM + terco * indice;
    const larguraColuna = terco - 12;
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
  // Caixa alta em roxo, sem a barrinha pintada ao lado: é o mesmo título
  // do comprovante.
  function tituloSecao(rotulo) {
    const corpo = 8.5;
    const base = y + caixaAlta(corpo);
    doc.font('Helvetica-Bold').fontSize(corpo).fillColor(ROXO);
    naBase(doc, rotulo.toUpperCase(), MARGEM, base, { characterSpacing: 0.6 });
    y = base + 14;
  }

  // ---------------- tabela ----------------
  //
  // Cada coluna tem uma área de texto, com 4 pontos de folga de cada lado
  // entre colunas; nas duas pontas não há folga, para a primeira e a última
  // coluna ficarem na MARGEM, alinhadas ao resto da página. As colunas de valor foram medidas
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
      const esquerda = indice === 0 ? 0 : FOLGA;
      const direita = indice === COLUNAS.length - 1 ? 0 : FOLGA;
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
    fio(doc, y);
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
    fio(doc, y);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ESCURO);
    naBase(doc, `Nenhum repasse foi liberado em ${periodo.rotulo}.`, MARGEM, y + 20);
    doc.font('Helvetica').fontSize(8.5).fillColor(CINZA);
    naBase(doc, 'Não houve movimentação financeira no período.', MARGEM, y + 34);
    y += 46;
    fio(doc, y);
    y += 26;
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
      // Fio entre as linhas, no lugar das listras: impressas, as listras
      // viravam faixas cinzentas. O último fio fica por conta do fecho.
      if (indice < repasses.length - 1) fio(doc, y, { cor: '#E2E8F0' });
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
      fio(doc, y);
      for (const [rotulo, soma] of subtotais) {
        const base = y + baseNaLinha;
        doc.font('Helvetica').fontSize(CORPO_TABELA).fillColor(CINZA);
        naBase(doc, rotulo, MARGEM, base);
        celula('bruto', formatarDinheiro(soma.bruto), base);
        celula('comissao', formatarDinheiro(soma.comissao), base);
        celula('liquido', formatarDinheiro(soma.liquido), base);
        y += ALTURA_LINHA;
      }
    }

    fio(doc, y, { cor: ESCURO, espessura: 0.9 });
    const base = y + alturaTotal / 2 + caixaAlta(CORPO_TABELA) / 2 + 1;
    doc.font('Helvetica-Bold').fontSize(CORPO_TABELA).fillColor(ESCURO);
    naBase(doc, 'Total do mês', MARGEM, base);
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
  const RECUO_NOTA = 9;
  const larguraNota = largura - RECUO_NOTA;
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
    // O ponto fica na MARGEM, alinhado ao título; o texto, logo depois.
    doc.circle(MARGEM + 1.5, base - alturaX(CORPO_NOTA) / 2, 1.3).fill(CINZA);
    doc.font('Helvetica').fontSize(CORPO_NOTA).fillColor(CINZA);
    doc.text(nota, MARGEM + RECUO_NOTA, base, { width: larguraNota, baseline: 'alphabetic' });
    y += doc.heightOfString(nota, { width: larguraNota }) + 5;
  }

  // ---------------- rodapé de todas as páginas ----------------
  const paginas = doc.bufferedPageRange();
  for (let i = paginas.start; i < paginas.start + paginas.count; i += 1) {
    doc.switchToPage(i);
    const linha = doc.page.height - MARGEM - 8;
    fio(doc, linha);
    const base = linha + 15;
    doc.font('Helvetica').fontSize(7.5).fillColor(CINZA);
    naBase(doc, `Festeirinho · Relatório financeiro mensal · ${periodo.titulo}`, MARGEM, base);
    naBase(doc, `Página ${i - paginas.start + 1} de ${paginas.count}`, MARGEM, base,
      { width: largura, align: 'right' });
  }

  doc.end();
  return pronto;
}
