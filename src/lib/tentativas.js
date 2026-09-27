// RNF020 — bloqueio temporário por excesso de tentativas de autenticação
// malsucedidas. Vale para o login de usuários (UC 003, 5b) e para o
// administrativo (UC 044, 5b).
//
// Por que a contagem mora na memória do servidor e não no banco: cada
// chute de senha viraria uma linha numa tabela que só cresce, para
// guardar um dado que perde o valor em quinze minutos. E a proteção não
// precisa sobreviver a um reinício do servidor — quem consegue
// reiniciar o servidor não precisa adivinhar a senha de ninguém.
//
// Os limites são fixos, não parametrizáveis (RNF016). É a mesma escolha
// que a RN048 faz para o limite de tentativas de pagamento, e pelo mesmo
// motivo: um controle contra abuso automatizado que a administração
// pudesse afrouxar pela tela deixaria de ser um controle.
//
// A contrapartida está registrada na matriz de rastreabilidade: se a
// aplicação rodasse em vários processos atrás de um balanceador, cada
// processo contaria por si e o limite efetivo se multiplicaria. Em
// execução única, que é a desta versão, a contagem é exata.

const LIMITE_POR_CONTA = 5;
const LIMITE_POR_ORIGEM = 20;
const JANELA_MS = 15 * 60 * 1000;      // prazo em que as falhas se somam
const BLOQUEIO_MS = 15 * 60 * 1000;    // quanto dura o bloqueio
const ESQUECIMENTO_MS = 60 * 60 * 1000; // quando o registro some da memória

// Mesmo motivo do pool do banco: em desenvolvimento o Next.js recarrega
// os módulos a cada arquivo salvo. Guardado no globalThis, o mapa
// sobrevive ao recarregamento — sem isso, salvar um arquivo zeraria o
// bloqueio no meio do teste.
const registros =
  globalThis._tentativasFesteirinho ??
  (globalThis._tentativasFesteirinho = new Map());

function limiteDaChave(chave) {
  return chave.startsWith('origem:') ? LIMITE_POR_ORIGEM : LIMITE_POR_CONTA;
}

// Varre o mapa e joga fora o que não serve mais. Como só roda junto com
// uma falha de login, o custo é irrelevante e o mapa nunca cresce
// indefinidamente.
function descartarVelhos(agora) {
  for (const [chave, registro] of registros) {
    const bloqueioAcabou = registro.bloqueadoAte <= agora;
    const esfriou = agora - registro.ultimaFalha > ESQUECIMENTO_MS;
    if (bloqueioAcabou && esfriou) registros.delete(chave);
  }
}

// Duas contagens independentes, com limites diferentes:
//
//   conta:  — protege UMA conta de ter a senha adivinhada. Limite baixo.
//   origem: — protege o sistema de quem varre MUITAS contas a partir do
//             mesmo endereço. Limite alto, para não atrapalhar quem
//             divide o endereço com outras pessoas (uma rede de escola,
//             por exemplo).
//
// A contagem por conta usa o identificador digitado, exista ele ou não.
// Se só contasse contas reais, o bloqueio em si revelaria quais e-mails
// estão cadastrados — justo o que a UC 003, 5a.1 quer evitar.
export function chavesDaTentativa(request, identificador) {
  const chaves = [`conta:${String(identificador ?? '').trim().toLowerCase()}`];

  const encaminhado = request.headers.get('x-forwarded-for');
  const origem = encaminhado
    ? encaminhado.split(',')[0].trim()
    : request.headers.get('x-real-ip');

  // Em desenvolvimento não há proxy na frente da aplicação, então a
  // requisição não carrega o endereço do cliente. Sem endereço não há o
  // que contar: uma chave fixa para todo mundo contaria as tentativas de
  // usuários diferentes no mesmo balde.
  if (origem) chaves.push(`origem:${origem}`);

  return chaves;
}

// Devolve quantos segundos ainda faltam para poder tentar de novo.
// Zero significa liberado.
export function segundosDeBloqueio(chaves) {
  const agora = Date.now();
  let restante = 0;

  for (const chave of chaves) {
    const registro = registros.get(chave);
    if (registro && registro.bloqueadoAte > agora) {
      restante = Math.max(restante, Math.ceil((registro.bloqueadoAte - agora) / 1000));
    }
  }

  return restante;
}

export function registrarFalha(chaves) {
  const agora = Date.now();
  descartarVelhos(agora);

  for (const chave of chaves) {
    const anterior = registros.get(chave);

    // A janela não é deslizante a partir da primeira falha, e sim da
    // última: passados quinze minutos sem nenhum erro, a série recomeça
    // do zero. Quem erra a senha uma vez por semana nunca acumula.
    const naSerie = anterior && agora - anterior.ultimaFalha <= JANELA_MS;

    let falhas = (naSerie ? anterior.falhas : 0) + 1;
    let bloqueadoAte = anterior?.bloqueadoAte ?? 0;

    if (falhas >= limiteDaChave(chave)) {
      bloqueadoAte = agora + BLOQUEIO_MS;
      falhas = 0; // a contagem recomeça quando o bloqueio terminar
    }

    registros.set(chave, { falhas, ultimaFalha: agora, bloqueadoAte });
  }
}

// Credencial correta encerra a série daquela conta. A contagem por
// origem permanece: acertar a própria senha não desfaz vinte erros em
// contas alheias.
export function limparFalhasDaConta(chaves) {
  for (const chave of chaves) {
    if (chave.startsWith('conta:')) registros.delete(chave);
  }
}

// RNF015 — mensagem compreensível e orientada à correção. Diz o que
// fazer (esperar) e quanto, sem expor contadores nem limites internos.
export function mensagemDeBloqueio(segundos) {
  const minutos = Math.max(1, Math.ceil(segundos / 60));
  return `Muitas tentativas de acesso. Aguarde ${minutos} ${
    minutos === 1 ? 'minuto' : 'minutos'
  } e tente novamente.`;
}
