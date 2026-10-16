import path from 'node:path';

// Módulo de servidor: o pdfkit lê o logo do disco. Usado pelo comprovante
// de contratação (RF058) e pelo relatório financeiro mensal (RF056).
//
// Os dois documentos saem da tela e vão para a impressora, o e-mail e o
// contador, e por isso seguem o desenho de papel: fundo branco, nenhuma
// área pintada, cor só em texto e em fios finos. A versão anterior tinha
// uma faixa roxa de 124 pontos no alto, caixas com fundo e tabelas em
// listras; impressa, a faixa sozinha cobria um sexto da folha de tinta.
// A marca continua no alto, agora pelo logo escrito, que identifica o
// documento sem precisar de fundo.

export const COR = {
  escuro: '#0F172A',
  cinza: '#64748B',
  roxo: '#534AB7',
  // Fio das tabelas e dos separadores: claro o bastante para não pesar,
  // escuro o bastante para aparecer numa impressora comum.
  fio: '#CBD5E1',
  // Fio do aviso do comprovante e da nota de mês em andamento.
  atencao: '#B14A27',
};

export const MARGEM = 48;

// PNG porque o pdfkit não lê webp. 720 x 212 pixels, recortado sem a
// sobra transparente do arquivo original.
const ARQUIVO_LOGO = path.join(process.cwd(), 'public', 'logo-festeirinho-texto.png');
const LARGURA_LOGO = 118;
const TOPO = 40;

// Altura das maiúsculas da Helvetica (718/1000 do corpo).
export const caixaAlta = (corpo) => (718 / 1000) * corpo;

// Texto apoiado na linha de base `base`. O pdfkit posiciona pelo alto da
// linha, e um corpo menor ao lado de um maior subiria; com a linha de base,
// corpos diferentes ficam na mesma linha.
export function naBase(doc, texto, x, base, opcoes = {}) {
  doc.text(String(texto), x, base, { lineBreak: false, ...opcoes, baseline: 'alphabetic' });
}

export function fio(doc, y, { de = MARGEM, ate = doc.page.width - MARGEM, cor = COR.fio, espessura = 0.6 } = {}) {
  doc.moveTo(de, y).lineTo(ate, y).strokeColor(cor).lineWidth(espessura).stroke();
}

// Logo à esquerda; à direita, o nome do documento e as linhas que o
// identificam (número, referência, data de emissão). Um fio fecha o
// cabeçalho. Devolve o y do fio, de onde o conteúdo continua.
//
// O título se apoia perto do alto do logo e a última linha, perto da base
// dele, para os dois blocos terem a mesma altura.
export function cabecalhoDocumento(doc, { titulo, linhas }) {
  const largura = doc.page.width - MARGEM * 2;

  try {
    doc.image(ARQUIVO_LOGO, MARGEM, TOPO, { width: LARGURA_LOGO });
  } catch {
    // O documento não pode deixar de sair por causa de uma imagem.
    doc.font('Helvetica-Bold').fontSize(18).fillColor(COR.roxo);
    naBase(doc, 'Festeirinho', MARGEM, TOPO + 24);
  }

  doc.font('Helvetica-Bold').fontSize(12).fillColor(COR.escuro);
  naBase(doc, titulo, MARGEM, TOPO + 11, { width: largura, align: 'right' });
  doc.font('Helvetica').fontSize(8.5).fillColor(COR.cinza);
  linhas.forEach((linha, indice) => {
    naBase(doc, linha, MARGEM, TOPO + 23.5 + indice * 11.5, { width: largura, align: 'right' });
  });

  const y = TOPO + 50;
  fio(doc, y);
  return y;
}

// Aviso marcado por um fio à esquerda, como os blocos das telas: um
// destaque em negrito e o texto em seguida, sem caixa nem fundo. Devolve a
// altura ocupada.
export function avisoComFio(doc, { x, y, largura, destaque, texto, corpo = 8.5 }) {
  const recuo = 10;
  const area = largura - recuo;
  doc.font('Helvetica-Bold').fontSize(corpo);
  const alturaDestaque = doc.heightOfString(destaque, { width: area });
  doc.font('Helvetica').fontSize(corpo);
  const alturaTexto = texto ? doc.heightOfString(texto, { width: area }) : 0;
  const altura = alturaDestaque + (texto ? alturaTexto + 1 : 0);

  doc.rect(x, y, 1.5, altura).fill(COR.atencao);
  doc.font('Helvetica-Bold').fontSize(corpo).fillColor(COR.escuro)
    .text(destaque, x + recuo, y, { width: area });
  if (texto) {
    doc.font('Helvetica').fontSize(corpo).fillColor(COR.cinza)
      .text(texto, x + recuo, y + alturaDestaque + 1, { width: area });
  }
  return altura;
}
