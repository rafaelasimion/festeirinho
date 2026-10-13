import ExcelJS from 'exceljs';
import { formatarDataHora } from '@/lib/datas';
import { ROTULO_ORIGEM } from '@/lib/relatorio-financeiro';

// Módulo de servidor: só a rota do relatório o importa.
//
// RF056 / UC 032 — o relatório em Excel. A planilha é para quem vai
// conferir e somar (o fornecedor, o contador), então os valores entram como
// NÚMEROS com formato de moeda, e não como texto "R$ 1.234,56": texto não
// soma, não filtra e não vai para outra planilha. Pelo mesmo motivo as
// datas são datas de verdade, e os totais são fórmulas, que continuam
// certas se alguém apagar ou filtrar uma linha.

const ROXO = 'FF534AB7';
const ROXO_CLARO = 'FFEAE9F6';
const LISTRA = 'FFF8FAFC';
const CINZA = 'FF64748B';
const FIO = 'FFE2E8F0';

const MOEDA = '"R$" #,##0.00';
const PERCENTUAL = '0.00%';
const DATA_HORA = 'dd/mm/yyyy hh:mm';

// '2026-10-05 14:30:00' → Date que o Excel mostra como 05/10/2026 14:30.
//
// O exceljs converte a data para o número de série do Excel pelo instante
// em UTC. Montar o Date com Date.UTC a partir do relógio de parede faz o
// número cair exatamente na hora gravada no banco, sem fuso no caminho
// (lib/datas.js explica por que os DATETIME daqui não têm fuso).
function dataDoBanco(texto) {
  const achado = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(texto));
  if (!achado) return null;
  const [, ano, mes, dia, hora, minuto, segundo] = achado.map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, segundo || 0));
}

export async function montarXlsxRelatorio(relatorio) {
  const { periodo, fornecedor, total, servicos, multas, repasses } = relatorio;

  const livro = new ExcelJS.Workbook();
  livro.creator = 'Festeirinho';
  livro.created = relatorio.emitidoEm;
  livro.title = `Relatório financeiro mensal — ${periodo.rotulo}`;

  const aba = livro.addWorksheet('Relatório', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  aba.columns = [
    { key: 'data', width: 18 },
    { key: 'solicitacao', width: 13 },
    { key: 'servico', width: 42 },
    { key: 'origem', width: 24 },
    { key: 'bruto', width: 16 },
    { key: 'percentual', width: 15 },
    { key: 'comissao', width: 16 },
    { key: 'liquido', width: 17 },
  ];
  const ULTIMA_COLUNA = 8;

  // ---------------- identificação ----------------
  aba.mergeCells(1, 1, 1, ULTIMA_COLUNA);
  const titulo = aba.getCell(1, 1);
  titulo.value = 'Festeirinho · Relatório financeiro mensal';
  titulo.font = { bold: true, size: 15, color: { argb: ROXO } };
  aba.getRow(1).height = 24;

  const identificacao = [
    ['Mês de referência', periodo.titulo + (relatorio.parcial ? ' (mês em andamento)' : '')],
    ['Fornecedor', fornecedor.nomeExibicao],
    ['Titular', [fornecedor.titular, fornecedor.documento].filter(Boolean).join(' · ')],
    ['Emitido em', formatarDataHora(relatorio.emitidoEm)],
  ];
  identificacao.forEach(([rotulo, valor], indice) => {
    const linha = aba.getRow(2 + indice);
    linha.getCell(1).value = rotulo;
    linha.getCell(1).font = { color: { argb: CINZA } };
    aba.mergeCells(2 + indice, 2, 2 + indice, ULTIMA_COLUNA);
    linha.getCell(2).value = valor;
    linha.getCell(2).font = { bold: rotulo === 'Mês de referência' };
  });

  // ---------------- tabela ----------------
  // O resumo vem antes da tabela na leitura, mas as fórmulas dele apontam
  // para a linha de total, que só existe depois de a tabela ser escrita.
  // Por isso as posições são calculadas primeiro.
  const LINHA_RESUMO = 7;
  const LINHA_CABECALHO = LINHA_RESUMO + 7;
  const primeiraLinha = LINHA_CABECALHO + 1;
  const ultimaLinha = LINHA_CABECALHO + Math.max(repasses.length, 1);
  const linhaTotal = ultimaLinha + 1;

  const cabecalho = aba.getRow(LINHA_CABECALHO);
  cabecalho.values = [
    'Liberado em', 'Solicitação', 'Serviço', 'Origem',
    'Valor bruto', 'Comissão (%)', 'Comissão (R$)', 'Valor líquido',
  ];
  cabecalho.height = 20;
  cabecalho.eachCell((celula, coluna) => {
    celula.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROXO } };
    celula.alignment = {
      vertical: 'middle',
      horizontal: coluna >= 5 ? 'right' : (coluna === 2 ? 'center' : 'left'),
    };
  });

  if (repasses.length === 0) {
    // UC 032, fluxo 6a — a planilha sai mesmo sem movimentação, dizendo isso.
    aba.mergeCells(primeiraLinha, 1, primeiraLinha, ULTIMA_COLUNA);
    const vazio = aba.getCell(primeiraLinha, 1);
    vazio.value = `Nenhum repasse foi liberado em ${periodo.rotulo}. `
      + 'Não houve movimentação financeira no período.';
    vazio.font = { italic: true, color: { argb: CINZA } };
  } else {
    repasses.forEach((repasse, indice) => {
      const linha = aba.getRow(primeiraLinha + indice);
      linha.values = {
        data: dataDoBanco(repasse.dataRepasse),
        solicitacao: repasse.idSolicitacao,
        servico: repasse.servico,
        origem: ROTULO_ORIGEM[repasse.origem],
        bruto: repasse.valorBruto,
        // Fração, como o Excel entende percentual: 10% é 0,1.
        percentual: repasse.percentualComissao / 100,
        comissao: repasse.valorComissao,
        liquido: repasse.valorLiquido,
      };
      // Data à esquerda, como o título da coluna: alinhada à direita, por
      // ser número, ela encostava no nº da solicitação ao lado.
      linha.getCell('data').numFmt = DATA_HORA;
      linha.getCell('data').alignment = { horizontal: 'left', vertical: 'top' };
      linha.getCell('solicitacao').alignment = { horizontal: 'center', vertical: 'top' };
      // Nome de serviço comprido quebra a linha em vez de ser cortado.
      linha.getCell('servico').alignment = { wrapText: true, vertical: 'top' };
      linha.getCell('origem').alignment = { vertical: 'top' };
      for (const chave of ['bruto', 'comissao', 'liquido']) {
        linha.getCell(chave).numFmt = MOEDA;
        linha.getCell(chave).alignment = { vertical: 'top' };
      }
      linha.getCell('percentual').numFmt = PERCENTUAL;
      linha.getCell('percentual').alignment = { vertical: 'top' };
      if (indice % 2 === 1) {
        linha.eachCell({ includeEmpty: true }, (celula) => {
          celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LISTRA } };
        });
      }
    });
  }

  // Total em fórmula, com o resultado já calculado junto: quem abre no
  // celular ou numa prévia que não calcula fórmulas vê o número mesmo assim.
  const somaColuna = (letra, resultado) => (repasses.length === 0
    ? 0
    : { formula: `SUM(${letra}${primeiraLinha}:${letra}${ultimaLinha})`, result: resultado });

  const linhaDoTotal = aba.getRow(linhaTotal);
  linhaDoTotal.getCell(1).value = 'Total do mês';
  linhaDoTotal.getCell(5).value = somaColuna('E', total.bruto);
  linhaDoTotal.getCell(7).value = somaColuna('G', total.comissao);
  linhaDoTotal.getCell(8).value = somaColuna('H', total.liquido);
  for (let coluna = 1; coluna <= ULTIMA_COLUNA; coluna += 1) {
    const celula = linhaDoTotal.getCell(coluna);
    celula.font = { bold: true, color: { argb: coluna === 8 ? ROXO : 'FF0F172A' } };
    celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROXO_CLARO } };
    celula.border = { top: { style: 'medium', color: { argb: ROXO } } };
    if (coluna >= 5) celula.numFmt = MOEDA;
  }

  // ---------------- resumo ----------------
  const tituloResumo = aba.getCell(LINHA_RESUMO, 1);
  tituloResumo.value = 'Resumo do mês';
  tituloResumo.font = { bold: true, color: { argb: ROXO } };

  const resumo = [
    ['Valor bruto', { formula: `E${linhaTotal}`, result: total.bruto }, MOEDA],
    ['Comissão retida', { formula: `G${linhaTotal}`, result: total.comissao }, MOEDA],
    ['Valor líquido recebido', { formula: `H${linhaTotal}`, result: total.liquido }, MOEDA],
    ['Repasses de serviços concluídos', servicos.quantidade, '0'],
    ['Repasses de multas por cancelamento (sem comissão)', multas.quantidade, '0'],
  ];
  resumo.forEach(([rotulo, valor, formato], indice) => {
    const linha = aba.getRow(LINHA_RESUMO + 1 + indice);
    aba.mergeCells(LINHA_RESUMO + 1 + indice, 1, LINHA_RESUMO + 1 + indice, 4);
    linha.getCell(1).value = rotulo;
    linha.getCell(5).value = valor;
    linha.getCell(5).numFmt = formato;
    linha.getCell(5).alignment = { horizontal: 'right' };
    const destaque = rotulo === 'Valor líquido recebido';
    linha.getCell(1).font = { bold: destaque };
    linha.getCell(5).font = { bold: destaque, color: destaque ? { argb: ROXO } : undefined };
    linha.getCell(5).border = { bottom: { style: 'thin', color: { argb: FIO } } };
  });

  // ---------------- notas ----------------
  const notas = [
    'Entram os repasses liberados no mês de referência, pela data da liberação. Valores ainda em '
      + 'carência na data de emissão aparecem no relatório do mês em que forem liberados.',
    'A comissão de cada serviço é a do percentual vigente na data da contratação. As multas por '
      + 'cancelamento são repassadas integralmente, sem comissão.',
    'Saques e saldo disponível não fazem parte deste relatório e podem ser consultados no painel financeiro.',
  ];
  notas.forEach((nota, indice) => {
    const numero = linhaTotal + 2 + indice;
    aba.mergeCells(numero, 1, numero, ULTIMA_COLUNA);
    const celula = aba.getCell(numero, 1);
    celula.value = nota;
    celula.font = { size: 9, color: { argb: CINZA } };
    celula.alignment = { wrapText: true, vertical: 'top' };
    aba.getRow(numero).height = 26;
  });

  // Sem linhas de grade, como um documento. O cabeçalho da tabela NÃO fica
  // congelado: ele está na linha 14, e congelar até ali prenderia título e
  // resumo no alto da tela, comendo metade de um notebook. O filtro nas
  // colunas fica, quando há linhas para filtrar.
  aba.views = [{ showGridLines: false }];
  if (repasses.length > 0) {
    aba.autoFilter = {
      from: { row: LINHA_CABECALHO, column: 1 },
      to: { row: ultimaLinha, column: ULTIMA_COLUNA },
    };
  }

  return Buffer.from(await livro.xlsx.writeBuffer());
}
