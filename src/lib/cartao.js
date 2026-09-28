// RF032 / UC 030 — cartão de crédito.
//
// Módulo puro: sem banco e sem sessão, roda no servidor e no navegador.
// A tela usa para dar retorno enquanto a pessoa digita; o servidor usa
// para valer. Validação de front é conveniência, a de back é a que conta.
//
// RN013 — nada aqui persiste o número do cartão. Estas funções existem
// para (a) barrar um número obviamente errado antes de incomodar o
// gateway e (b) derivar as duas informações que PODEM ser guardadas:
// a bandeira e os quatro últimos dígitos.

export function somenteDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

// Algoritmo de Luhn — o dígito verificador do cartão, o mesmo princípio
// do CPF. Dobra os dígitos em posições alternadas da direita para a
// esquerda, soma tudo e exige que o total seja múltiplo de 10. Pega erro
// de digitação, não diz se o cartão existe: isso só o gateway sabe.
export function validarLuhn(entrada) {
  const numero = somenteDigitos(entrada);
  if (numero.length < 13 || numero.length > 19) return false;

  let soma = 0;
  let dobrar = false;

  for (let i = numero.length - 1; i >= 0; i--) {
    let digito = Number(numero[i]);
    if (dobrar) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    soma += digito;
    dobrar = !dobrar;
  }

  return soma % 10 === 0;
}

// A bandeira sai dos primeiros dígitos (o BIN). A ordem importa: Elo e
// Hipercard começam com faixas que também caberiam em Visa/Mastercard,
// então são testadas antes.
const BANDEIRAS = [
  { nome: 'Elo', teste: /^(4011|4312|4389|4514|4576|5041|5066|5090|6277|6362|6363|6500|6516|6550)/ },
  { nome: 'Hipercard', teste: /^(38|60)/ },
  { nome: 'Amex', teste: /^3[47]/ },
  { nome: 'Diners', teste: /^3(0[0-5]|[68])/ },
  { nome: 'Visa', teste: /^4/ },
  { nome: 'Mastercard', teste: /^(5[1-5]|2[2-7])/ },
];

export function detectarBandeira(entrada) {
  const numero = somenteDigitos(entrada);
  if (numero === '') return null;
  return BANDEIRAS.find(({ teste }) => teste.test(numero))?.nome ?? null;
}

export function ultimosQuatro(entrada) {
  return somenteDigitos(entrada).slice(-4);
}

// Validade no formato MM/AA. Vale até o ÚLTIMO dia do mês informado —
// um cartão 09/26 ainda funciona em 30 de setembro de 2026.
export function validarValidade(entrada) {
  const texto = String(entrada ?? '').trim();
  const partes = /^(\d{2})\/?(\d{2})$/.exec(texto);
  if (!partes) return false;

  const mes = Number(partes[1]);
  const ano = 2000 + Number(partes[2]);
  if (mes < 1 || mes > 12) return false;

  // Dia 1 do mês SEGUINTE, menos um instante: o fim do mês de validade.
  const vencimento = new Date(ano, mes, 1);
  return vencimento > new Date();
}

export function validarCVV(entrada, bandeira) {
  const digitos = somenteDigitos(entrada);
  // Amex usa 4 dígitos; as demais, 3.
  return bandeira === 'Amex' ? digitos.length === 4 : digitos.length === 3;
}

// Formatação visual, em grupos de quatro. Não altera o valor enviado —
// o servidor limpa tudo que não for dígito de qualquer forma.
export function formatarNumero(entrada) {
  const digitos = somenteDigitos(entrada).slice(0, 19);
  return digitos.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function formatarValidade(entrada) {
  const digitos = somenteDigitos(entrada).slice(0, 4);
  if (digitos.length <= 2) return digitos;
  return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
}

// Como o cartão aparece nas listas e na tela de pagamento (UC 029, passo 2).
export function rotuloCartao({ bandeira, ultimos_quatro_num, apelido }) {
  const base = `${bandeira} •••• ${ultimos_quatro_num}`;
  return apelido ? `${base} · ${apelido}` : base;
}
