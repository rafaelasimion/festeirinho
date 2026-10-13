import { diaDeHoje } from '@/lib/datas';

// RF056 / UC 032 / RN058 — relatório financeiro mensal do fornecedor.
//
// Módulo puro: não importa banco nem gerador de arquivo, então serve tanto
// à rota que monta o arquivo quanto ao formulário do painel, que precisa
// da lista de meses e do rótulo de cada um.

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export const FORMATOS = {
  pdf: {
    rotulo: 'PDF',
    extensao: 'pdf',
    tipo: 'application/pdf',
  },
  xlsx: {
    rotulo: 'Excel',
    extensao: 'xlsx',
    tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
};

export const ROTULO_ORIGEM = {
  conclusao: 'Serviço concluído',
  multa: 'Multa por cancelamento',
};

function doisDigitos(numero) {
  return String(numero).padStart(2, '0');
}

// O mês corrente no relógio de parede do servidor, que é o mesmo do banco
// (lib/datas.js). É ele que separa um mês fechado de um mês em andamento.
export function mesAtual() {
  return diaDeHoje().slice(0, 7);
}

export function rotuloMes(chave) {
  const [ano, mes] = String(chave).split('-');
  return `${MESES[Number(mes) - 1]} de ${ano}`;
}

export function rotuloMesTitulo(chave) {
  const rotulo = rotuloMes(chave);
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
}

// 'AAAA-MM' → o período de consulta, ou null se o texto não for um mês.
//
// O intervalo é fechado no início e aberto no fim — do dia 1º à meia-noite
// até o dia 1º do mês seguinte, exclusive —, porque data_repasse é
// DATETIME: um "até o dia 31" perderia o repasse liberado às 23:59:30.
// Os limites saem como texto de relógio de parede, no mesmo formato que o
// banco guarda, sem passar por Date (lib/datas.js explica o porquê).
export function lerMes(texto) {
  const achado = /^(\d{4})-(\d{2})$/.exec(String(texto ?? ''));
  if (!achado) return null;
  const ano = Number(achado[1]);
  const mes = Number(achado[2]);
  if (ano < 2000 || mes < 1 || mes > 12) return null;

  const anoSeguinte = mes === 12 ? ano + 1 : ano;
  const mesSeguinte = mes === 12 ? 1 : mes + 1;
  const chave = `${ano}-${doisDigitos(mes)}`;

  return {
    chave,
    inicio: `${chave}-01 00:00:00`,
    fim: `${anoSeguinte}-${doisDigitos(mesSeguinte)}-01 00:00:00`,
    rotulo: rotuloMes(chave),
    titulo: rotuloMesTitulo(chave),
  };
}

// Meses que o formulário oferece: do mês do cadastro até o atual, do mais
// recente para o mais antigo. Antes do cadastro não pode haver repasse, e
// depois do mês atual ainda não houve.
export function mesesDisponiveis(dataCadastro, atual = mesAtual()) {
  const inicio = /^(\d{4})-(\d{2})/.exec(String(dataCadastro ?? ''));
  const [anoFim, mesFim] = atual.split('-').map(Number);
  let ano = inicio ? Number(inicio[1]) : anoFim;
  let mes = inicio ? Number(inicio[2]) : mesFim;

  const meses = [];
  // O teto de 120 meses só protege contra uma data de cadastro corrompida.
  while ((ano < anoFim || (ano === anoFim && mes <= mesFim)) && meses.length < 120) {
    meses.push(`${ano}-${doisDigitos(mes)}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  if (meses.length === 0) meses.push(atual);
  return meses.reverse();
}

// RN058 — consolida os repasses liberados no mês.
//
// As somas correm em centavos inteiros, como no cálculo do valor final:
// somar 0,1 + 0,2 em ponto flutuante dá 0,30000000000000004, e numa coluna
// de vinte repasses o centavo errado aparece no total.
//
// (a) repasses liberados, de conclusão e de multa;
// (b) comissão retida, que só existe nos de conclusão — a multa é
//     repassada inteira e aparece com comissão zero;
// (c) valor líquido total recebido.
export function consolidar(linhas) {
  const centavos = (valor) => Math.round(Number(valor) * 100);

  const repasses = linhas.map((linha) => ({
    origem: linha.origem,
    idSolicitacao: Number(linha.id_solicitacao),
    servico: linha.servico,
    dataRepasse: linha.data_repasse,
    valorBruto: Number(linha.valor_bruto),
    percentualComissao: Number(linha.percentual_comissao),
    valorComissao: Number(linha.valor_comissao),
    valorLiquido: Number(linha.valor_liquido),
  }));

  function somar(lista) {
    return {
      quantidade: lista.length,
      bruto: lista.reduce((soma, r) => soma + centavos(r.valorBruto), 0) / 100,
      comissao: lista.reduce((soma, r) => soma + centavos(r.valorComissao), 0) / 100,
      liquido: lista.reduce((soma, r) => soma + centavos(r.valorLiquido), 0) / 100,
    };
  }

  return {
    repasses,
    servicos: somar(repasses.filter((r) => r.origem === 'conclusao')),
    multas: somar(repasses.filter((r) => r.origem === 'multa')),
    total: somar(repasses),
  };
}

export function formatarDinheiro(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarPercentual(valor) {
  return `${Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

// CPF e CNPJ com a pontuação de sempre. O CNPJ pode ser alfanumérico
// (RF045), e a máscara não depende de os caracteres serem dígitos.
export function formatarDocumento(tipoPessoa, cpf, cnpj) {
  if (tipoPessoa === 'PF' && cpf?.length === 11) {
    return `CPF ${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  }
  if (tipoPessoa === 'PJ' && cnpj?.length === 14) {
    return `CNPJ ${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/`
      + `${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
  }
  return '';
}

export function nomeDoArquivo(chave, formato) {
  return `relatorio-financeiro-festeirinho-${chave}.${FORMATOS[formato].extensao}`;
}
