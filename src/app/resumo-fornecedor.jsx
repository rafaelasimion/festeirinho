import Link from 'next/link';
import {
  Inbox, CalendarCheck, CalendarDays, MessageSquareWarning,
  Wallet, Store, CirclePause, Plus,
} from 'lucide-react';
import { pool } from '@/lib/db';
import { obterConfiguracoes } from '@/lib/configuracao';
import { liberarRepassesVencidos } from '@/lib/repasse-servidor';
import { formatarPreco } from '@/lib/solicitacao';
import { formatarData, formatarDataHora } from '@/lib/datas';
import { fecharPendenciasVencidas } from '@/app/fornecedor/solicitacoes/consulta';
import { ItemMenu } from '@/componentes/menu-conta';

// UC 003, passo 7 — a tela inicial "correspondente ao perfil", no lado do
// fornecedor. O cliente abre a página e procura serviços; o fornecedor abre
// e quer saber o que chegou, qual é a próxima festa e quanto tem para sacar.
//
// Cada linha leva à tela onde a coisa se resolve. Nada se decide daqui: a
// tela inicial só aponta, com o número à vista.

// Fecha o que venceu antes de contar: as mesmas rotinas que a lista de
// solicitações (RN035, RN025, RN066, RN039) e o financeiro (RN056) rodam ao
// abrir. Sem elas, a tela inicial diria "2 solicitações esperam a sua
// resposta" e, um clique depois, a lista mostraria uma delas já expirada —
// ou o saldo daqui seria menor que o do financeiro.
export async function buscarResumoFornecedor(idUsuario) {
  const [fornecedores] = await pool.execute(
    `SELECT f.id, f.status_fornecedor
       FROM fornecedor f
      WHERE f.id_usuario = ?
      LIMIT 1`,
    [idUsuario]
  );
  if (fornecedores.length === 0) return null;
  const fornecedor = fornecedores[0];

  await fecharPendenciasVencidas();
  await liberarRepassesVencidos();

  const [
    [[pendencias]],
    [proximos],
    [[servicos]],
    [saldos],
    configuracoes,
  ] = await Promise.all([
    // UC 015, UC 019, UC 046 — o que espera uma ação do fornecedor. As três
    // contas são as mesmas da situacaoFornecedor (lib/solicitacao.js), que
    // escolhe o rótulo do botão na lista: aberta, conclusão a registrar
    // depois do término previsto, e contestação sem a versão dele.
    pool.execute(
      `SELECT
         COALESCE(SUM(so.status = 'aguardando_analise'), 0) AS para_responder,
         MIN(CASE WHEN so.status = 'aguardando_analise'
                  THEN so.data_limite_resposta_fornecedor END) AS primeiro_prazo,
         COALESCE(SUM(so.status = 'confirmado'
             AND so.data_registro_conclusao_fornecedor IS NULL
             AND DATE_ADD(so.data_hora_evento, INTERVAL so.duracao * 60 MINUTE) <= NOW()), 0)
           AS para_concluir,
         COALESCE(SUM(so.status_contestacao <=> 'pendente'
             AND so.data_contestacao_fornecedor IS NULL), 0) AS contestacoes,
         COALESCE(SUM(so.status = 'confirmado' AND so.data_hora_evento > NOW()), 0)
           AS eventos_futuros
         FROM solicitacao so
         JOIN servico s ON s.id = so.id_servico
        WHERE s.id_fornecedor = ?`,
      [fornecedor.id]
    ),
    // O próximo evento confirmado, isto é, pago (RN008).
    pool.execute(
      `SELECT so.id, so.data_hora_evento, s.nome AS servico, u.nome AS cliente
         FROM solicitacao so
         JOIN servico s ON s.id = so.id_servico
         JOIN cliente c ON c.id = so.id_cliente
         JOIN usuario u ON u.id = c.id_usuario
        WHERE s.id_fornecedor = ?
          AND so.status = 'confirmado'
          AND so.data_hora_evento > NOW()
        ORDER BY so.data_hora_evento, so.id
        LIMIT 1`,
      [fornecedor.id]
    ),
    // RN031 / RN020 — "no ar" é o que o cliente encontra na busca: ativo e
    // aprovado. Os pendentes estão na fila da administração.
    pool.execute(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(status_servico = 'ativo' AND status_verificacao = 'aprovado'), 0) AS no_ar,
              COALESCE(SUM(status_verificacao = 'pendente'), 0) AS em_analise,
              COALESCE(SUM(status_verificacao = 'rejeitado'), 0) AS nao_aprovados
         FROM servico
        WHERE id_fornecedor = ?`,
      [fornecedor.id]
    ),
    // RN060 — a mesma view do financeiro, que já desconta os saques.
    pool.execute(
      'SELECT saldo_disponivel FROM vw_saldo_fornecedor WHERE id_fornecedor = ?',
      [fornecedor.id]
    ),
    obterConfiguracoes(),
  ]);

  // SUM e COUNT voltam do mysql2 como texto (DECIMAL e BIGINT); a tela
  // compara e escolhe plural, então tudo vira número aqui.
  return {
    statusFornecedor: fornecedor.status_fornecedor,
    paraResponder: Number(pendencias.para_responder),
    primeiroPrazo: pendencias.primeiro_prazo,
    paraConcluir: Number(pendencias.para_concluir),
    contestacoes: Number(pendencias.contestacoes),
    eventosFuturos: Number(pendencias.eventos_futuros),
    proximoEvento: proximos[0] ?? null,
    servicos: {
      total: Number(servicos.total),
      noAr: Number(servicos.no_ar),
      emAnalise: Number(servicos.em_analise),
      naoAprovados: Number(servicos.nao_aprovados),
    },
    saldo: Number(saldos[0]?.saldo_disponivel ?? 0),
    carenciaDias: configuracoes.periodo_carencia_repasse_dias,
    prazoConclusaoDias: configuracoes.prazo_registro_conclusao_dias,
    saqueMinimo: configuracoes.valor_minimo_saque,
  };
}

function plural(quantidade, singular, varios) {
  return quantidade === 1 ? singular : varios;
}

// O que o mascote diz no balão: a coisa mais urgente, numa frase. A ordem
// é a mesma régua da chamadaFornecedor — prazo correndo primeiro.
export function falaDoMascote(resumo) {
  if (!resumo) return null;
  const { paraResponder, paraConcluir, contestacoes, statusFornecedor } = resumo;

  if (paraResponder > 0) {
    return plural(paraResponder,
      'Tem uma solicitação esperando você!',
      `Tem ${paraResponder} solicitações esperando você!`);
  }
  if (paraConcluir > 0) {
    return plural(paraConcluir,
      'Não esqueça de registrar a conclusão do evento!',
      'Não esqueça de registrar a conclusão dos eventos!');
  }
  if (contestacoes > 0) return 'Uma contestação espera a sua versão.';
  if (statusFornecedor === 'pausado') return 'Sua vitrine está pausada.';
  if (resumo.servicos.total === 0) return 'Vamos cadastrar o seu primeiro serviço?';
  if (resumo.proximoEvento) {
    return `O próximo evento é em ${formatarData(resumo.proximoEvento.data_hora_evento)}!`;
  }
  return 'Tudo em dia por aqui!';
}

function montarItens(resumo) {
  const itens = [];
  const {
    paraResponder, primeiroPrazo, paraConcluir, contestacoes,
    eventosFuturos, proximoEvento, servicos, saldo,
  } = resumo;

  // UC 005 — pausar esconde a vitrine dos clientes. Quem pausou e esqueceu
  // fica sem pedidos e sem saber por quê; por isso vem antes de tudo.
  if (resumo.statusFornecedor === 'pausado') {
    itens.push({
      chave: 'pausado', href: '/minha-conta', Icone: CirclePause, tom: 'atencao',
      titulo: 'Seus serviços estão pausados',
      descricao: 'Enquanto a disponibilidade estiver desligada, os clientes não veem a sua vitrine. Ela se religa em Meu perfil.',
    });
  }

  // RN035 — sem resposta no prazo, a solicitação expira sozinha.
  itens.push(paraResponder > 0 ? {
    chave: 'responder', href: '/fornecedor/solicitacoes', Icone: Inbox, tom: 'atencao',
    titulo: plural(paraResponder,
      '1 solicitação espera a sua resposta',
      `${paraResponder} solicitações esperam a sua resposta`),
    descricao: `O prazo da primeira termina em ${formatarDataHora(primeiroPrazo)}. Sem resposta, ela expira.`,
  } : {
    chave: 'responder', href: '/fornecedor/solicitacoes', Icone: Inbox,
    titulo: 'Nenhuma solicitação esperando resposta',
    descricao: 'Os pedidos novos aparecem aqui e no sino de notificações.',
  });

  // RN066 — sem o registro no prazo, o sistema cancela e devolve o valor
  // ao cliente: é o aviso que mais custa ao fornecedor ignorar.
  if (paraConcluir > 0) {
    itens.push({
      chave: 'concluir', href: '/fornecedor/solicitacoes', Icone: CalendarCheck, tom: 'atencao',
      titulo: plural(paraConcluir,
        '1 evento espera o registro da conclusão',
        `${paraConcluir} eventos esperam o registro da conclusão`),
      descricao: `O registro vai até ${resumo.prazoConclusaoDias} dias depois do término. Sem ele, a solicitação é cancelada e o valor volta ao cliente.`,
    });
  }

  // RF069-B — a versão do fornecedor é opcional, mas é a única chance de
  // ele ser ouvido antes da decisão.
  if (contestacoes > 0) {
    itens.push({
      chave: 'contestacao', href: '/fornecedor/solicitacoes', Icone: MessageSquareWarning, tom: 'atencao',
      titulo: plural(contestacoes,
        '1 contestação espera a sua versão',
        `${contestacoes} contestações esperam a sua versão`),
      descricao: 'A administração decide o caso com o que cada parte enviar.',
    });
  }

  if (proximoEvento) {
    const depois = eventosFuturos - 1;
    const para = proximoEvento.cliente ? `, para ${proximoEvento.cliente}` : '';
    const resto = depois > 0
      ? ` Depois dele, ${plural(depois, 'mais 1 evento confirmado', `mais ${depois} eventos confirmados`)}.`
      : '';
    itens.push({
      chave: 'evento', href: `/fornecedor/solicitacoes/${proximoEvento.id}`, Icone: CalendarDays,
      titulo: `Próximo evento: ${formatarDataHora(proximoEvento.data_hora_evento)}`,
      descricao: `${proximoEvento.servico}${para}.${resto}`,
    });
  } else {
    itens.push({
      chave: 'evento', href: '/fornecedor/solicitacoes', Icone: CalendarDays,
      titulo: 'Nenhum evento confirmado pela frente',
      descricao: 'A solicitação vira evento confirmado quando o cliente paga, depois da sua aprovação.',
    });
  }

  // RN060 / RN056 — o saldo é o que já pode sair; o resto ainda está na
  // carência, contada da conclusão confirmada.
  let explicacaoSaldo = 'Solicite o saque por Pix ou conta bancária.';
  if (saldo <= 0) {
    explicacaoSaldo = `Cada repasse é liberado ${resumo.carenciaDias} dias depois da conclusão confirmada pelo cliente.`;
  } else if (saldo < resumo.saqueMinimo) {
    explicacaoSaldo = `O saque pode ser pedido a partir de ${formatarPreco(resumo.saqueMinimo)}.`;
  }
  itens.push({
    chave: 'saldo', href: '/fornecedor/financeiro', Icone: Wallet,
    titulo: `Saldo disponível: ${formatarPreco(saldo)}`,
    descricao: explicacaoSaldo,
  });

  // Sem nenhum serviço, quem fala é o cartão do primeiro cadastro, acima.
  if (servicos.total > 0) {
    // RN020 — pausado, nada do fornecedor aparece na busca, nem o que está
    // aprovado. "No ar" ali seria mentira; o serviço está pronto, e só.
    const pausado = resumo.statusFornecedor === 'pausado';

    const partes = [];
    if (servicos.emAnalise > 0) {
      partes.push(`${servicos.emAnalise} em análise pela administração`);
    }
    if (servicos.naoAprovados > 0) {
      partes.push(plural(servicos.naoAprovados,
        '1 não aprovado, com o motivo na sua vitrine',
        `${servicos.naoAprovados} não aprovados, com o motivo na sua vitrine`));
    }

    let titulo;
    if (servicos.noAr === 0) {
      titulo = pausado ? 'Nenhum serviço aprovado' : 'Nenhum serviço no ar';
    } else if (pausado) {
      titulo = plural(servicos.noAr, '1 serviço aprovado', `${servicos.noAr} serviços aprovados`);
    } else {
      titulo = plural(servicos.noAr, '1 serviço no ar', `${servicos.noAr} serviços no ar`);
    }

    let descricao = 'Veja a sua vitrine como os clientes a veem.';
    if (partes.length > 0) {
      descricao = `${partes.join('; ')}.`;
    } else if (pausado && servicos.noAr > 0) {
      descricao = plural(servicos.noAr,
        'Ele volta para a busca quando a disponibilidade for religada.',
        'Eles voltam para a busca quando a disponibilidade for religada.');
    }

    itens.push({
      chave: 'servicos', href: '/fornecedor/vitrine', Icone: Store,
      // Recusado pede correção (RN031): o laranja chama para ela.
      tom: servicos.naoAprovados > 0 ? 'atencao' : 'normal',
      titulo,
      descricao,
    });
  }

  return itens;
}

export default function ResumoFornecedor({ resumo }) {
  const itens = montarItens(resumo);

  return (
    <>
      {/* O primeiro acesso de um fornecedor recém-cadastrado: sem serviço,
          ele não aparece em busca nenhuma, e nada na tela dizia qual é o
          próximo passo. Os três passos são uma sequência de verdade —
          cadastro, análise (RN031) e busca (RN068) —, por isso a lista é
          numerada. */}
      {resumo.servicos.total === 0 && (
        <section aria-labelledby="titulo-primeiro-servico"
          className="mt-10 rounded-2xl border border-festa-200 bg-festa-50 p-6 sm:p-8">
          <h2 id="titulo-primeiro-servico" className="text-xl font-semibold text-slate-900">
            Cadastre o seu primeiro serviço
          </h2>
          <p className="mt-1.5 max-w-2xl text-slate-600">
            É ele que aparece na busca dos clientes. O caminho até lá é este:
          </p>
          <ol className="mt-4 space-y-2 text-sm text-slate-700">
            {[
              'Você cadastra o serviço com fotos, preço e antecedência.',
              'A administração confere se ele combina com festas infantis.',
              'Aprovado, ele aparece para os clientes da sua área de atendimento.',
            ].map((passo, indice) => (
              <li key={passo} className="flex items-start gap-3">
                <span aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-festa-700 ring-1 ring-festa-200">
                  {indice + 1}
                </span>
                <span className="pt-0.5">{passo}</span>
              </li>
            ))}
          </ol>
          <Link href="/fornecedor/servicos?novo=1"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-festa-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-festa-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-festa-600/40 focus-visible:ring-offset-2">
            <Plus className="h-5 w-5" aria-hidden="true" />
            Cadastrar serviço
          </Link>
        </section>
      )}

      <section aria-labelledby="titulo-resumo" className="mt-10">
        <h2 id="titulo-resumo" className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Como está o seu negócio
        </h2>
        <div className="mt-4 space-y-2">
          {itens.map(({ chave, ...item }) => (
            <ItemMenu key={chave} {...item} />
          ))}
        </div>
      </section>
    </>
  );
}
