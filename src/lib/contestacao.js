// Rótulos da contestação de conclusão (RF069/RN069).
// Arquivo sem banco: usado pelas telas do cliente e do painel administrativo.

export const MOTIVOS_CONTESTACAO = [
  { valor: 'servico_nao_prestado', rotulo: 'Serviço não prestado',
    detalhe: 'O fornecedor não compareceu ou não executou o serviço.' },
  { valor: 'servico_parcial', rotulo: 'Serviço prestado parcialmente',
    detalhe: 'Parte do que foi contratado não foi entregue.' },
  { valor: 'servico_divergente', rotulo: 'Serviço divergente do contratado',
    detalhe: 'O que foi entregue não corresponde ao que foi contratado.' },
];

export const ROTULO_MOTIVO_CONTESTACAO = Object.fromEntries(
  MOTIVOS_CONTESTACAO.map(({ valor, rotulo }) => [valor, rotulo])
);

export const ROTULO_RESULTADO_CONTESTACAO = {
  procedente: 'Procedente',
  improcedente: 'Improcedente',
};

export const TOM_RESULTADO_CONTESTACAO = {
  procedente: 'sucesso',
  improcedente: 'perigo',
};

// UC 042 / UC 046 — o tamanho do relato de cada parte: a descrição do
// cliente na contestação e a versão do fornecedor. Os mesmos números nas
// duas pontas e no servidor, que é quem decide.
export const MINIMO_RELATO_CONTESTACAO = 20;
export const MAXIMO_RELATO_CONTESTACAO = 1000;

// RF069-B / RN069 — quantas imagens cada parte pode anexar à contestação.
//
// Limite fixo, e não parâmetro da RN014: ele não regula o negócio, regula
// quanto dado sensível a plataforma aceita guardar — foto de festa infantil
// mostra criança, e a LGPD manda guardar só o necessário (art. 6º, III). É
// a mesma razão do tamanho máximo do arquivo, que também é fixo. Cinco
// cobrem o que uma contestação costuma precisar mostrar: o que foi
// montado, o que faltou, o que veio diferente.
export const LIMITE_FOTOS_CONTESTACAO = 5;

// Conferência feita no navegador, ANTES do envio, para quem escolhe as fotos
// no próprio formulário da contestação: uma foto recusada ali não chega a
// ser enviada, e a pessoa troca na hora em vez de descobrir depois. Quem
// manda é o servidor (lib/imagens-servidor.js), que confere os primeiros
// bytes do arquivo e não o tipo declarado — estes valores precisam bater
// com os de lá.
export const TIPOS_FOTO_CONTESTACAO = ['image/jpeg', 'image/png', 'image/webp'];
export const TAMANHO_MAXIMO_FOTO_CONTESTACAO = 5 * 1024 * 1024;

// RN069 / LGPD — o aviso que vem antes de qualquer foto ser enviada: quem
// vê, por quanto tempo, e o pedido de enquadrar o serviço. Fica aqui, e não
// escrito em cada tela, para os formulários nunca prometerem coisas
// diferentes.
export const AVISO_FOTOS_CONTESTACAO =
  'Só a administração vê as fotos, e elas são apagadas após a decisão. '
  + 'Evite crianças em destaque.';

// O mesmo aviso sem o "quem vê", para o formulário do fornecedor: lá o
// título da seção já diz que só a administração vê tudo o que ele enviar.
export const AVISO_GUARDA_FOTOS_CONTESTACAO =
  'As fotos são apagadas após a decisão. Evite crianças em destaque.';

// RN069 — o envio é único, para as duas partes: dito ao lado do botão, e
// não descoberto depois, quando já não há o que fazer.
export const AVISO_ENVIO_UNICO_CONTESTACAO =
  'Envio único: depois não dá para alterar o texto nem as fotos.';
