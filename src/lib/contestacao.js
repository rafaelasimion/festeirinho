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

// RN069 / LGPD — o aviso que vem antes de qualquer foto ser enviada, no
// formulário e no quadro de fotos. Um texto só, para os dois lugares nunca
// prometerem coisas diferentes.
export const AVISO_FOTOS_CONTESTACAO =
  'Só a administração vê estas fotos, e elas são apagadas quando a contestação '
  + 'for decidida. Prefira enquadrar o serviço e evite fotos em que crianças '
  + 'apareçam em destaque.';
