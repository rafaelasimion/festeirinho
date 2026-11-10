import Link from 'next/link';
import {
  BadgeCheck, CalendarClock, ShieldCheck, Search, MapPin,
  Tag, Wallet, HandCoins, Sparkles,
  UtensilsCrossed, Balloon, PartyPopper, CakeSlice, Castle,
  Camera, Speaker, Crown, Gift,
} from 'lucide-react';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { calcularAntecedenciaMinimaDias } from '@/lib/configuracao';
import {
  buscarServicos, contarServicosPorCategoria, lerLocalizacaoCliente, temCoordenadas,
} from '@/lib/busca-servicos';
import CartaoServico from '@/componentes/cartao-servico';
import ResumoFornecedor, { buscarResumoFornecedor, falaDoMascote } from './resumo-fornecedor';

// Tela inicial.
//
// UC 003, passo 7 — depois do login, "a tela inicial correspondente ao seu
// perfil". Cada papel vê aqui o que pode fazer agora:
//
//   visitante   a vitrine completa (RN030), e o convite para os dois lados
//               do sistema — quem contrata e quem oferece;
//   cliente     os serviços que o alcançam (RN068), do mais perto para o
//               mais longe, logo na entrada;
//   fornecedor  o que espera uma ação dele e, abaixo, a vitrine como os
//               clientes a veem.
//
// O mascote recebe todo mundo e diz uma coisa verdadeira sobre a pessoa —
// quantos serviços a atendem, quantas solicitações esperam resposta. É o
// único ponto chamativo da página; o resto segue o cartão branco do
// sistema.

// Os três pilares que o sistema realmente cumpre: moderação do serviço
// (RN031, RF013), antecedência mínima por serviço (RN016, RN046) e
// retenção do valor até a conclusão (RN056). Não é propaganda — é o que o
// código faz.
const DESTAQUES = [
  {
    // O texto dizia que o perfil do fornecedor passa por verificação antes
    // de aparecer, e isso contraria a RN005: o perfil não espera nada, e a
    // verificação só acende o selo. Quem passa por análise antes de entrar
    // na busca é o serviço (RN031).
    titulo: 'Serviços conferidos',
    texto: 'Cada serviço passa pela análise da administração antes de aparecer na busca.',
    Icone: BadgeCheck,
  },
  {
    titulo: 'Contratação com prazo',
    texto: 'Cada serviço define a antecedência mínima necessária, para dar tempo de resposta e de pagamento.',
    Icone: CalendarClock,
  },
  {
    titulo: 'Pagamento pela plataforma',
    texto: 'O valor fica retido até a conclusão do serviço, com regras claras de cancelamento e reembolso.',
    Icone: ShieldCheck,
  },
];

// O convite ao fornecedor fala só do que as regras garantem: preço fixado
// por ele e calculado sem negociação (RN029), pagamento antes do evento e
// repasse depois da conclusão (RN024, RN056), e comissão só sobre o serviço
// realizado, com a multa da desistência tardia indo para ele (RN027,
// RN050, RN057).
const VANTAGENS_FORNECEDOR = [
  {
    titulo: 'Você define o preço',
    texto: 'Por hora, por pessoa ou valor fixo. O total é calculado para o cliente antes do envio, sem negociação.',
    Icone: Tag,
  },
  {
    titulo: 'Pagamento garantido',
    texto: 'O cliente paga pela plataforma antes do evento, e o valor é repassado a você depois da conclusão.',
    Icone: Wallet,
  },
  {
    titulo: 'Comissão só no que você realiza',
    texto: 'Se o cliente desistir perto da data, a multa do cancelamento fica com você.',
    Icone: HandCoins,
  },
];

// As categorias são um domínio fechado, criado pela carga do DDL — não há
// tela que as cadastre —, então o ícone pode sair do nome. Uma categoria
// nova cai no ícone genérico, sem quebrar nada.
const ICONE_CATEGORIA = {
  'Buffet': UtensilsCrossed,
  'Decoração': Balloon,
  'Animação': PartyPopper,
  'Bolos e doces': CakeSlice,
  'Brinquedos e estrutura': Castle,
  'Fotografia e filmagem': Camera,
  'Som e iluminação': Speaker,
  'Personagens vivos': Crown,
  'Convites e lembrancinhas': Gift,
};

// Uma amostra, não a vitrine: duas fileiras na grade do computador. O
// resto está a um clique, na busca, com os filtros.
const QUANTOS_NA_INICIAL = 4;

// O mesmo padrão de festa dos espaços sem foto e da tela 404.
const FUNDO_FESTA = {
  backgroundImage: 'url(/padrao-festa.webp)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
};

function plural(quantidade, singular, varios) {
  return quantidade === 1 ? singular : varios;
}

async function lerPrimeiroNome(idUsuario) {
  const [linhas] = await pool.execute(
    'SELECT nome FROM usuario WHERE id = ? LIMIT 1',
    [idUsuario]
  );
  return String(linhas[0]?.nome ?? '').trim().split(/\s+/)[0] ?? '';
}

export default async function Inicio() {
  const sessao = await lerSessao();
  const papel = sessao?.tipoUsuario ?? 'visitante';

  const nome = sessao ? await lerPrimeiroNome(sessao.id) : '';
  const saudacao = nome ? `Oi, ${nome}!` : 'Oi!';

  // RN068 — a localização só existe para o cliente; para os outros vem
  // null, e a vitrine sai completa (RN030).
  const localizacao = await lerLocalizacaoCliente(sessao);
  const comCoordenadas = temCoordenadas(localizacao);

  // O resumo do fornecedor fecha as pendências vencidas antes de contar, e
  // isso grava no banco. Vem antes das leituras da vitrine para que elas
  // já vejam o estado novo.
  const resumo = papel === 'fornecedor' ? await buscarResumoFornecedor(sessao.id) : null;

  const [servicos, categorias, minimoAntecedencia] = await Promise.all([
    buscarServicos({
      sessao,
      localizacao,
      // Com coordenadas, o mais perto primeiro — é a promessa do "perto de
      // você". Sem elas não há distância, e o melhor avaliado abre a fila.
      ordem: comCoordenadas ? 'distancia' : 'avaliacao',
      limite: QUANTOS_NA_INICIAL,
    }),
    contarServicosPorCategoria({ localizacao }),
    calcularAntecedenciaMinimaDias(),
  ]);

  const totalServicos = categorias.reduce((soma, categoria) => soma + categoria.total, 0);
  const regiao = localizacao ? `${localizacao.cidade}/${localizacao.estado}` : '';

  // ---------- o que muda por papel ----------
  let heroi;
  let secao;

  if (papel === 'cliente') {
    // "Perto de você" é a mesma promessa do título da seção logo abaixo, e
    // o número é o total que a busca vai mostrar com o mesmo filtro.
    const lugar = comCoordenadas ? 'perto de você' : `em ${regiao}`;
    const fala = totalServicos === 0
      ? `Ainda não achei serviços ${lugar}.`
      : plural(totalServicos,
        `Achei 1 serviço ${lugar}!`,
        `Achei ${totalServicos} serviços ${lugar}!`);

    heroi = {
      titulo: `${saudacao} O que falta para a festa?`,
      fala,
      conteudo: (
        <>
          <BuscaRapida />
          <AtalhosCategorias categorias={categorias} />
        </>
      ),
    };

    // RN068 / UC 011, 2a — sem coordenadas, o filtro é a cidade, e a tela
    // diz isso: sem explicar, uma lista curta parece defeito do sistema.
    secao = comCoordenadas ? {
      titulo: 'Perto de você',
      descricao: 'Fornecedores que atendem a sua localização, do mais perto para o mais longe.',
      vazio: 'Nenhum fornecedor atende a sua região por enquanto.',
    } : {
      titulo: `Em ${regiao}`,
      descricao: (
        <>
          Fornecedores da sua cidade.{' '}
          <Link href="/minha-conta#localizacao" className="font-medium text-festa-700 hover:underline">
            Informe sua localização
          </Link>{' '}
          para ver também os de cidades vizinhas que atendem a sua região.
        </>
      ),
      vazio: `Nenhum fornecedor de ${regiao} por enquanto.`,
    };
  } else if (papel === 'fornecedor') {
    // Sem busca nem atalhos, o texto do alto é curto; o mascote encolhe
    // junto, para o resumo, que é o que importa aqui, subir na tela.
    heroi = {
      titulo: saudacao,
      texto: 'Veja o que espera por você e o que vem por aí.',
      fala: falaDoMascote(resumo),
      compacto: true,
    };
    secao = {
      titulo: 'Na vitrine da plataforma',
      descricao: 'Os serviços como os clientes veem, com os mais bem avaliados primeiro.',
      vazio: 'Ainda não há serviços aprovados disponíveis.',
    };
  } else {
    heroi = {
      titulo: 'A festa das crianças, organizada num lugar só',
      texto: 'Buffet, decoração, animação, fotografia e muito mais para a festa infantil. Você encontra, solicita e contrata pela plataforma.',
      fala: totalServicos === 0 ? null : plural(totalServicos,
        'Já tem 1 serviço na vitrine!',
        `Já são ${totalServicos} serviços na vitrine!`),
      conteudo: (
        <>
          <BuscaRapida />
          <AtalhosCategorias categorias={categorias} />
          <p className="mt-6 text-sm text-slate-600">
            Trabalha com festas?{' '}
            <a href="#para-fornecedores" className="font-medium text-festa-700 hover:underline">
              Ofereça os seus serviços
            </a>
          </p>
        </>
      ),
    };
    secao = {
      titulo: 'Serviços em destaque',
      descricao: 'Os mais bem avaliados da vitrine.',
      vazio: 'Ainda não há serviços aprovados disponíveis.',
    };
  }

  return (
    // px-6, como as outras páginas e o cabeçalho: tudo alinha com a logo.
    // No celular o alto começa colado no cabeçalho (o herói ocupa a largura
    // toda); do sm para cima, ele ganha um respiro de cartão.
    <main className="mx-auto w-full max-w-4xl px-6 sm:pt-10">
      <Heroi titulo={heroi.titulo} texto={heroi.texto} fala={heroi.fala}
        compacto={heroi.compacto}>
        {heroi.conteudo}
      </Heroi>

      {/* Os pilares falam com quem contrata; para o fornecedor, o lugar
          deles é ocupado pelo resumo do negócio. */}
      {papel === 'fornecedor'
        ? resumo && <ResumoFornecedor resumo={resumo} />
        : <Pilares />}

      <section aria-labelledby="titulo-servicos" className="mt-14">
        <h2 id="titulo-servicos" className="text-xl font-semibold text-slate-900 sm:text-2xl">
          {secao.titulo}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{secao.descricao}</p>

        {servicos.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            {secao.vazio}
          </p>
        ) : (
          <ul className="mt-6 grid gap-6 sm:grid-cols-2">
            {servicos.map((servico) => (
              <CartaoServico key={servico.id} servico={servico}
                minimoAntecedencia={minimoAntecedencia}
                podeFavoritar={papel === 'cliente'}
                nivelTitulo="h3" />
            ))}
          </ul>
        )}

        {/* O total vem da mesma contagem dos atalhos, com o mesmo filtro:
            o número no botão é o que a busca vai mostrar. Quando a amostra
            já é tudo, o botão oferece o que a busca tem a mais — os
            filtros. */}
        {totalServicos > 0 && (
          <Link href="/servicos"
            className="mt-6 flex w-full items-center justify-center rounded-xl border border-festa-600 bg-white px-5 py-3 font-semibold text-festa-700 transition-colors hover:bg-festa-50 sm:inline-flex sm:w-auto">
            {totalServicos > servicos.length
              ? `Ver todos os ${totalServicos} serviços`
              : 'Buscar com filtros'}
          </Link>
        )}

        {papel === 'visitante' && <ChamadaCliente />}
      </section>

      {papel === 'visitante' && <ParaFornecedores />}
    </main>
  );
}

// ---------------------------------------------------------------------

// O alto da página: o texto à esquerda e o mascote à direita, sobre o
// padrão de festa. No celular o mascote sobe para cima do texto, como na
// tela 404 — o mesmo par em todo lugar em que ele aparece.
//
// O texto vem primeiro no HTML, e só a ordem visual muda no celular: o
// leitor de tela começa pelo título, não pelo balão.
//
// No celular não há cartão: a faixa do mascote vai de uma borda à outra,
// colada no cabeçalho, e o texto fica direto na página. Com moldura, a 16px
// das bordas da tela, o cartão parecia uma caixa dentro da própria página,
// e o balão, a busca e os atalhos, que também têm borda, viravam cartão
// dentro de cartão. O -mx-6 desfaz o px-6 do main só ali. Do sm para cima,
// com espaço em volta, ele volta a ser o cartão branco do sistema.
//
// Lado a lado só a partir do lg (1024px). No tablet em pé (768px), a coluna
// do mascote deixava o texto tão estreito que o título quebrava em quatro
// linhas e a busca cortava o próprio exemplo; ali ainda cabe melhor o
// arranjo do celular, com o mascote em cima.
//
// No computador há dois arranjos. O normal, com busca e atalhos, tem texto
// alto ao lado, e o mascote fica em pé no rodapé com o balão em cima. O
// compacto, só com o título, encolheria o texto ao lado de um mascote
// grande e sobraria um vão branco: ali o mascote diminui e o balão vai para
// o lado dele, como no celular.
//
// As classes de cada arranjo ficam inteiras nas strings, e não montadas
// por partes, porque o Tailwind só gera o CSS das classes que encontra
// escritas no código.
const ARRANJO_HEROI = {
  normal: {
    texto: 'lg:py-12',
    cena: 'lg:w-[19rem] lg:flex-col lg:items-center lg:justify-end lg:px-4 lg:pt-10',
    mascote: 'lg:ml-0 lg:h-auto lg:w-full lg:max-w-[17rem]',
  },
  compacto: {
    texto: 'lg:self-center lg:py-10',
    cena: 'lg:w-[28rem] lg:px-6 lg:pt-6',
    mascote: 'lg:h-48',
  },
};

function Heroi({ titulo, texto, fala, compacto = false, children }) {
  const arranjo = compacto ? ARRANJO_HEROI.compacto : ARRANJO_HEROI.normal;

  return (
    <section aria-labelledby="titulo-inicio"
      className="-mx-6 overflow-hidden bg-white sm:mx-0 sm:rounded-[2rem] sm:border sm:border-festa-100 sm:shadow-sm">
      <div className="flex flex-col lg:flex-row">
        <div className={`min-w-0 flex-1 px-6 pt-6 sm:px-8 sm:pb-8 lg:pl-10 lg:pr-8 ${arranjo.texto}`}>
          <h1 id="titulo-inicio"
            className="text-balance text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
            {titulo}
          </h1>
          {texto && (
            <p className="mt-4 max-w-xl text-slate-600 sm:text-lg">{texto}</p>
          )}
          {children}
        </div>

        <div className={`order-first flex items-end justify-between gap-3 bg-festa-50 px-6 pt-5 sm:px-8 lg:order-none lg:shrink-0 ${arranjo.cena}`}
          style={FUNDO_FESTA}>
          {fala && <Balao lateral={compacto}>{fala}</Balao>}
          {/* Decorativo: quem fala é o balão, que é texto de verdade. A
              altura fixa com largura automática respeita a proporção do
              desenho, e width/height reservam o espaço antes de a imagem
              chegar, para a página não pular. É a maior imagem da tela,
              então pede prioridade. Nos celulares mais estreitos (320px)
              ele encolhe um pouco, para o balão ao lado não virar uma
              coluna de uma palavra por linha. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascote-festeirinho.webp" alt=""
            width={480} height={486} fetchPriority="high"
            className={`ml-auto h-32 w-auto shrink-0 motion-safe:animate-mascote-chega min-[400px]:h-36 sm:h-44 ${arranjo.mascote}`} />
        </div>
      </div>
    </section>
  );
}

// A ponta do balão aponta para o mascote: para a direita quando ele está ao
// lado (celular, tablet e arranjo compacto) e para baixo quando ele está
// embaixo.
//
// No celular o balão ocupa o espaço que sobra ao lado do mascote (flex-1);
// do sm para cima ele volta a ter a largura do próprio texto, mas ainda
// pode encolher (flex-initial) — sem isso, uma frase comprida empurrava o
// mascote para fora da moldura.
const ARRANJO_BALAO = {
  lado: {
    caixa: 'origin-right self-center',
    ponta: '-right-1.5 top-1/2 -translate-y-1/2 border-r border-t',
  },
  acima: {
    caixa: 'origin-right self-center lg:mb-4 lg:max-w-[15rem] lg:origin-bottom lg:self-auto lg:text-center',
    ponta: '-right-1.5 top-1/2 -translate-y-1/2 border-r border-t lg:-bottom-1.5 lg:left-1/2 lg:right-auto lg:top-auto lg:-translate-x-1/2 lg:translate-y-0 lg:border-b lg:border-t-0',
  },
};

function Balao({ lateral = false, children }) {
  const arranjo = lateral ? ARRANJO_BALAO.lado : ARRANJO_BALAO.acima;

  return (
    <p className={`relative mb-8 min-w-0 max-w-[16rem] flex-1 rounded-2xl border border-festa-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-800 shadow-sm motion-safe:animate-balao-abre sm:flex-initial sm:px-4 ${arranjo.caixa}`}>
      {children}
      <span aria-hidden="true"
        className={`absolute h-3 w-3 rotate-45 border-festa-200 bg-white ${arranjo.ponta}`} />
    </p>
  );
}

// A busca da tela inicial é a mesma da página de serviços: um GET comum
// para /servicos?q=..., que funciona até sem JavaScript.
function BuscaRapida() {
  return (
    <form method="get" action="/servicos" role="search"
      className="mt-6 flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-festa-600"
          aria-hidden="true" />
        <label htmlFor="inicio-busca" className="sr-only">Buscar serviços</label>
        <input id="inicio-busca" name="q" type="search" maxLength={100}
          placeholder="Serviço, tema ou fornecedor"
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
      </div>
      <button type="submit"
        className="rounded-xl bg-festa-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-festa-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-festa-600/40 focus-visible:ring-offset-2">
        Buscar
      </button>
    </form>
  );
}

// Atalhos para a busca já filtrada. Só entra categoria que tem serviço
// para esta pessoa — com o filtro de proximidade, no caso do cliente —,
// porque um atalho que abre a busca vazia é um beco.
function AtalhosCategorias({ categorias }) {
  if (categorias.length === 0) return null;

  return (
    <ul aria-label="Categorias com serviços" className="mt-4 flex flex-wrap gap-2">
      {categorias.map(({ id, nome }) => {
        const Icone = ICONE_CATEGORIA[nome] ?? Sparkles;
        return (
          <li key={id}>
            <Link href={`/servicos?categoria=${id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-festa-300 hover:bg-festa-50 hover:text-festa-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-festa-600/40">
              <Icone className="h-4 w-4 shrink-0 text-festa-600" aria-hidden="true" />
              {nome}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// Borda fina e sem sombra. Sem a borda, no computador os três pilares
// boiavam no branco, e no celular um encostava no outro, sem dizer onde
// terminava cada um. A sombra continua só no que se clica: pilar não leva
// a lugar nenhum.
//
// No celular o ícone fica ao lado do texto, para os três caberem sem
// esticar a página; do sm para cima ele sobe para cima do título, que
// assim ganha a largura do cartão inteiro. O p-4 também no computador é
// medido: com p-5, "Pagamento pela plataforma" passava 2px da largura e
// quebrava em duas linhas.
function Pilares() {
  return (
    <section aria-labelledby="titulo-pilares" className="mt-10">
      <h2 id="titulo-pilares" className="sr-only">Por que contratar pelo Festeirinho</h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {DESTAQUES.map(({ titulo, texto, Icone }) => (
          <li key={titulo}
            className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-col">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-festa-100">
              <Icone className="h-5 w-5 text-festa-600" aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900">{titulo}</h3>
              <p className="mt-0.5 text-sm text-slate-600">{texto}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// RN068 — o filtro de proximidade vale para o cliente autenticado. Para o
// visitante, esse é o motivo honesto para criar a conta: a vitrine dele é
// a completa, e a do cliente é a que chega até ele.
function ChamadaCliente() {
  return (
    <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-festa-100">
          <MapPin className="h-5 w-5 text-festa-600" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold text-slate-900">Veja quem atende a sua região</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Com uma conta de cliente e a sua localização, a busca mostra só os
            fornecedores que chegam até você, com a distância de cada um.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link href="/cadastro/cliente"
          className="flex-1 rounded-xl bg-festa-600 px-5 py-3 text-center font-semibold text-white transition-colors hover:bg-festa-700 sm:flex-none">
          Criar conta
        </Link>
        <Link href="/login"
          className="flex-1 rounded-xl border border-festa-600 bg-white px-5 py-3 text-center font-semibold text-festa-700 transition-colors hover:bg-festa-50 sm:flex-none">
          Entrar
        </Link>
      </div>
    </div>
  );
}

// O outro lado do sistema. O id é o destino do "Ofereça os seus serviços"
// do alto da página.
function ParaFornecedores() {
  return (
    <section id="para-fornecedores" aria-labelledby="titulo-fornecedores"
      className="mt-16 scroll-mt-6 rounded-[2rem] bg-festa-50 px-6 py-8 sm:px-10 sm:py-10">
      <div className="grid gap-8 md:grid-cols-2 md:items-center md:gap-10">
        <div>
          <h2 id="titulo-fornecedores" className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Você trabalha com festas?
          </h2>
          <p className="mt-3 text-slate-600">
            Do fotógrafo que está começando ao buffet com CNPJ: cadastre os seus
            serviços e receba solicitações de quem está na sua área de atendimento.
          </p>
          <Link href="/cadastro/fornecedor"
            className="mt-6 flex w-full items-center justify-center rounded-xl bg-festa-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-festa-700 sm:inline-flex sm:w-auto">
            Quero oferecer meus serviços
          </Link>
        </div>

        <ul className="space-y-5">
          {VANTAGENS_FORNECEDOR.map(({ titulo, texto, Icone }) => (
            <li key={titulo} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
                <Icone className="h-5 w-5 text-festa-600" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-semibold text-slate-900">{titulo}</h3>
                <p className="mt-0.5 text-sm text-slate-600">{texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
