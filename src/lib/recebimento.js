import {
  somenteDigitos,
  normalizarCNPJ,
  validarCPF,
  validarCNPJ,
  validarEmail,
  validarTelefone,
} from '@/lib/validacao';

// Dados de recebimento (RN061) — rótulos e validação, sem banco.
//
// Servem a dois fluxos com a mesma estrutura: o saque do fornecedor (RN060)
// e o reembolso de cancelamento pago por boleto. Muda só quem é o titular.
// Por isso a validação fica aqui, num lugar só, usada pela tela e pelo
// servidor.

export const TIPOS_RECEBIMENTO = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'conta_bancaria', rotulo: 'Conta bancária' },
];

export const TIPOS_CHAVE_PIX = [
  { valor: 'cpf', rotulo: 'CPF' },
  { valor: 'cnpj', rotulo: 'CNPJ' },
  { valor: 'email', rotulo: 'E-mail' },
  { valor: 'telefone', rotulo: 'Telefone' },
  { valor: 'aleatoria', rotulo: 'Chave aleatória' },
];

export const TIPOS_CONTA = [
  { valor: 'corrente', rotulo: 'Corrente' },
  { valor: 'poupanca', rotulo: 'Poupança' },
];

export const ROTULO_STATUS_VALIDACAO = {
  pendente: 'Em validação',
  validado: 'Validado',
  rejeitado: 'Rejeitado',
};

export const ROTULO_STATUS_SAQUE = {
  pendente: 'Pendente',
  processando: 'Transferindo',
  concluido: 'Concluído',
  recusado: 'Recusado',
};

export const TOM_STATUS_SAQUE = {
  pendente: 'atencao',
  processando: 'atencao',
  concluido: 'sucesso',
  recusado: 'perigo',
};

// Documento do titular: aceita CPF (11 dígitos) ou CNPJ (14 caracteres,
// inclusive o alfanumérico). Devolve o valor normalizado ou null.
export function normalizarDocumento(entrada) {
  const cpf = somenteDigitos(entrada);
  if (cpf.length === 11 && validarCPF(cpf)) return cpf;
  const cnpj = normalizarCNPJ(entrada);
  if (cnpj.length === 14 && validarCNPJ(cnpj)) return cnpj;
  return null;
}

// Chave aleatória do Pix: UUID no formato 8-4-4-4-12, em hexadecimal.
const PADRAO_CHAVE_ALEATORIA =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valida e normaliza. Devolve { erros, dados }: dados só é confiável quando
// erros estiver vazio. O lado que não se aplica sai nulo — a CHECK
// chk_dados_recebimento_tipo exige isso.
export function validarDadosRecebimento(entrada) {
  const erros = {};
  const tipo = String(entrada?.tipoRecebimento ?? '');
  const nomeTitular = String(entrada?.nomeTitular ?? '').trim();
  const documento = normalizarDocumento(entrada?.cpfCnpjTitular);

  if (!TIPOS_RECEBIMENTO.some((t) => t.valor === tipo)) {
    erros.tipoRecebimento = 'Escolha Pix ou conta bancária.';
  }
  if (nomeTitular.length < 3 || nomeTitular.length > 150) {
    erros.nomeTitular = 'Informe o nome do titular.';
  }
  if (!documento) {
    erros.cpfCnpjTitular = 'Informe um CPF ou CNPJ válido.';
  }

  const dados = {
    tipoRecebimento: tipo,
    nomeTitular,
    cpfCnpjTitular: documento,
    chavePix: null,
    tipoChavePix: null,
    banco: null,
    tipoConta: null,
    agencia: null,
    numeroConta: null,
  };

  if (tipo === 'pix') {
    const tipoChave = String(entrada?.tipoChavePix ?? '');
    let chave = String(entrada?.chavePix ?? '').trim();

    if (!TIPOS_CHAVE_PIX.some((t) => t.valor === tipoChave)) {
      erros.tipoChavePix = 'Selecione o tipo da chave.';
    } else if (tipoChave === 'cpf') {
      chave = somenteDigitos(chave);
      if (!validarCPF(chave)) erros.chavePix = 'CPF inválido.';
    } else if (tipoChave === 'cnpj') {
      chave = normalizarCNPJ(chave);
      if (!validarCNPJ(chave)) erros.chavePix = 'CNPJ inválido.';
    } else if (tipoChave === 'email') {
      chave = chave.toLowerCase();
      if (!validarEmail(chave)) erros.chavePix = 'E-mail inválido.';
    } else if (tipoChave === 'telefone') {
      chave = somenteDigitos(chave);
      if (!validarTelefone(chave)) erros.chavePix = 'Informe o telefone com DDD.';
    } else if (tipoChave === 'aleatoria') {
      chave = chave.toLowerCase();
      if (!PADRAO_CHAVE_ALEATORIA.test(chave)) {
        erros.chavePix = 'Chave aleatória inválida (formato de 36 caracteres com hífens).';
      }
    }

    dados.chavePix = chave;
    dados.tipoChavePix = tipoChave;
  }

  if (tipo === 'conta_bancaria') {
    const banco = String(entrada?.banco ?? '').trim();
    const tipoConta = String(entrada?.tipoConta ?? '');
    const agencia = somenteDigitos(entrada?.agencia);
    // Número da conta aceita o dígito verificador, que pode ser X.
    const numeroConta = String(entrada?.numeroConta ?? '').toUpperCase().replace(/[^0-9X-]/g, '');

    if (banco.length < 2 || banco.length > 100) erros.banco = 'Informe o banco.';
    if (!TIPOS_CONTA.some((t) => t.valor === tipoConta)) erros.tipoConta = 'Selecione o tipo de conta.';
    if (agencia.length < 3 || agencia.length > 10) erros.agencia = 'Informe a agência.';
    if (numeroConta.length < 3 || numeroConta.length > 20) erros.numeroConta = 'Informe o número da conta.';

    dados.banco = banco;
    dados.tipoConta = tipoConta;
    dados.agencia = agencia;
    dados.numeroConta = numeroConta;
  }

  return { erros, dados };
}

// Texto curto para exibir o destino do dinheiro em listas e no painel.
export function descreverRecebimento(d) {
  if (!d?.tipo_recebimento) return '';
  if (d.tipo_recebimento === 'pix') {
    const rotulo = TIPOS_CHAVE_PIX.find((t) => t.valor === d.tipo_chave_pix)?.rotulo ?? 'Pix';
    return `Pix (${rotulo}) · ${d.chave_pix}`;
  }
  const conta = TIPOS_CONTA.find((t) => t.valor === d.tipo_conta)?.rotulo ?? '';
  return `${d.banco} · ag. ${d.agencia} · conta ${conta.toLowerCase()} ${d.numero_conta}`;
}
