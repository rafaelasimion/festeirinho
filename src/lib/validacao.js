// Funções de validação reutilizáveis.
// Usadas pelo servidor (obrigatório) e pela tela (opcional, só para dar
// retorno rápido ao usuário). Validação de front é conveniência; validação
// de back é a que vale.

// RF001/RF002 — idade mínima para cadastro. Vale para cliente e para
// fornecedor pessoa física: nos dois casos há contratação e movimentação
// de valores, que exigem capacidade civil.
export const IDADE_MINIMA = 18;

export function somenteDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

// RN037 — validação formal de CPF: formato e dígito verificador.
export function validarCPF(entrada) {
  const cpf = somenteDigitos(entrada);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // 00000000000, 11111111111, ...

  for (const [quantidade, posicao] of [[9, 9], [10, 10]]) {
    let soma = 0;
    for (let i = 0; i < quantidade; i++) {
      soma += Number(cpf[i]) * (quantidade + 1 - i);
    }
    let digito = (soma * 10) % 11;
    if (digito === 10) digito = 0;
    if (digito !== Number(cpf[posicao])) return false;
  }
  return true;
}

// Deixa o CNPJ no formato de armazenamento: sem pontuação e em maiúsculas.
// Desde 31/07/2026 o CNPJ pode conter letras nas 12 primeiras posições,
// então NÃO se pode usar somenteDigitos aqui.
export function normalizarCNPJ(entrada) {
  return String(entrada ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// RN037 — validação formal de CNPJ, nos dois formatos.
// Estrutura: 12 caracteres alfanuméricos + 2 dígitos verificadores numéricos.
// Cálculo: módulo 11, com cada caractere convertido por (código ASCII - 48).
export function validarCNPJ(entrada) {
  const cnpj = normalizarCNPJ(entrada);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj)) return false;
  if (/^(.)\1{13}$/.test(cnpj)) return false;

  const valor = (caractere) => caractere.charCodeAt(0) - 48;

  const calcularDigito = (base) => {
    let peso = 2;
    let soma = 0;
    for (let i = base.length - 1; i >= 0; i--) {
      soma += valor(base[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  if (calcularDigito(cnpj.slice(0, 12)) !== Number(cnpj[12])) return false;
  if (calcularDigito(cnpj.slice(0, 13)) !== Number(cnpj[13])) return false;
  return true;
}

export function validarEmail(valor) {
  const email = String(valor ?? '').trim();
  return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// Telefone brasileiro: 10 dígitos (fixo) ou 11 (celular), com DDD.
export function validarTelefone(valor) {
  const digitos = somenteDigitos(valor);
  return digitos.length === 10 || digitos.length === 11;
}

// URL opcional: se veio preenchida, precisa ser http(s) e caber na coluna.
export function validarURL(valor) {
  const texto = String(valor ?? '').trim();
  if (texto === '') return true;
  if (texto.length > 500) return false;
  try {
    const url = new URL(texto);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

export function validarUF(valor) {
  return UFS.includes(String(valor ?? '').toUpperCase());
}

// Data de nascimento: precisa ser uma data real e no passado.
export function validarDataNascimento(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor ?? ''))) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(data.getTime())) return false;
  return data < new Date();
}

// Idade completa na data de hoje.
export function calcularIdade(dataNascimento) {
  const nascimento = new Date(`${dataNascimento}T00:00:00`);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  // Ainda não fez aniversário este ano: desconta um.
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade -= 1;
  }
  return idade;
}

export function validarMaioridade(valor, idadeMinima = IDADE_MINIMA) {
  if (!validarDataNascimento(valor)) return false;
  return calcularIdade(valor) >= idadeMinima;
}

// Data de nascimento mais recente que ainda satisfaz a idade mínima.
// Serve para limitar o calendário da tela (atributo max do input).
export function dataMaximaNascimento(idadeMinima = IDADE_MINIMA) {
  const data = new Date();
  data.setFullYear(data.getFullYear() - idadeMinima);
  const doisDigitos = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

// Nome de usuário: 3 a 50 caracteres, letras, números, ponto e underscore.
export function validarNomeUsuario(valor) {
  return /^[a-zA-Z0-9._]{3,50}$/.test(String(valor ?? ''));
}