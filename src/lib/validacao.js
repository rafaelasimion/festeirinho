// Funções de validação reutilizáveis.
// Usadas pelo servidor (obrigatório) e pela tela (opcional, só para dar
// retorno rápido ao usuário). Validação de front é conveniência; validação
// de back é a que vale.

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

export function validarEmail(valor) {
  const email = String(valor ?? '').trim();
  return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// Telefone brasileiro: 10 dígitos (fixo) ou 11 (celular), com DDD.
export function validarTelefone(valor) {
  const digitos = somenteDigitos(valor);
  return digitos.length === 10 || digitos.length === 11;
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

// Nome de usuário: 3 a 50 caracteres, letras, números, ponto e underscore.
export function validarNomeUsuario(valor) {
  return /^[a-zA-Z0-9._]{3,50}$/.test(String(valor ?? ''));
}
