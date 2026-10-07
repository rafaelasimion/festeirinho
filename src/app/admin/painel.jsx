'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, Image as ImageIcon, Check, X, Pencil, Gavel, ChevronRight,
} from 'lucide-react';
import Etiqueta from '@/componentes/etiqueta';
import CartaoAdmin, {
  Fatos, Fato, Bloco, AcoesAdmin, PeDecidido,
} from '@/componentes/cartao-admin';
import { BotaoAcao } from '@/componentes/acoes-solicitacao';
import { CampoTexto } from '@/componentes/campo';
import {
  formatarPreco,
  SUFIXO_PRECO,
  ROTULO_VERIFICACAO,
  TOM_VERIFICACAO,
} from '@/lib/solicitacao';
import {
  ROTULO_MOTIVO_CONTESTACAO,
  ROTULO_RESULTADO_CONTESTACAO,
  TOM_RESULTADO_CONTESTACAO,
} from '@/lib/contestacao';
import AbaFinanceiro from './aba-financeiro';
import AbaConfiguracoes from './aba-configuracoes';
import AbaContas from './aba-contas';
import AbaDenuncias from './aba-denuncias';
import { formatarDataHora } from '@/lib/datas';
import AvisoPainel from '@/componentes/aviso-painel';

export default function PainelVerificacao({
  nomeAdministrador, fornecedores, servicos, contestacoes = [],
  dadosPendentes = [], processamentos = [], configuracoes = [], contas = [],
  denuncias = [],
}) {
  const router = useRouter();
  const [aba, setAba] = useState('fornecedores');
  const [rejeitando, setRejeitando] = useState(null); // `${tipo}:${id}`
  const [motivo, setMotivo] = useState('');
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const pendentesFornecedor = fornecedores.filter((f) => f.status_verificacao === 'pendente').length;
  const pendentesServico = servicos.filter((s) => s.status_verificacao === 'pendente').length;
  const pendentesContestacao = contestacoes.filter((c) => c.status_contestacao === 'pendente').length;
  const pendentesFinanceiro = dadosPendentes.length + processamentos.length;
  const pendentesContas = contas.filter((c) => c.status_solicitacao_revisao === 'pendente').length;
  const pendentesDenuncias = denuncias.filter((d) => d.status_denuncia === 'pendente').length;

  async function analisar(tipo, id, acao, motivoRejeicao = null) {
    setErro('');
    setMensagem('');
    setProcessando(true);

    try {
      const resposta = await fetch('/api/admin/verificacao', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, id, acao, motivoRejeicao }),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não foi possível registrar a análise.');
        return;
      }

      setRejeitando(null);
      setMotivo('');
      setMensagem(acao === 'aprovar' ? 'Aprovado.' : 'Rejeitado, com o motivo registrado.');
      router.refresh();
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  async function analisarContestacao(id, resultado, justificativa) {
    setErro('');
    setMensagem('');
    setProcessando(true);

    try {
      const resposta = await fetch('/api/admin/contestacoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resultado, justificativa }),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não foi possível registrar a análise.');
        return;
      }

      setMensagem(
        dados.resultado === 'improcedente'
          ? 'Contestação julgada improcedente. A solicitação foi concluída.'
          : dados.aguardandoDadosRecebimento
            ? 'Contestação julgada procedente. O reembolso aguarda os dados de recebimento do cliente.'
            : 'Contestação julgada procedente. A solicitação foi cancelada com reembolso integral.'
      );
      router.refresh();
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-festa-100">
            <ShieldCheck className="h-5 w-5 text-festa-600" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Painel administrativo</h1>
            <p className="text-sm text-slate-600">{nomeAdministrador}</p>
          </div>
        </div>

        <form action="/api/admin/logout" method="post">
          <button type="submit"
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            Sair
          </button>
        </form>
      </header>

      <div className="mb-6 flex flex-wrap gap-2" role="tablist">
        <Aba ativa={aba === 'fornecedores'} aoClicar={() => setAba('fornecedores')}
          rotulo="Fornecedores" pendentes={pendentesFornecedor} />
        <Aba ativa={aba === 'servicos'} aoClicar={() => setAba('servicos')}
          rotulo="Serviços" pendentes={pendentesServico} />
        <Aba ativa={aba === 'contestacoes'} aoClicar={() => setAba('contestacoes')}
          rotulo="Contestações" pendentes={pendentesContestacao} />
        <Aba ativa={aba === 'financeiro'} aoClicar={() => setAba('financeiro')}
          rotulo="Financeiro" pendentes={pendentesFinanceiro} />
        <Aba ativa={aba === 'denuncias'} aoClicar={() => setAba('denuncias')}
          rotulo="Denúncias" pendentes={pendentesDenuncias} />
        <Aba ativa={aba === 'contas'} aoClicar={() => setAba('contas')}
          rotulo="Contas" pendentes={pendentesContas} />
        <Aba ativa={aba === 'configuracoes'} aoClicar={() => setAba('configuracoes')}
          rotulo="Configurações" pendentes={0} />
      </div>

      <AvisoPainel mensagem={mensagem} erro={erro} margem />

      {aba === 'fornecedores' && (
        <Lista vazio="Nenhum fornecedor cadastrado.">
          {fornecedores.map((f) => (
            // A chave inclui o status: quando ele muda, o React recria o item
            // e o estado interno de "alterar decisão" volta ao início.
            <Item key={`${f.id}-${f.status_verificacao}`}
              imagem={f.foto_perfil ?? null}
              formaImagem="circulo"
              textoImagem={f.nome_exibicao}
              titulo={f.nome_exibicao}
              subtitulo={`${f.responsavel} · ${f.cidade}/${f.estado}`}
              status={f.status_verificacao}
              motivoRejeicao={f.motivo_rejeicao}
              rejeitando={rejeitando === `fornecedor:${f.id}`}
              motivo={motivo}
              aoMudarMotivo={setMotivo}
              processando={processando}
              aoAprovar={() => analisar('fornecedor', f.id, 'aprovar')}
              aoAbrirRejeicao={() => { setRejeitando(`fornecedor:${f.id}`); setMotivo(''); }}
              aoCancelarRejeicao={() => { setRejeitando(null); setMotivo(''); }}
              aoRejeitar={() => analisar('fornecedor', f.id, 'rejeitar', motivo)}>
              <Fatos>
                <Fato rotulo="Tipo de pessoa">
                  {f.tipo_pessoa === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'}
                </Fato>
                <Fato rotulo={f.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'}>
                  {(f.tipo_pessoa === 'PF' ? f.cpf : f.cnpj) ?? '—'}
                </Fato>
                {f.tipo_pessoa === 'PJ' && (
                  <Fato rotulo="Razão social" largo>{f.razao_social ?? '—'}</Fato>
                )}
                <Fato rotulo="E-mail">{f.email}</Fato>
                <Fato rotulo="Telefone">{f.telefone}</Fato>
                {(f.instagram_url || f.whatsapp_url || f.site) && (
                  <Fato rotulo="Links" largo>
                    {/* Links de verdade: a análise da RN031 é sobre o que
                        há do outro lado, e copiar o endereço na mão para
                        conferir era trabalho à toa. */}
                    <span className="flex flex-wrap gap-x-3 gap-y-1">
                      {[f.instagram_url, f.whatsapp_url, f.site]
                        .filter(Boolean)
                        .map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer"
                            className="break-all font-medium text-festa-700 hover:underline">
                            {url}
                          </a>
                        ))}
                    </span>
                  </Fato>
                )}
              </Fatos>

              <Bloco rotulo="Descrição do trabalho">{f.descricao}</Bloco>
            </Item>
          ))}
        </Lista>
      )}

      {aba === 'servicos' && (
        <Lista vazio="Nenhum serviço cadastrado.">
          {servicos.map((s) => (
            <Item key={`${s.id}-${s.status_verificacao}`}
              imagem={s.fotos?.find((foto) => foto.principal)?.imagem_url ?? null}
              formaImagem="quadrado"
              titulo={s.nome}
              subtitulo={`${s.fornecedor} · ${s.categoria}`}
              status={s.status_verificacao}
              motivoRejeicao={s.motivo_rejeicao}
              rejeitando={rejeitando === `servico:${s.id}`}
              motivo={motivo}
              aoMudarMotivo={setMotivo}
              processando={processando}
              aoAprovar={() => analisar('servico', s.id, 'aprovar')}
              aoAbrirRejeicao={() => { setRejeitando(`servico:${s.id}`); setMotivo(''); }}
              aoCancelarRejeicao={() => { setRejeitando(null); setMotivo(''); }}
              aoRejeitar={() => analisar('servico', s.id, 'rejeitar', motivo)}>
              <Fatos colunas={3}>
                {/* O preço vem em roxo e num corpo maior: numa análise de
                    adequação ao escopo, é o dado que mais destoa quando
                    algo está fora do lugar. */}
                <Fato rotulo="Preço">
                  <span className="text-base font-semibold text-festa-700">
                    {formatarPreco(s.preco_base)}
                  </span>
                  <span className="text-slate-600">{SUFIXO_PRECO[s.cobranca]}</span>
                </Fato>
                <Fato rotulo="Antecedência">{s.dias_antecedencia} dias</Fato>
                <Fato rotulo="Capacidade">
                  {s.capacidade_max === null
                    ? 'Sem limite'
                    : `Até ${s.capacidade_max} convidados`}
                </Fato>
              </Fatos>

              <Bloco rotulo="Descrição">{s.descricao}</Bloco>
              <FotosDoServico fotos={s.fotos ?? []} />
            </Item>
          ))}
        </Lista>
      )}

      {aba === 'contestacoes' && (
        <Lista vazio="Nenhuma contestação registrada.">
          {contestacoes.map((c) => (
            <ItemContestacao key={`${c.id}-${c.status_contestacao}`}
              contestacao={c}
              processando={processando}
              aoAnalisar={(resultado, justificativa) =>
                analisarContestacao(c.id, resultado, justificativa)} />
          ))}
        </Lista>
      )}

      {aba === 'financeiro' && (
        <AbaFinanceiro dadosPendentes={dadosPendentes} processamentos={processamentos} />
      )}

      {aba === 'denuncias' && (
        <AbaDenuncias denuncias={denuncias} />
      )}

      {aba === 'contas' && (
        <AbaContas contas={contas} />
      )}

      {aba === 'configuracoes' && (
        <AbaConfiguracoes configuracoes={configuracoes} />
      )}
    </main>
  );
}

function Aba({ ativa, aoClicar, rotulo, pendentes }) {
  return (
    <button type="button" role="tab" aria-selected={ativa} onClick={aoClicar}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
        ativa
          ? 'bg-festa-600 text-white'
          : 'border border-slate-200 bg-white text-slate-700 hover:border-festa-200 hover:bg-festa-50'
      }`}>
      {rotulo}
      {pendentes > 0 && (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          ativa ? 'bg-white/25 text-white' : 'bg-atencao-100 text-atencao-800'
        }`}>
          {pendentes}
        </span>
      )}
    </button>
  );
}

// Lista vazia com moldura tracejada, e não uma frase solta no branco: sem
// ela a aba vazia parecia uma tela que não terminou de carregar.
function Lista({ children, vazio }) {
  const itens = Array.isArray(children) ? children : [children];
  if (itens.filter(Boolean).length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
        {vazio}
      </p>
    );
  }
  return <ul className="space-y-4">{children}</ul>;
}

function Item({
  imagem, formaImagem = 'quadrado', textoImagem,
  titulo, subtitulo, status, motivoRejeicao, children,
  rejeitando, motivo, aoMudarMotivo, processando,
  aoAprovar, aoAbrirRejeicao, aoCancelarRejeicao, aoRejeitar,
}) {
  // Item já analisado mostra o resultado, não os botões: ele não está
  // esperando decisão. "Alterar decisão" cobre o engano, que acontece.
  const [revendo, setRevendo] = useState(false);
  const analisado = status !== 'pendente';

  // O formulário de rejeição ocupa o pé inteiro, então ele não divide a
  // linha com os botões: ou se está decidindo, ou se está escrevendo por quê.
  const rodape = rejeitando ? (
    <div className="space-y-3">
      <CampoTexto label="Motivo da rejeição" name={`motivo-rejeicao-${titulo}`}
        rows={3} value={motivo} minimo={10} maximo={500}
        onChange={(e) => aoMudarMotivo(e.target.value)}
        placeholder="Explique o que precisa ser corrigido. O texto é exibido ao fornecedor." />
      <AcoesAdmin>
        <BotaoAcao tom="perigoCheio" Icone={X} onClick={aoRejeitar}
          disabled={processando || motivo.trim().length < 10 || motivo.trim().length > 500}>
          Confirmar rejeição
        </BotaoAcao>
        <BotaoAcao tom="discreto" onClick={aoCancelarRejeicao}>Voltar</BotaoAcao>
      </AcoesAdmin>
    </div>
  ) : analisado && !revendo ? (
    <PeDecidido acao={
      <BotaoAcao tom="discreto" Icone={Pencil} onClick={() => setRevendo(true)}>
        Alterar decisão
      </BotaoAcao>
    }>
      {status === 'aprovado'
        ? 'Aprovado e disponível na plataforma.'
        : 'Rejeitado. Volta para análise quando o fornecedor corrigir.'}
    </PeDecidido>
  ) : (
    <AcoesAdmin>
      <BotaoAcao tom="principal" Icone={Check} onClick={aoAprovar} disabled={processando}>
        Aprovar
      </BotaoAcao>
      <BotaoAcao tom="perigo" Icone={X} onClick={aoAbrirRejeicao} disabled={processando}>
        Rejeitar
      </BotaoAcao>
      {revendo && (
        <BotaoAcao tom="discreto" onClick={() => setRevendo(false)}>Cancelar</BotaoAcao>
      )}
    </AcoesAdmin>
  );

  return (
    <CartaoAdmin
      titulo={titulo}
      subtitulo={subtitulo}
      miniatura={imagem !== undefined
        ? <Miniatura url={imagem} forma={formaImagem} texto={textoImagem ?? titulo} />
        : null}
      etiqueta={
        <Etiqueta tom={TOM_VERIFICACAO[status]} formato="ponto">
          {ROTULO_VERIFICACAO[status]}
        </Etiqueta>
      }
      rodape={rodape}
    >
      {children}

      {motivoRejeicao && status === 'rejeitado' && (
        <Bloco rotulo="Motivo registrado" tom="perigo">{motivoRejeicao}</Bloco>
      )}
    </CartaoAdmin>
  );
}

// UC 043 — a decisão da contestação é DEFINITIVA: procedente cancela com
// reembolso, improcedente conclui a solicitação. Por isso não existe
// "alterar decisão" aqui, diferente da verificação de cadastro.
function ItemContestacao({ contestacao, processando, aoAnalisar }) {
  const [decidindo, setDecidindo] = useState(null); // 'procedente' | 'improcedente'
  const [justificativa, setJustificativa] = useState('');

  const pendente = contestacao.status_contestacao === 'pendente';

  const rodape = !pendente ? (
    <p className="text-sm text-slate-600">
      {contestacao.resultado_contestacao === 'procedente'
        ? 'Solicitação cancelada com reembolso integral ao cliente.'
        : 'Solicitação concluída; a carência do repasse ao fornecedor foi iniciada.'}
    </p>
  ) : decidindo ? (
    <div className="space-y-3">
      {/* A consequência da decisão fica em cima do campo, não abaixo dos
          botões: ela é o que a pessoa precisa reler antes de escrever, e
          a decisão aqui é definitiva (UC 043). */}
      <p className={`rounded-lg px-3 py-2 text-sm ${
        decidindo === 'procedente'
          ? 'bg-sucesso-50 text-sucesso-800'
          : 'bg-perigo-50 text-perigo-700'}`}>
        {decidindo === 'procedente'
          ? 'Procedente: a solicitação será cancelada, com reembolso integral ao cliente e sem repasse ao fornecedor.'
          : 'Improcedente: a solicitação será concluída e o repasse ao fornecedor entra em carência.'}
      </p>

      <CampoTexto label="Justificativa da decisão" name={`justificativa-${contestacao.id}`}
        rows={4} value={justificativa} minimo={20} maximo={1000}
        onChange={(e) => setJustificativa(e.target.value)}
        placeholder="Explique a decisão. O texto é exibido ao cliente e ao fornecedor." />

      <AcoesAdmin>
        <BotaoAcao tom={decidindo === 'procedente' ? 'principal' : 'perigoCheio'}
          Icone={Gavel}
          disabled={processando || justificativa.trim().length < 20 || justificativa.trim().length > 1000}
          onClick={() => aoAnalisar(decidindo, justificativa)}>
          Confirmar decisão
        </BotaoAcao>
        <BotaoAcao tom="discreto" disabled={processando}
          onClick={() => { setDecidindo(null); setJustificativa(''); }}>
          Voltar
        </BotaoAcao>
      </AcoesAdmin>
    </div>
  ) : (
    <AcoesAdmin>
      <BotaoAcao tom="sucesso" Icone={Check} disabled={processando}
        onClick={() => { setDecidindo('procedente'); setJustificativa(''); }}>
        Julgar procedente
      </BotaoAcao>
      <BotaoAcao tom="perigo" Icone={X} disabled={processando}
        onClick={() => { setDecidindo('improcedente'); setJustificativa(''); }}>
        Julgar improcedente
      </BotaoAcao>
    </AcoesAdmin>
  );

  return (
    <CartaoAdmin
      titulo={contestacao.servico}
      subtitulo={`${contestacao.cliente} contestou · fornecedor ${contestacao.fornecedor}`}
      etiqueta={pendente
        ? <Etiqueta tom="atencao" formato="ponto">pendente de análise</Etiqueta>
        : (
          <Etiqueta tom={TOM_RESULTADO_CONTESTACAO[contestacao.resultado_contestacao]}
            formato="ponto">
            {ROTULO_RESULTADO_CONTESTACAO[contestacao.resultado_contestacao]}
          </Etiqueta>
        )}
      rodape={rodape}
    >
      <Fatos>
        <Fato rotulo="Evento">
          {formatarDataHora(contestacao.data_hora_evento)} · {contestacao.duracao}h
        </Fato>
        <Fato rotulo="Convidados">{contestacao.numero_convidados}</Fato>
        <Fato rotulo="Valor">
          <span className="text-base font-semibold text-festa-700">
            {formatarPreco(contestacao.valor_final)}
          </span>
        </Fato>
        <Fato rotulo="Pagamento">
          {contestacao.status_pagamento ?? 'sem pagamento'}
          {contestacao.forma_pagamento && ` · ${contestacao.forma_pagamento}`}
        </Fato>
        <Fato rotulo="Conclusão registrada">
          {formatarDataHora(contestacao.data_registro_conclusao_fornecedor)}
        </Fato>
        <Fato rotulo="Contestada">
          {formatarDataHora(contestacao.data_contestacao_cliente)}
        </Fato>
      </Fatos>

      <Bloco tom="atencao"
        rotulo={ROTULO_MOTIVO_CONTESTACAO[contestacao.motivo_contestacao_cliente]}>
        {contestacao.descricao_contestacao_cliente}
      </Bloco>

      {/* UC 043 — a prova que existe. Só nas pendentes: depois de julgada,
          a conversa sai do alcance da administração (ver a consulta em
          admin/page.jsx). */}
      {pendente && <ConversaDaContestacao mensagens={contestacao.conversa ?? []} />}

      {!pendente && (
        <Bloco rotulo="Justificativa da decisão">
          {contestacao.justificativa_contestacao}
          <span className="mt-1 block text-xs text-slate-500">
            Analisada em {formatarDataHora(contestacao.data_analise_contestacao)}.
          </span>
        </Bloco>
      )}
    </CartaoAdmin>
  );
}

// UC 043 / RN069 — a conversa da solicitação contestada.
//
// Até aqui o admin julgava com a palavra de um lado só: motivo padronizado,
// descrição do cliente e os dados da solicitação. O fornecedor não é ouvido
// em lugar nenhum do sistema, e isso continua sendo verdade — mas o chat é
// onde a execução foi combinada (UC 016), e é a prova que já existe no
// banco sem que ninguém precise anexar nada.
//
// Somente leitura, de propósito: a administração julga a conversa, não
// participa dela. E recolhida por padrão, porque é conteúdo de comunicação
// privada — quem vai julgar abre; quem passa os olhos na fila, não.
function ConversaDaContestacao({ mensagens }) {
  if (mensagens.length === 0) {
    return (
      <Bloco rotulo="Conversa">
        <span className="text-slate-500">
          Cliente e fornecedor não trocaram nenhuma mensagem nesta solicitação.
        </span>
      </Bloco>
    );
  }

  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-50">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3">
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90"
          aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Conversa
        </span>
        <span className="text-sm text-slate-600">
          {mensagens.length === 1 ? '1 mensagem' : `${mensagens.length} mensagens`}
        </span>
      </summary>

      <div className="space-y-2 border-t border-slate-200 p-3">
        {mensagens.map((m) => (
          <div key={m.id}
            className={`rounded-lg border p-2.5 text-sm ${m.doCliente
              ? 'border-festa-200 bg-white'
              : 'border-slate-200 bg-white'}`}>
            <p className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-slate-800">
                {m.autor}
                <span className="ml-1.5 font-normal text-xs text-slate-500">
                  {m.doCliente ? 'cliente' : 'fornecedor'}
                </span>
              </span>
              <span className="text-xs text-slate-500">{formatarDataHora(m.dataHora)}</span>
            </p>
            <p className="mt-1 whitespace-pre-line text-slate-700">{m.conteudo}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

// RF012 / RN067 — as fotos são parte do que a administração aprova. Cada
// miniatura abre a imagem em tamanho real numa nova aba, para conferir
// detalhes que a miniatura esconde.
function FotosDoServico({ fotos }) {
  // Serviço sem foto não é um detalhe: a RN031 manda analisar as fotos
  // junto com o texto, então a ausência delas é informação da análise e
  // merece o mesmo painel que os outros blocos, não uma nota de rodapé.
  if (fotos.length === 0) {
    return (
      <Bloco rotulo="Fotos">
        <span className="text-slate-500">
          Este serviço não tem nenhuma foto cadastrada.
        </span>
      </Bloco>
    );
  }

  return (
    <Bloco rotulo={`Fotos (${fotos.length})`}>
      {/* O -m-1/p-1 dá espaço para o anel da foto principal: o
          overflow-x-auto recorta o que passa da caixa, e o anel, desenhado
          para fora da borda, sumia em cima e à esquerda. */}
      <ul className="-m-1 flex gap-2 overflow-x-auto p-1">
        {fotos.map((foto) => (
          <li key={foto.id} className="relative shrink-0">
            <a href={foto.imagem_url} target="_blank" rel="noreferrer"
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-festa-600/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto.imagem_url} alt="Foto do serviço — abrir em tamanho real"
                className={`h-24 w-32 rounded-lg bg-white object-cover ${
                  foto.principal ? 'ring-2 ring-festa-600' : 'border border-slate-200'}`} />
            </a>
            {foto.principal && (
              <span className="absolute left-1.5 top-1.5 rounded bg-festa-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                principal
              </span>
            )}
          </li>
        ))}
      </ul>
    </Bloco>
  );
}

// Miniatura no cabeçalho dos itens de análise: foto de perfil (redonda) no
// fornecedor, foto principal (quadrada) no serviço. Sem imagem, mostra as
// iniciais ou o ícone — o espaço fica reservado, e a ausência de foto já é,
// ela mesma, uma informação para a análise.
function Miniatura({ url, forma, texto }) {
  const formato = forma === 'circulo' ? 'rounded-full' : 'rounded-lg';

  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`Imagem de ${texto} — abrir em tamanho real`}
          className={`h-12 w-12 object-cover ${formato}`} />
      </a>
    );
  }

  if (forma === 'circulo') {
    const partes = String(texto ?? '').trim().split(/\s+/).filter(Boolean);
    const iniciais = ((partes[0]?.[0] ?? '?') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
    return (
      <span aria-hidden="true"
        className={`flex h-12 w-12 shrink-0 items-center justify-center bg-festa-100 text-sm font-semibold text-festa-700 ${formato}`}>
        {iniciais}
      </span>
    );
  }

  return (
    <span aria-hidden="true"
      className={`flex h-12 w-12 shrink-0 items-center justify-center border-2 border-dashed border-festa-300 bg-festa-50 ${formato}`}>
      <ImageIcon className="h-5 w-5 text-festa-600" />
    </span>
  );
}
