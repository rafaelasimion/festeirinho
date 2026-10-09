// Campos do fornecedor que aparecem na vitrine para o cliente.
//
// A RN067 manda: alterar qualquer um deles devolve o cadastro para
// verificação. O fornecedor continua visível e recebendo solicitações —
// perde só o selo de verificado até a nova aprovação (RN005). Quem sai da
// vitrine até ser aprovado de novo é o SERVIÇO alterado, não o fornecedor.
//
// A regra mora aqui, e não dentro das rotas, porque há DOIS caminhos de
// edição — o formulário completo de dados (PUT /api/fornecedor/perfil) e
// o painel da própria vitrine (PATCH /api/fornecedor/vitrine). Se cada um
// tivesse a sua cópia da comparação, mais cedo ou mais tarde uma delas
// esqueceria um campo e o fornecedor alteraria a vitrine sem passar por
// nova análise.
//
// Módulo puro: sem banco e sem sessão. A tela usa para avisar antes de
// salvar, o servidor usa para decidir.

export const CAMPOS_DA_VITRINE = [
  'nomeExibicao', 'descricao', 'instagramUrl', 'whatsappUrl', 'site',
];

// Recebe a linha do banco e os valores novos já limpos. Compara sempre
// texto com texto: no banco as redes sociais são NULL quando vazias, e no
// formulário são string vazia — sem a normalização, salvar sem mexer em
// nada acusaria mudança e derrubaria a verificação à toa.
export function mudouDadoDaVitrine(atual, novo) {
  const texto = (valor) => String(valor ?? '').trim();

  return texto(atual.nome_exibicao) !== texto(novo.nomeExibicao)
    || texto(atual.descricao) !== texto(novo.descricao)
    || texto(atual.instagram_url) !== texto(novo.instagramUrl)
    || texto(atual.whatsapp_url) !== texto(novo.whatsappUrl)
    || texto(atual.site) !== texto(novo.site);
}

// RN005 / RN067 — o texto anterior dizia que o perfil e os serviços
// "deixavam de aparecer nas buscas", o contrário do que a regra manda e do
// que o sistema faz: a busca filtra o status do fornecedor e o do serviço,
// nunca a verificação do fornecedor.
export const AVISO_NOVA_VERIFICACAO =
  'Alterar os dados da vitrine envia seu perfil para nova análise. Seu perfil '
  + 'e seus serviços continuam aparecendo nas buscas, mas sem o selo de '
  + 'verificado até a aprovação.';
