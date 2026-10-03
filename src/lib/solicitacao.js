// RN029 — o valor final não é negociado: é calculado pelo sistema.
//
//   cobrança "hora"   → preço base × duração informada
//   cobrança "pessoa" → preço base × número de convidados
//   cobrança "fixo"   → o próprio preço base, sem multiplicador
//
// O preço base e o tipo de cobrança usados são os vigentes NO MOMENTO DO
// ENVIO. Por isso a solicitação guarda uma cópia do preço (valor_referencia)
// e o valor já calculado (valor_final): mudanças posteriores no serviço não
// alteram solicitações que já saíram.

export function calcularValorFinal({ precoBase, cobranca, duracao, numeroConvidados }) {
  const multiplicador =
    cobranca === 'fixo' ? 1
    : cobranca === 'hora' ? Number(duracao)
    : Number(numeroConvidados);

  const valor = Number(precoBase) * multiplicador;
  if (!Number.isFinite(valor)) return null;
  return Math.round(valor * 100) / 100;
}

export function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// Rótulo da forma de cobrança nos formulários, onde o fornecedor escolhe.
export const ROTULO_COBRANCA = {
  hora: 'Por hora',
  pessoa: 'Por pessoa',
  fixo: 'Valor fixo',
};

// Sufixo exibido ao lado do preço. Valor fixo não recebe sufixo: "R$ 800,00"
// já se explica sozinho.
export const SUFIXO_PRECO = {
  hora: ' por hora',
  pessoa: ' por pessoa',
  fixo: '',
};

// Explicação do cálculo, mostrada ao cliente antes do envio (RF028).
export const EXPLICACAO_COBRANCA = {
  hora: 'Preço por hora multiplicado pela duração informada.',
  pessoa: 'Preço por pessoa multiplicado pelo número de convidados.',
  fixo: 'Valor fixo do serviço, independente da duração e do número de convidados.',
};

export const ROTULO_STATUS_SOLICITACAO = {
  aguardando_analise: 'Aguardando análise',
  aguardando_pagamento: 'Aguardando pagamento',
  confirmado: 'Confirmado',
  concluido: 'Concluído',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  expirado: 'Expirado',
};

// O tom de cada status. Fica ao lado do rótulo para que as duas coisas
// nunca se separem: se um status novo entrar no sistema, o erro aparece
// aqui e não espalhado pelas telas.
export const TOM_STATUS_SOLICITACAO = {
  aguardando_analise: 'atencao',
  aguardando_pagamento: 'atencao',
  confirmado: 'sucesso',
  concluido: 'sucesso',
  recusado: 'perigo',
  cancelado: 'perigo',
  expirado: 'perigo',
};

export const ROTULO_VERIFICACAO = {
  pendente: 'em análise',
  aprovado: 'aprovado',
  rejeitado: 'não aprovado',
};

export const TOM_VERIFICACAO = {
  pendente: 'atencao',
  aprovado: 'roxo',
  rejeitado: 'perigo',
};

export const ROTULO_MOTIVO_RECUSA = {
  agenda_indisponivel: 'Agenda indisponível',
  fora_da_area: 'Fora da área de atendimento',
  inviabilidade: 'Inviabilidade técnica, operacional ou logística',
  outro: 'Outro motivo',
};

// As três formas do enum forma_pagamento. Vira mapa porque a tela de
// pagamento decidia com um ternário "é pix? senão boleto", e pagamento por
// cartão aparecia rotulado como boleto no comprovante da tela.
export const ROTULO_FORMA_PAGAMENTO = {
  pix: 'Pix',
  cartao: 'Cartão de crédito',
  boleto: 'Boleto',
};

// RN022 — a janela do chat: abre com a aprovação do fornecedor (RN023) e
// fecha no registro da conclusão. Fora dela o histórico continua visível,
// mas não se escreve mais.
//
// Mora aqui, e não só na rota, porque a TELA também precisa da regra: é ela
// que decide se o botão convida a conversar ou a ler o que já foi dito. Com
// a regra escrita em dois lugares, um dia um deles muda sozinho e o botão
// passa a prometer o que o servidor recusa.
export function chatAberto({ status, conclusaoRegistrada }) {
  return ['aguardando_pagamento', 'confirmado'].includes(status)
    && !conclusaoRegistrada;
}

// A situação de uma solicitação vista pelo cliente.
//
// Nem tudo que a tela precisa saber está na coluna `status`: "o fornecedor
// registrou a conclusão e falta você confirmar" é a combinação de quatro
// campos, e "está em contestação" é um quinto. Essas contas moram aqui
// porque agora duas telas as fazem — a lista, para escolher o rótulo do
// botão, e a página da solicitação, para decidir o que mostrar. Repetidas,
// um dia uma das cópias mudaria sozinha e o botão prometeria uma coisa
// enquanto a página faz outra.
export function situacaoCliente(solicitacao) {
  const contestacaoPendente = solicitacao.status_contestacao === 'pendente';

  // UC 020 / UC 042 — a janela em que a bola está com o cliente.
  const aguardandoConfirmacao =
    solicitacao.status === 'confirmado'
    && Boolean(solicitacao.data_registro_conclusao_fornecedor)
    && !solicitacao.data_confirmacao_conclusao_cliente
    && !solicitacao.status_contestacao;

  const podeAvaliar = solicitacao.status === 'concluido' && !solicitacao.id_avaliacao;

  return { contestacaoPendente, aguardandoConfirmacao, podeAvaliar };
}

// O botão que leva da lista para a página da solicitação.
//
// O destino é sempre o mesmo — a página da solicitação. O que muda é o
// rótulo, que anuncia o que está esperando lá dentro: a pessoa varre a
// lista e vê, de relance, em qual delas ela precisa fazer alguma coisa.
// A ação de verdade acontece na página, com o contexto à vista; pagar ou
// confirmar uma conclusão direto de um item de lista é decidir no escuro.
//
// A ordem importa: é uma régua de urgência, e a primeira que casar vence.
export function chamadaCliente(solicitacao) {
  const { contestacaoPendente, aguardandoConfirmacao, podeAvaliar } =
    situacaoCliente(solicitacao);

  if (contestacaoPendente) {
    return { rotulo: 'Acompanhar contestação', tom: 'atencao' };
  }
  if (aguardandoConfirmacao) {
    return { rotulo: 'Confirmar conclusão', tom: 'principal' };
  }
  if (solicitacao.status === 'aguardando_pagamento' && solicitacao.id_pagamento) {
    return { rotulo: 'Pagar', tom: 'principal' };
  }
  if (podeAvaliar) {
    return { rotulo: 'Avaliar serviço', tom: 'principal' };
  }
  return { rotulo: 'Ver detalhes', tom: 'secundario' };
}

// A situação de uma solicitação vista pelo fornecedor. Mesma razão da
// gêmea do cliente: a lista e a página precisam concordar.
export function situacaoFornecedor(solicitacao) {
  const aberta = solicitacao.status === 'aguardando_analise';

  // UC 019, pré-condição — só depois do término previsto do evento.
  const eventoTerminou = new Date(solicitacao.termino_previsto) <= new Date();

  const podeRegistrarConclusao =
    solicitacao.status === 'confirmado'
    && eventoTerminou
    && !solicitacao.data_registro_conclusao_fornecedor;

  const aguardandoCliente =
    solicitacao.status === 'confirmado'
    && Boolean(solicitacao.data_registro_conclusao_fornecedor);

  const contestacaoPendente = solicitacao.status_contestacao === 'pendente';

  return {
    aberta, eventoTerminou, podeRegistrarConclusao,
    aguardandoCliente, contestacaoPendente,
  };
}

// O botão que leva da lista de recebidas à solicitação. Mesma ideia da
// chamadaCliente: destino fixo, rótulo que anuncia o que espera lá dentro.
export function chamadaFornecedor(solicitacao) {
  const { aberta, podeRegistrarConclusao, contestacaoPendente } =
    situacaoFornecedor(solicitacao);

  if (aberta) {
    return { rotulo: 'Analisar', tom: 'principal' };
  }
  if (contestacaoPendente) {
    return { rotulo: 'Acompanhar contestação', tom: 'atencao' };
  }
  if (podeRegistrarConclusao) {
    return { rotulo: 'Registrar conclusão', tom: 'principal' };
  }
  return { rotulo: 'Ver detalhes', tom: 'secundario' };
}

// RF023 — os marcos da solicitação, em ordem cronológica.
//
// Não existe tabela de histórico no modelo, e não precisa existir: cada
// transição do ciclo já tem a sua coluna de data, e a DDL diz isso em voz
// alta no comentário de data_resposta_fornecedor — "aprovação, recusa ou
// expiração (RF023)". A linha do tempo é a leitura dessas colunas.
//
// A ordem sai do próprio dado, não de uma sequência escrita aqui: os
// marcos são ordenados pela data. Uma ordem fixa seria uma segunda versão
// do ciclo de vida, escrita em JavaScript, que um dia discordaria da
// primeira — e discordaria logo, porque o ciclo tem desvios (contestação,
// cancelamento pelas três origens) que não cabem numa fila única.
//
// A comparação é de texto porque as datas são relógio de parede no formato
// AAAA-MM-DD HH:MM — ordenar alfabeticamente é ordenar cronologicamente, e
// sem construir Date nenhum, que é a regra de lib/datas.js.
export function marcosDaSolicitacao(solicitacao) {
  const marcos = [];
  const pôr = (data, titulo, detalhe = null, tom = 'neutro') => {
    if (data) marcos.push({ data, titulo, detalhe, tom });
  };

  pôr(solicitacao.data_solicitacao, 'Solicitação enviada');

  // Uma coluna, três desfechos. O status desempata: cancelado só acontece
  // depois de aprovada, então tudo que não é recusado nem expirado passou
  // pela aprovação.
  if (solicitacao.data_resposta_fornecedor) {
    if (solicitacao.status === 'recusado') {
      pôr(solicitacao.data_resposta_fornecedor, 'Recusada pelo fornecedor',
        solicitacao.motivo_recusa ? ROTULO_MOTIVO_RECUSA[solicitacao.motivo_recusa] : null,
        'perigo');
    } else if (solicitacao.status === 'expirado') {
      pôr(solicitacao.data_resposta_fornecedor, 'Expirada sem resposta do fornecedor',
        null, 'perigo');
    } else {
      pôr(solicitacao.data_resposta_fornecedor, 'Aprovada pelo fornecedor',
        'Pagamento gerado.', 'sucesso');
    }
  }

  pôr(solicitacao.data_pagamento, 'Pagamento confirmado',
    solicitacao.forma_pagamento ? ROTULO_FORMA_PAGAMENTO[solicitacao.forma_pagamento] : null,
    'sucesso');

  pôr(solicitacao.data_registro_conclusao_fornecedor,
    'Conclusão registrada pelo fornecedor');

  pôr(solicitacao.data_contestacao_cliente, 'Conclusão contestada pelo cliente',
    null, 'atencao');

  pôr(solicitacao.data_analise_contestacao, 'Contestação analisada',
    solicitacao.resultado_contestacao === 'procedente' ? 'Procedente.'
      : solicitacao.resultado_contestacao === 'improcedente' ? 'Improcedente.'
        : null,
    solicitacao.resultado_contestacao === 'procedente' ? 'perigo' : 'sucesso');

  pôr(solicitacao.data_confirmacao_conclusao_cliente, 'Conclusão confirmada',
    null, 'sucesso');

  pôr(solicitacao.data_cancelamento, 'Cancelamento registrado',
    solicitacao.solicitado_por
      ? `Solicitado por: ${ROTULO_ORIGEM_CANCELAMENTO_CURTO[solicitacao.solicitado_por]}.`
      : null,
    'perigo');

  pôr(solicitacao.data_avaliacao, 'Serviço avaliado',
    solicitacao.nota ? `Nota ${solicitacao.nota} de 5.` : null);

  return marcos.sort((a, b) => String(a.data).localeCompare(String(b.data)));
}

// Versão curta da origem do cancelamento, para caber numa linha do tempo.
// A longa, em lib/cancelamento.js, é uma frase ("Cancelamento solicitado
// pelo cliente") e aqui repetiria a palavra que já está no título.
const ROTULO_ORIGEM_CANCELAMENTO_CURTO = {
  cliente: 'cliente',
  fornecedor: 'fornecedor',
  sistema: 'sistema',
};
