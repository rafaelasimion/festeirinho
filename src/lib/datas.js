// Datas e horas da plataforma.
//
// Todo DATETIME aqui é RELÓGIO DE PAREDE: a hora que aconteceu, ou que vai
// acontecer, no fuso de quem usa o sistema. Não é um instante com fuso
// embutido. "A festa é dia 28 às 20:53" quer dizer 20:53 no relógio da
// parede da festa, e não um ponto na linha do tempo que cada lugar do
// mundo lê de um jeito.
//
// Tratar esse valor como instante foi o que colocou tudo três horas atrás.
// O caminho era este:
//
//   1. o formulário mandava '2026-09-28T20:53' e o servidor gravava
//      '2026-09-28 20:53:00' — correto, relógio de parede;
//   2. o pool tinha timezone: 'Z', então o mysql2 lia esse texto como se
//      fosse UTC e devolvia um Date ancorado em 20:53Z;
//   3. esse Date virava '...T20:53:00.000Z' no JSON e o navegador fazia
//      toLocaleString('pt-BR'), convertendo de UTC para São Paulo: 17:53.
//
// A conversão da etapa 3 era legítima; o errado era a etapa 2 ter fingido
// que um relógio de parede era UTC. Agora o pool usa dateStrings, o valor
// chega como está no banco, e estas funções o formatam letra por letra,
// sem passar por Date. Sem conversão não há o que dar errado — e o mesmo
// vale para o NOW() do banco, que também é relógio de parede.

const PADRAO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

function doisDigitos(numero) {
  return String(numero).padStart(2, '0');
}

// Um Date ainda pode chegar aqui — valor montado em JS, ou uma coluna que
// escape do dateStrings. Nesse caso o relógio de parede é o local, que é o
// mesmo do banco.
function comoTexto(valor) {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return '';
    return `${valor.getFullYear()}-${doisDigitos(valor.getMonth() + 1)}-`
      + `${doisDigitos(valor.getDate())} `
      + `${doisDigitos(valor.getHours())}:${doisDigitos(valor.getMinutes())}`
      + `:${doisDigitos(valor.getSeconds())}`;
  }
  return String(valor ?? '');
}

// Data pronta para atravessar de um componente de servidor para um de
// cliente.
//
// Antes do dateStrings, cada tela fazia `valor.toISOString()` aqui, porque
// o mysql2 entregava um Date e um Date não sobrevive à serialização. Com o
// banco devolvendo texto, aquilo virou "toISOString is not a function" em
// nove lugares — e, pior, o toISOString convertia para UTC, que é
// justamente a conversão que criava as três horas de diferença.
//
// Agora o valor já vem no formato certo e só precisa passar. O Date ainda
// é tratado porque uma coluna pode escapar do dateStrings, ou o valor
// pode ter sido montado em JS.
// O texto sai com T no lugar do espaço. O banco entrega
// '2026-09-28 20:53:00', e esse formato com espaço NÃO é ISO 8601: o V8
// aceita, mas o Safari devolve Invalid Date. Como do outro lado alguém
// pode fazer new Date() com esse valor, o T é o que garante que ele seja
// lido igual em qualquer navegador — e, sem Z nem fuso no fim, lido como
// hora local, que é o que ele é.
export function paraSerializar(valor) {
  if (!valor) return null;
  const texto = valor instanceof Date ? comoTexto(valor) : String(valor);
  // Um Date inválido é truthy e escapa da guarda acima; aqui ele vira null
  // como qualquer outra ausência, em vez de um texto vazio no JSON.
  return texto === '' ? null : texto.replace(' ', 'T');
}

function partes(valor) {
  if (!valor) return null;
  const achado = PADRAO.exec(comoTexto(valor));
  if (!achado) return null;
  const [, ano, mes, dia, hora, minuto] = achado;
  // temHora distingue uma coluna DATE de um DATETIME à meia-noite.
  return {
    ano, mes, dia, hora: hora ?? '00', minuto: minuto ?? '00',
    temHora: hora !== undefined,
  };
}

export function formatarData(valor) {
  const p = partes(valor);
  return p ? `${p.dia}/${p.mes}/${p.ano}` : '';
}

// Sem hora no valor, mostra só a data: uma coluna DATE exibida como
// "28/09/2026, 00:00" inventa uma meia-noite que ninguém informou.
export function formatarDataHora(valor) {
  const p = partes(valor);
  if (!p) return '';
  if (!p.temHora) return `${p.dia}/${p.mes}/${p.ano}`;
  return `${p.dia}/${p.mes}/${p.ano}, ${p.hora}:${p.minuto}`;
}

export function formatarHora(valor) {
  const p = partes(valor);
  return p ? `${p.hora}:${p.minuto}` : '';
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// Data por extenso, para o separador de dia do chat.
export function formatarDataPorExtenso(valor) {
  const p = partes(valor);
  if (!p) return '';
  return `${p.dia} de ${MESES[Number(p.mes) - 1]} de ${p.ano}`;
}

// Só a parte do dia, para comparar se dois valores caem na mesma data sem
// construir Date nenhum.
export function apenasDia(valor) {
  const p = partes(valor);
  return p ? `${p.ano}-${p.mes}-${p.dia}` : '';
}

// O dia de hoje no mesmo formato de apenasDia, para comparar com ele.
export function diaDeHoje(deslocamentoEmDias = 0) {
  const data = new Date();
  data.setDate(data.getDate() + deslocamentoEmDias);
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-`
    + `${doisDigitos(data.getDate())}`;
}
