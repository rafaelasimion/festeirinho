import path from 'node:path';
import PDFDocument from 'pdfkit';
import { formatarData, formatarDataHora } from '@/lib/datas';
import {
  ROTULO_ORIGEM,
  formatarDinheiro,
  formatarPercentual,
} from '@/lib/relatorio-financeiro';

// Módulo de servidor: o pdfkit lê arquivos do disco. Só a rota do relatório
// o importa.
//
// RF056 / UC 032 — o relatório em PDF, no mesmo desenho do comprovante de
// contratação (RF058): faixa roxa com a marca, os valores que respondem à
// pergunta do documento em destaque logo abaixo e as linhas em listras.
// Diferente do comprovante, este pode ter muitas linhas, então quebra
// página e repete o cabeçalho da tabela em cada uma.

const ROXO = '#534AB7';
const ROXO_CLARO = '#D4D2ED';
const CINZA = '#64748B';
const ESCURO = '#0F172A';
const LISTRA = '#F8FAFC';
const FIO = '#E2E8F0';
const ATENCAO_FUNDO = '#FCF3F1';
const ATENCAO_BORDA = '#F3CEC1';
const ATENCAO_TEXTO = '#8A3A1F';

const MARGEM = 48;
const ALTURA_FAIXA = 124;
// Abaixo disto fica o rodapé; nenhuma linha da tabela passa daqui.
const RESERVA_RODAPE = 64;

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
  const fim = doc.page.width - MARGEM;
  const limite = () => doc.page.height - RESERVA_RODAPE;

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
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#FFFFFF')
      .text('Festeirinho', MARGEM, 46);
  }

  doc.font('Helvetica-Bold').fontSize(13).fillColor('#FFFFFF')
    .text('Relatório financeiro mensal', MARGEM, 44, { width: largura, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(ROXO_CLARO)
    .text(`Referência: ${periodo.titulo}`, MARGEM, 64, { width: largura, align: 'right' })
    .text(`Emitido em ${formatarDataHora(relatorio.emitidoEm)}`,
      MARGEM, 77, { width: largura, align: 'right' });

  // ---------------- quem é o fornecedor ----------------
  //
  // O relatório costuma ir para o contador. O nome de exibição sozinho não
  // identifica ninguém fora da plataforma; o titular e o documento, sim.
  let y = ALTURA_FAIXA + 16;
  const metade = largura / 2;
  doc.font('Helvetica').fontSize(8).fillColor(CINZA)
    .text('FORNECEDOR', MARGEM, y, { characterSpacing: 0.8 })
    .text('TITULAR', MARGEM + metade, y, { characterSpacing: 0.8 });
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(ESCURO)
    .text(fornecedor.nomeExibicao, MARGEM, y + 12, { width: metade - 16 });
  const alturaNome = doc.y;
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(ESCURO)
    .text(fornecedor.titular ?? '—', MARGEM + metade, y + 12, { width: metade });
  if (fornecedor.documento) {
    doc.font('Helvetica').fontSize(9).fillColor(CINZA)
      .text(fornecedor.documento, MARGEM + metade, doc.y + 1, { width: metade });
  }
  y = Math.max(alturaNome, doc.y) + 12;

  // ---------------- mês em andamento ----------------
  if (relatorio.parcial) {
    const alturaAviso = 30;
    doc.roundedRect(MARGEM, y, largura, alturaAviso, 8)
      .fillAndStroke(ATENCAO_FUNDO, ATENCAO_BORDA);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(ATENCAO_TEXTO)
      .text('Mês em andamento.', MARGEM + 14, y + 10, { continued: true })
      .font('Helvetica')
      .text(' O relatório reúne os repasses liberados até a data de emissão.');
    y += alturaAviso + 12;
  }

  // ---------------- destaque dos valores ----------------
  //
  // As três respostas que o documento existe para dar (RN058): quanto foi
  // repassado, quanto ficou de comissão e quanto o fornecedor recebeu.
  const alturaDestaque = 82;
  doc.roundedRect(MARGEM, y, largura, alturaDestaque, 10).fillAndStroke('#F6F6FB', ROXO_CLARO);
  const terco = largura / 3;
  const destaques = [
    {
      rotulo: 'VALOR BRUTO',
      valor: formatarDinheiro(total.bruto),
      detalhe: total.quantidade === 1 ? '1 repasse liberado' : `${total.quantidade} repasses liberados`,
      cor: ESCURO,
    },
    {
      rotulo: 'COMISSÃO RETIDA',
      valor: formatarDinheiro(total.comissao),
      detalhe: 'sobre os serviços concluídos',
      cor: ESCURO,
    },
    {
      rotulo: 'VALOR LÍQUIDO RECEBIDO',
      valor: formatarDinheiro(total.liquido),
      detalhe: `em ${periodo.rotulo}`,
      cor: ROXO,
    },
  ];
  destaques.forEach((item, indice) => {
    const x = MARGEM + terco * indice + 18;
    doc.font('Helvetica').fontSize(8).fillColor(CINZA)
      .text(item.rotulo, x, y + 16, { characterSpacing: 0.8, width: terco - 24 });
    doc.font('Helvetica-Bold').fontSize(indice === 2 ? 20 : 16).fillColor(item.cor)
      .text(item.valor, x, y + 30, { width: terco - 24 });
    doc.font('Helvetica').fontSize(8).fillColor(CINZA)
      .text(item.detalhe, x, y + 58, { width: terco - 24 });
  });
  y += alturaDestaque + 10;

  // Composição por origem: é o que explica por que a comissão não é o
  // percentual aplicado sobre o bruto inteiro. Num mês sem repasse ela só
  // repetiria zeros, então fica de fora.
  if (total.quantidade > 0) {
    doc.font('Helvetica').fontSize(8.5).fillColor(CINZA)
      .text(`Serviços concluídos: ${servicos.quantidade} · ${formatarDinheiro(servicos.bruto)} bruto · `
        + `${formatarDinheiro(servicos.comissao)} de comissão · `
        + `${formatarDinheiro(servicos.liquido)} líquido`, MARGEM, y, { width: largura })
      .text(`Multas por cancelamento: ${multas.quantidade} · `
        + `${formatarDinheiro(multas.liquido)}, repassadas sem comissão`, MARGEM, doc.y + 2,
      { width: largura });
    y = doc.y;
  }
  y += 14;

  // ---------------- tabela ----------------
  // Larguras em pontos; o serviço fica com o que sobra. As de valor foram
  // medidas para "R$ 999.999,99" caber numa linha no total do mês: com 64
  // pontos, um total de cinco dígitos quebrava o último centavo para baixo.
  const COLUNAS = [
    { chave: 'data', titulo: 'DATA', largura: 54 },
    { chave: 'solicitacao', titulo: 'SOLIC.', largura: 46 },
    { chave: 'servico', titulo: 'SERVIÇO', largura: 0 },
    { chave: 'origem', titulo: 'ORIGEM', largura: 82 },
    { chave: 'bruto', titulo: 'BRUTO', largura: 68, direita: true },
    { chave: 'comissao', titulo: 'COMISSÃO', largura: 68, direita: true },
    { chave: 'liquido', titulo: 'LÍQUIDO', largura: 68, direita: true },
  ];
  const fixas = COLUNAS.reduce((soma, c) => soma + c.largura, 0);
  COLUNAS.find((c) => c.chave === 'servico').largura = largura - fixas;
  let x = MARGEM;
  for (const coluna of COLUNAS) {
    coluna.x = x;
    x += coluna.largura;
  }
  const RECUO = 5;

  function tituloSecao(texto) {
    doc.rect(MARGEM, y + 1, 3, 10).fill(ROXO);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(ROXO)
      .text(texto.toUpperCase(), MARGEM + 10, y, { characterSpacing: 0.6 });
    y += 20;
  }

  function cabecalhoTabela() {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(CINZA);
    for (const coluna of COLUNAS) {
      doc.text(coluna.titulo, coluna.x + RECUO, y, {
        width: coluna.largura - RECUO * 2,
        align: coluna.direita ? 'right' : 'left',
        characterSpacing: 0.5,
      });
    }
    y += 13;
    doc.moveTo(MARGEM, y).lineTo(fim, y).strokeColor(FIO).lineWidth(1).stroke();
    y += 5;
  }

  // Página nova com o cabeçalho da tabela repetido: quem lê a página 2 não
  // deve precisar voltar à 1 para saber o que é cada coluna.
  function novaPagina() {
    doc.addPage({ size: 'A4', margin: 0 });
    y = MARGEM;
    doc.font('Helvetica').fontSize(8).fillColor(CINZA)
      .text(`Relatório financeiro mensal · ${periodo.titulo} (continuação)`, MARGEM, y);
    y += 22;
    cabecalhoTabela();
  }

  tituloSecao('Repasses liberados no mês');

  if (repasses.length === 0) {
    // UC 032, fluxo 6a — o relatório sai mesmo sem movimentação, dizendo isso.
    const alturaVazio = 52;
    doc.roundedRect(MARGEM, y, largura, alturaVazio, 8).fillAndStroke(LISTRA, FIO);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ESCURO)
      .text(`Nenhum repasse foi liberado em ${periodo.rotulo}.`, MARGEM + 16, y + 13,
        { width: largura - 32 });
    doc.font('Helvetica').fontSize(8.5).fillColor(CINZA)
      .text('Não houve movimentação financeira no período.', MARGEM + 16, y + 30,
        { width: largura - 32 });
    y += alturaVazio + 18;
  } else {
    cabecalhoTabela();

    repasses.forEach((repasse, indice) => {
      const celulas = {
        data: formatarData(repasse.dataRepasse),
        solicitacao: `nº ${repasse.idSolicitacao}`,
        servico: repasse.servico,
        origem: ROTULO_ORIGEM[repasse.origem],
        bruto: formatarDinheiro(repasse.valorBruto),
        comissao: formatarDinheiro(repasse.valorComissao),
        liquido: formatarDinheiro(repasse.valorLiquido),
      };
      // Debaixo do valor da comissão, o percentual congelado no pagamento
      // daquela contratação (RN027); na multa, a razão de ela ser zero.
      const detalheComissao = repasse.origem === 'conclusao'
        ? formatarPercentual(repasse.percentualComissao)
        : 'sem comissão';

      doc.font('Helvetica').fontSize(8.5);
      const alturaTexto = Math.max(
        ...COLUNAS.map((c) => doc.heightOfString(celulas[c.chave],
          { width: c.largura - RECUO * 2 })),
        doc.heightOfString('R$ 0,00') + 10
      );
      const altura = alturaTexto + 10;

      if (y + altura > limite()) novaPagina();

      if (indice % 2 === 0) doc.rect(MARGEM, y - 3, largura, altura).fill(LISTRA);

      for (const coluna of COLUNAS) {
        const negrito = coluna.chave === 'liquido';
        doc.font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
          .fillColor(ESCURO)
          .text(celulas[coluna.chave], coluna.x + RECUO, y + 2, {
            width: coluna.largura - RECUO * 2,
            align: coluna.direita ? 'right' : 'left',
          });
      }
      const comissao = COLUNAS.find((c) => c.chave === 'comissao');
      doc.font('Helvetica').fontSize(7).fillColor(CINZA)
        .text(detalheComissao, comissao.x + RECUO, y + 13, {
          width: comissao.largura - RECUO * 2, align: 'right',
        });

      y += altura;
    });

    // Linha de total. Se não couber, vai para a página seguinte junto com o
    // cabeçalho, em vez de ficar sozinha no alto de uma página sem contexto.
    const alturaTotal = 24;
    if (y + alturaTotal > limite()) novaPagina();
    doc.moveTo(MARGEM, y).lineTo(fim, y).strokeColor(ROXO).lineWidth(1.2).stroke();
    y += 7;
    const totais = { bruto: total.bruto, comissao: total.comissao, liquido: total.liquido };
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(ESCURO)
      .text('Total do mês', MARGEM + RECUO, y);
    for (const coluna of COLUNAS.filter((c) => c.chave in totais)) {
      doc.font('Helvetica-Bold').fontSize(8.5)
        .fillColor(coluna.chave === 'liquido' ? ROXO : ESCURO)
        .text(formatarDinheiro(totais[coluna.chave]), coluna.x + RECUO, y, {
          width: coluna.largura - RECUO * 2, align: 'right',
        });
    }
    y += alturaTotal;
  }

  // ---------------- como ler ----------------
  const notas = [
    'Entram os repasses liberados no mês de referência, pela data da liberação. '
      + 'Valores ainda em carência na data de emissão aparecem no relatório do mês em que forem liberados.',
    'A comissão de cada serviço é a do percentual vigente na data da contratação. '
      + 'As multas por cancelamento são repassadas integralmente, sem comissão.',
    'Saques e saldo disponível não fazem parte deste relatório e podem ser consultados no painel financeiro.',
  ];
  doc.font('Helvetica').fontSize(8);
  const alturaNotas = notas.reduce(
    (soma, nota) => soma + doc.heightOfString(nota, { width: largura - 14 }) + 4, 22
  );
  if (y + alturaNotas > limite()) {
    doc.addPage({ size: 'A4', margin: 0 });
    y = MARGEM;
  }
  y += 4;
  tituloSecao('Como ler este relatório');
  for (const nota of notas) {
    doc.circle(MARGEM + 3, y + 4, 1.4).fill(CINZA);
    doc.font('Helvetica').fontSize(8).fillColor(CINZA)
      .text(nota, MARGEM + 12, y, { width: largura - 14 });
    y = doc.y + 4;
  }

  // ---------------- rodapé de todas as páginas ----------------
  const paginas = doc.bufferedPageRange();
  for (let i = paginas.start; i < paginas.start + paginas.count; i += 1) {
    doc.switchToPage(i);
    const topo = doc.page.height - MARGEM + 8;
    doc.moveTo(MARGEM, topo - 10).lineTo(fim, topo - 10)
      .strokeColor(FIO).lineWidth(1).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(CINZA)
      .text(`Festeirinho · Relatório financeiro mensal · ${periodo.titulo}`,
        MARGEM, topo, { width: largura * 0.7, lineBreak: false })
      .text(`Página ${i - paginas.start + 1} de ${paginas.count}`,
        MARGEM, topo, { width: largura, align: 'right', lineBreak: false });
  }

  doc.end();
  return pronto;
}
