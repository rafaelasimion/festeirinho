// RF063 / RF063-B / UC 039 — canal de suporte.
//
// RN063 é a regra que decide o formato deste arquivo: o atendimento
// acontece FORA da plataforma e não gera registro de chamado no banco. O
// sistema só monta o texto e o endereço do canal externo. Por isso aqui
// não há import de banco nem de sessão: é um módulo puro, que roda no
// servidor e no navegador igualmente.
//
// RN064 — a triagem de assunto do WhatsApp é configurada na própria
// ferramenta de WhatsApp, não aqui. A lista abaixo serve para montar a
// mensagem inicial; o menu automatizado que atende do outro lado é
// responsabilidade da administração, fora do Festeirinho.

export const ASSUNTOS = [
  {
    valor: 'pagamento',
    rotulo: 'Pagamento',
    detalhe: 'Cobrança, recusa, prazo ou reembolso.',
  },
  {
    valor: 'contratacao',
    rotulo: 'Contratação',
    detalhe: 'Solicitação, agenda, conclusão ou cancelamento do serviço.',
  },
  {
    valor: 'financeiro',
    rotulo: 'Financeiro do fornecedor',
    detalhe: 'Saque, repasse e dados de recebimento.',
  },
  {
    valor: 'conta',
    rotulo: 'Cadastro e conta',
    detalhe: 'Acesso, verificação de cadastro, suspensão e dados do perfil.',
  },
  {
    valor: 'denuncia',
    rotulo: 'Denúncia',
    detalhe: 'Conduta de um cliente ou de um fornecedor.',
  },
  {
    valor: 'outro',
    rotulo: 'Outro assunto',
    detalhe: 'Dúvidas gerais sobre a plataforma.',
  },
];

export const ROTULO_ASSUNTO = Object.fromEntries(
  ASSUNTOS.map((assunto) => [assunto.valor, assunto.rotulo])
);

const ROTULO_PAPEL = {
  cliente: 'cliente',
  fornecedor: 'fornecedor',
};

// UC 039, passo 2 — "o sistema identifica o contexto de origem". A tela
// que chama o suporte diz de onde veio; isso entra na mensagem para o
// atendente não precisar perguntar.
const ROTULO_ORIGEM = {
  pagamento: 'tela de pagamento',
  solicitacao: 'detalhes da solicitação',
  financeiro: 'painel financeiro',
  conta: 'tela da conta',
};

export function assuntoValido(valor) {
  return ASSUNTOS.some((assunto) => assunto.valor === valor);
}

// Linha de assunto do e-mail. Curta, com o número da solicitação quando
// existir — é o que a caixa de entrada do suporte mostra na listagem.
export function montarAssuntoEmail({ assunto, contexto = null }) {
  const base = `Festeirinho — ${ROTULO_ASSUNTO[assunto] ?? 'Suporte'}`;
  return contexto?.idSolicitacao
    ? `${base} (solicitação nº ${contexto.idSolicitacao})`
    : base;
}

// RF063 — "pré-preencher a mensagem inicial com o contexto identificado
// (ex.: número da solicitação e/ou motivo da falha)". A mesma mensagem
// serve aos dois canais: muda só o endereço que a carrega.
export function montarMensagem({
  assunto,
  relato = '',
  usuario = null,
  contexto = null,
}) {
  const linhas = [`Assunto: ${ROTULO_ASSUNTO[assunto] ?? 'Suporte'}`];

  if (usuario) {
    const papel = ROTULO_PAPEL[usuario.tipoUsuario] ?? 'usuário';
    linhas.push(`Sou ${papel} no Festeirinho: ${usuario.nome} (${usuario.email}).`);
  }

  if (contexto?.idSolicitacao) {
    linhas.push(
      `Solicitação nº ${contexto.idSolicitacao}`
      + (contexto.servico ? ` — ${contexto.servico}` : '')
      + (contexto.origem ? ` (aberto pela ${ROTULO_ORIGEM[contexto.origem] ?? contexto.origem})` : '')
    );
  }

  const texto = relato.trim();
  linhas.push('');
  linhas.push(texto === '' ? 'Descreva aqui o que aconteceu.' : texto);

  return linhas.join('\n');
}

// mailto: abre o programa de e-mail do usuário já com destinatário,
// assunto e corpo preenchidos. Nada é enviado pelo servidor — o envio é
// do cliente de e-mail dele, o que é exatamente o "canal externo" da
// RN063.
export function enderecoEmail({ email, assunto, corpo }) {
  if (!email) return null;

  const parametros = new URLSearchParams({ subject: assunto, body: corpo });

  // Detalhe que quebra na prática: URLSearchParams codifica espaço como
  // '+', convenção de formulário HTML. Em mailto: o '+' não é espaço, é
  // um sinal de mais literal — o e-mail chegaria com "Assunto:+Pagamento".
  // Trocando por %20 o espaço volta a ser espaço nos dois mundos.
  return `mailto:${email}?${parametros.toString().replace(/\+/g, '%20')}`;
}

// wa.me é o endereço oficial do WhatsApp para abrir uma conversa com um
// número, no aplicativo ou no navegador. Só dígitos, com código do país
// (55) e DDD.
export function enderecoWhatsapp({ numero, corpo }) {
  const digitos = String(numero ?? '').replace(/\D/g, '');
  if (digitos.length < 12) return null; // 55 + DDD + número
  return `https://wa.me/${digitos}?text=${encodeURIComponent(corpo)}`;
}
