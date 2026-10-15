import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  consolidar, lerMes, mesesDisponiveis, descreverPeriodo, formatarDocumento,
} from '@/lib/relatorio-financeiro';
import { montarPdfRelatorio } from '@/lib/relatorio-financeiro-pdf';
import { montarXlsxRelatorio } from '@/lib/relatorio-financeiro-xlsx';

// RF056 / UC 032 / RN058 — relatório financeiro mensal do fornecedor.

const linha = (origem, idSolicitacao, bruto, percentual) => {
  const comissao = origem === 'multa' ? 0 : Math.round(bruto * percentual) / 100;
  return {
    origem, id_solicitacao: idSolicitacao, servico: `Serviço ${idSolicitacao}`,
    data_repasse: `2026-09-${String(idSolicitacao).padStart(2, '0')} 10:00:00`,
    valor_bruto: bruto.toFixed(2),
    percentual_comissao: origem === 'multa' ? 0 : percentual.toFixed(2),
    valor_comissao: comissao.toFixed(2),
    valor_liquido: (bruto - comissao).toFixed(2),
  };
};

describe('RN058 · consolidação do relatório mensal', () => {
  const linhas = [
    linha('conclusao', 1, 950, 10),
    linha('conclusao', 2, 800, 10),
    linha('multa', 3, 250, 0),
    linha('conclusao', 4, 330.33, 12.5),
  ];
  const r = consolidar(linhas);

  it('(a) reúne repasses de serviço concluído e de multa', () => {
    assert.equal(r.total.quantidade, 4);
    assert.equal(r.servicos.quantidade, 3);
    assert.equal(r.multas.quantidade, 1);
  });

  it('(b) a multa entra com comissão zero', () => {
    assert.equal(r.multas.comissao, 0);
    assert.equal(r.multas.liquido, 250);
  });

  it('(b) a comissão de cada serviço é a do percentual congelado nele', () => {
    // 95,00 + 80,00 + 41,29 (12,5% de 330,33 = 41,29125)
    assert.equal(r.servicos.comissao, 216.29);
  });

  it('(c) líquido = bruto − comissão, somado em centavos exatos', () => {
    assert.equal(r.total.bruto, 2330.33);
    assert.equal(r.total.liquido, Math.round((r.total.bruto - r.total.comissao) * 100) / 100);
  });

  it('mês sem repasse: tudo zero (UC 032, fluxo 6a)', () => {
    const vazio = consolidar([]);
    assert.deepEqual(vazio.total, { quantidade: 0, bruto: 0, comissao: 0, liquido: 0 });
  });
});

describe('UC 032 · mês de referência', () => {
  it('período fechado no início e aberto no fim, pelo relógio de parede', () => {
    const p = lerMes('2026-09');
    assert.equal(p.inicio, '2026-09-01 00:00:00');
    assert.equal(p.fim, '2026-10-01 00:00:00');
  });

  it('dezembro termina em janeiro do ano seguinte', () => {
    assert.equal(lerMes('2026-12').fim, '2027-01-01 00:00:00');
  });

  it('mês inválido: recusado', () => {
    for (const texto of ['2026-13', '2026-00', '2026-9', 'setembro', '', null]) {
      assert.equal(lerMes(texto), null, String(texto));
    }
  });

  it('meses oferecidos: do cadastro até o atual, mais recente primeiro', () => {
    assert.deepEqual(
      mesesDisponiveis('2026-08-15 10:00:00', '2026-10'),
      ['2026-10', '2026-09', '2026-08']
    );
  });

  it('a dica diz o último dia certo do mês, inclusive em fevereiro bissexto', () => {
    assert.equal(descreverPeriodo('2026-02', false), 'Repasses liberados de 01/02 a 28/02.');
    assert.equal(descreverPeriodo('2028-02', false), 'Repasses liberados de 01/02 a 29/02.');
    assert.equal(descreverPeriodo('2026-09', false), 'Repasses liberados de 01/09 a 30/09.');
  });

  it('documento do titular com a pontuação de sempre', () => {
    assert.equal(formatarDocumento('PF', '52998224725', null), 'CPF 529.982.247-25');
    assert.equal(formatarDocumento('PJ', null, '12ABC34501DE35'), 'CNPJ 12.ABC.345/01DE-35');
  });
});

describe('RF056 · arquivos gerados', () => {
  const relatorio = {
    periodo: lerMes('2026-09'), parcial: false, emitidoEm: new Date(),
    fornecedor: { nomeExibicao: 'Bruno Animações', titular: 'Bruno Lima', documento: 'CPF 529.982.247-25' },
    ...consolidar([linha('conclusao', 1, 950, 10), linha('multa', 2, 250, 0)]),
  };

  it('PDF: arquivo PDF válido', async () => {
    const pdf = await montarPdfRelatorio(relatorio);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  });

  it('PDF de mês vazio: gerado mesmo assim', async () => {
    const pdf = await montarPdfRelatorio({ ...relatorio, ...consolidar([]) });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  });

  it('Excel: valores como número e totais como fórmula', async () => {
    const livro = new ExcelJS.Workbook();
    await livro.xlsx.load(await montarXlsxRelatorio(relatorio));
    const aba = livro.worksheets[0];
    let linhaTotal = null;
    aba.eachRow((row, numero) => { if (row.getCell(1).value === 'Total do mês') linhaTotal = numero; });
    assert.ok(linhaTotal, 'linha "Total do mês" não encontrada');
    const total = aba.getRow(linhaTotal).getCell(8).value;
    assert.match(total.formula, /^SUM\(H\d+:H\d+\)$/);
    assert.equal(total.result, 1105);
    assert.equal(typeof aba.getRow(linhaTotal - 1).getCell(5).value, 'number');
  });
});
